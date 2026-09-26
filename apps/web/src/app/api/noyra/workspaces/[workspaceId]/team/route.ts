import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { getNoyraAuthorizationStatus } from "~/server/noyra-api-auth";
import {
  ensureNoyraWorkspaceTeam,
  NoyraWorkspaceConflictError,
} from "~/server/noyra-workspace";

const bindSchema = z.object({
  email: z.string().email(),
  workspaceName: z.string().trim().min(1).max(100),
  adoptLegacyTeam: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const authorization = getNoyraAuthorizationStatus(request);
  if (authorization === "unconfigured") {
    return NextResponse.json({ error: "Workspace binding is not configured" }, { status: 503 });
  }
  if (authorization === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  if (!workspaceId || workspaceId.length > 200) {
    return NextResponse.json({ error: "Invalid workspace" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bindSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const user = await db.user.findFirst({
    where: {
      email: { equals: parsed.data.email.trim().toLowerCase(), mode: "insensitive" },
    },
    select: { id: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  try {
    const teamId = await ensureNoyraWorkspaceTeam(
      user.id,
      workspaceId,
      parsed.data.workspaceName,
      db,
      parsed.data.adoptLegacyTeam,
    );
    return NextResponse.json({ workspaceId, teamId, userId: user.id, email: user.email });
  } catch (error) {
    if (error instanceof NoyraWorkspaceConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
