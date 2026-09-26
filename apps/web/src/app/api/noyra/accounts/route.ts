import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createMagicLoginLink,
  isSafeRedirectPath,
} from "~/server/auth/magic-link";
import { db } from "~/server/db";
import { getNoyraAuthorizationStatus } from "~/server/noyra-api-auth";
import {
  ensureNoyraWorkspaceTeam,
  NoyraWorkspaceConflictError,
} from "~/server/noyra-workspace";

const createAccountSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(100).optional(),
  workspaceId: z.string().trim().min(1).max(200).optional(),
  workspaceName: z.string().trim().min(1).max(100).optional(),
  adoptLegacyTeam: z.boolean().optional(),
  requireLegacyNameMatch: z.boolean().optional(),
  redirectTo: z
    .string()
    .refine(isSafeRedirectPath, "Must be an absolute path within this app")
    .optional(),
});

type NoyraTransactionClient = Pick<typeof db, "user" | "team" | "verificationToken">;

export async function POST(request: Request) {
  const authorization = getNoyraAuthorizationStatus(request);
  if (authorization === "unconfigured") {
    return NextResponse.json(
      { error: "Account provisioning is not configured" },
      { status: 503 },
    );
  }

  if (authorization === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existingUser = await db.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  try {
    const result = await db.$transaction(async (tx: NoyraTransactionClient) => {
      const user = await tx.user.create({
        data: {
          email,
          name: parsed.data.name,
          emailVerified: new Date(),
          isBetaUser: true,
          isWaitlisted: false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      });
      const teamId = parsed.data.workspaceId
        ? await ensureNoyraWorkspaceTeam(
            user.id,
            parsed.data.workspaceId,
            parsed.data.workspaceName ?? parsed.data.workspaceId,
            tx,
            parsed.data.adoptLegacyTeam ?? false,
            parsed.data.requireLegacyNameMatch ?? false,
          )
        : undefined;
      const magicLink = teamId
        ? await createMagicLoginLink(user.id, parsed.data.redirectTo, tx, teamId)
        : await createMagicLoginLink(user.id, parsed.data.redirectTo, tx);

      return { user, magicLink, teamId };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof NoyraWorkspaceConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (hasErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    throw error;
  }
}

function hasErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
