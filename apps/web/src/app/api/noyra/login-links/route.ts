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

const createLoginLinkSchema = z.object({
  email: z.string().email(),
  workspaceId: z.string().trim().min(1).max(200).optional(),
  workspaceName: z.string().trim().min(1).max(100).optional(),
  adoptLegacyTeam: z.boolean().optional(),
  redirectTo: z
    .string()
    .refine(isSafeRedirectPath, "Must be an absolute path within this app")
    .optional(),
});

export async function POST(request: Request) {
  const authorization = getNoyraAuthorizationStatus(request);
  if (authorization === "unconfigured") {
    return NextResponse.json(
      { error: "Magic login is not configured" },
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

  const parsed = createLoginLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const user = await db.user.findFirst({
    where: {
      email: {
        equals: parsed.data.email.trim().toLowerCase(),
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  let teamId: number | undefined;
  try {
    teamId = parsed.data.workspaceId
      ? await ensureNoyraWorkspaceTeam(
          user.id,
          parsed.data.workspaceId,
          parsed.data.workspaceName ?? parsed.data.workspaceId,
          db,
          parsed.data.adoptLegacyTeam ?? false,
        )
      : undefined;
  } catch (error) {
    if (error instanceof NoyraWorkspaceConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  const magicLink = teamId
    ? await createMagicLoginLink(user.id, parsed.data.redirectTo, db, teamId)
    : await createMagicLoginLink(user.id, parsed.data.redirectTo);

  return NextResponse.json({ user, magicLink, teamId });
}
