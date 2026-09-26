import type { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

import { env } from "~/env";
import { db } from "~/server/db";

export const MAGIC_LOGIN_IDENTIFIER_PREFIX = "noyra-user:";
export const MAGIC_LOGIN_TTL_MS = 10 * 60 * 1000;

type VerificationTokenClient = Pick<PrismaClient, "verificationToken">;

export function hashMagicLoginToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isSafeRedirectPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

export async function createMagicLoginLink(
  userId: number,
  redirectTo = "/dashboard",
  client: VerificationTokenClient = db,
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAGIC_LOGIN_TTL_MS);

  await client.verificationToken.create({
    data: {
      identifier: `${MAGIC_LOGIN_IDENTIFIER_PREFIX}${userId}`,
      token: hashMagicLoginToken(token),
      expires: expiresAt,
    },
  });

  const url = new URL("/magic-login", env.NEXTAUTH_URL);
  url.searchParams.set("token", token);
  if (redirectTo !== "/dashboard") {
    url.searchParams.set("redirectTo", redirectTo);
  }

  return {
    url: url.toString(),
    expiresAt,
  };
}
