import { Prisma, type PrismaClient } from "@prisma/client";

import { db } from "~/server/db";

type WorkspaceClient = Pick<PrismaClient, "team"> | Pick<Prisma.TransactionClient, "team">;

export class NoyraWorkspaceConflictError extends Error {
  constructor(message = "This workspace belongs to another useSend account") {
    super(message);
  }
}

/** Keep a Noyra workspace's mail in exactly one useSend team. */
export async function ensureNoyraWorkspaceTeam(
  userId: number,
  workspaceId: string,
  workspaceName: string,
  client: WorkspaceClient = db,
  adoptLegacyTeam = false,
  requireLegacyNameMatch = false,
): Promise<number> {
  const existing = await client.team.findUnique({
    where: { noyraWorkspaceId: workspaceId },
    include: { teamUsers: { where: { userId, role: "ADMIN" } } },
  });
  if (existing) {
    if (existing.teamUsers.length === 0) throw new NoyraWorkspaceConflictError();
    if (requireLegacyNameMatch) {
      const legacyMatch = await client.team.findFirst({
        where: {
          noyraWorkspaceId: null,
          name: { equals: workspaceName, mode: "insensitive" },
          teamUsers: { some: { userId, role: "ADMIN" } },
        },
        select: { id: true },
      });
      if (legacyMatch) {
        throw new NoyraWorkspaceConflictError("Workspace is linked to a new team while its legacy team remains unlinked");
      }
    }
    return existing.id;
  }

  if (adoptLegacyTeam) {
    if (!requireLegacyNameMatch) {
      const linkedTeam = await client.team.findFirst({
        where: { noyraWorkspaceId: { not: null }, teamUsers: { some: { userId } } },
        select: { id: true },
      });
      if (linkedTeam) {
        throw new NoyraWorkspaceConflictError("This useSend account already has another linked workspace");
      }
    }
    const legacyTeams = await client.team.findMany({
      where: {
        noyraWorkspaceId: null,
        teamUsers: { some: { userId, role: "ADMIN" } },
        ...(requireLegacyNameMatch
          ? { name: { equals: workspaceName, mode: "insensitive" as const } }
          : {}),
      },
      select: { id: true },
      take: 2,
    });
    if (legacyTeams.length === 1) {
      const adopted = await client.team.updateMany({
        where: { id: legacyTeams[0]!.id, noyraWorkspaceId: null },
        data: { noyraWorkspaceId: workspaceId },
      });
      if (adopted.count === 1) return legacyTeams[0]!.id;
      const raced = await client.team.findUnique({
        where: { noyraWorkspaceId: workspaceId },
        include: { teamUsers: { where: { userId, role: "ADMIN" } } },
      });
      if (raced?.teamUsers.length) return raced.id;
      throw new NoyraWorkspaceConflictError("The existing useSend team was linked elsewhere");
    }
    if (legacyTeams.length > 1) {
      throw new NoyraWorkspaceConflictError("This useSend account has multiple teams; select one before linking");
    }
    if (requireLegacyNameMatch) {
      throw new NoyraWorkspaceConflictError("No uniquely matching legacy team; select the existing team before linking");
    }
  }

  try {
    const team = await client.team.create({
      data: {
        name: workspaceName,
        noyraWorkspaceId: workspaceId,
        teamUsers: { create: { userId, role: "ADMIN" } },
      },
      select: { id: true },
    });
    return team.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await client.team.findUnique({
        where: { noyraWorkspaceId: workspaceId },
        include: { teamUsers: { where: { userId, role: "ADMIN" } } },
      });
      if (raced) {
        if (raced.teamUsers.length === 0) throw new NoyraWorkspaceConflictError();
        return raced.id;
      }
    }
    throw error;
  }
}
