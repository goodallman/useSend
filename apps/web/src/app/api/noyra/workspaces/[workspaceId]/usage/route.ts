import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { getNoyraAuthorizationStatus } from "~/server/noyra-api-auth";

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  daily: z.enum(["true"]).optional(),
}).refine(({ from, to }) => new Date(from) < new Date(to));

type DailySentRow = { day: Date; sent: number };

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
    daily: url.searchParams.get("daily") ?? undefined,
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

  const from = new Date(range.data.from);
  const to = new Date(range.data.to);
  const daily = range.data.daily
    ? await db.$queryRaw<DailySentRow[]>(Prisma.sql`
        SELECT date_trunc('day', "sentAt") AT TIME ZONE 'UTC' AS day,
               COUNT(*)::integer AS sent
        FROM "Email"
        WHERE "teamId" = ${team.id}
          AND "sentAt" >= ${from}
          AND "sentAt" < ${to}
        GROUP BY 1
        ORDER BY 1
      `)
    : undefined;
  const sent = daily
    ? daily.reduce((sum, row) => sum + row.sent, 0)
    : await db.email.count({
        where: {
          teamId: team.id,
          sentAt: { gte: from, lt: to },
        },
      });

  return NextResponse.json({
    workspaceId,
    teamId: team.id,
    from: range.data.from,
    to: range.data.to,
    sent,
    ...(daily ? { daily: daily.map((row) => ({ day: row.day.toISOString(), sent: row.sent })) } : {}),
  });
}
