import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { getNoyraAuthorizationStatus } from "~/server/noyra-api-auth";

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
}).refine(({ from, to }) => new Date(from) < new Date(to));

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const authorization = getNoyraAuthorizationStatus(request);
  if (authorization === "unconfigured") {
    return NextResponse.json({ error: "Usage reporting is not configured" }, { status: 503 });
  }
  if (authorization === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const url = new URL(request.url);
  const range = querySchema.safeParse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!workspaceId || !range.success) {
    return NextResponse.json({ error: "Invalid workspace or date range" }, { status: 400 });
  }

  const team = await db.team.findUnique({
    where: { noyraWorkspaceId: workspaceId },
    select: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const sent = await db.email.count({
    where: {
      teamId: team.id,
      sentAt: {
        gte: new Date(range.data.from),
        lt: new Date(range.data.to),
      },
    },
  });

  return NextResponse.json({
    workspaceId,
    teamId: team.id,
    from: range.data.from,
    to: range.data.to,
    sent,
  });
}
