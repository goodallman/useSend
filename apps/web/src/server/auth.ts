import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { env } from "~/env";
import {
  hashMagicLoginToken,
  MAGIC_LOGIN_IDENTIFIER_PREFIX,
} from "~/server/auth/magic-link";
import { db } from "~/server/db";

const credentialsSchema = z.object({
  token: z.string().min(1),
});

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  // eslint-disable-next-line no-unused-vars
  interface Session extends DefaultSession {
    user: {
      id: number;
      isBetaUser: boolean;
      isAdmin: boolean;
      isWaitlisted: boolean;
    } & DefaultSession["user"];
  }

  // eslint-disable-next-line no-unused-vars
  interface User {
    id: number;
    isBetaUser: boolean;
    isAdmin: boolean;
    isWaitlisted: boolean;
  }
}

declare module "next-auth/jwt" {
  // eslint-disable-next-line no-unused-vars
  interface JWT {
    id: number;
    isBetaUser: boolean;
    isWaitlisted: boolean;
  }
}

/**
 * One-time-token authentication. User creation is intentionally not handled by
 * NextAuth; accounts must be provisioned through POST /api/noyra/accounts.
 */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = Number(user.id);
        token.isBetaUser = user.isBetaUser;
        token.isWaitlisted = user.isWaitlisted;
      }

      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id,
        isBetaUser: token.isBetaUser,
        isAdmin: token.email === env.ADMIN_EMAIL,
        isWaitlisted: token.isWaitlisted,
      },
    }),
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Noyra magic link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        let magicToken;
        try {
          magicToken = await db.verificationToken.delete({
            where: { token: hashMagicLoginToken(parsed.data.token) },
          });
        } catch (error) {
          if (hasErrorCode(error, "P2025")) {
            return null;
          }

          throw error;
        }

        if (
          magicToken.expires <= new Date() ||
          !magicToken.identifier.startsWith(MAGIC_LOGIN_IDENTIFIER_PREFIX)
        ) {
          return null;
        }

        const userId = Number(
          magicToken.identifier.slice(MAGIC_LOGIN_IDENTIFIER_PREFIX.length),
        );
        if (!Number.isSafeInteger(userId)) {
          return null;
        }

        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          isBetaUser: user.isBetaUser,
          isWaitlisted: user.isWaitlisted,
          isAdmin: user.email === env.ADMIN_EMAIL,
        };
      },
    }),
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions);

function hasErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
