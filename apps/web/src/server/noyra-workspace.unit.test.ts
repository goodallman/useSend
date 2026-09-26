import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const team = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock("~/server/db", () => ({ db: { team } }));

import { ensureNoyraWorkspaceTeam, NoyraWorkspaceConflictError } from "~/server/noyra-workspace";

describe("Noyra workspace team mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    team.findUnique.mockResolvedValue(null);
    team.findFirst.mockResolvedValue(null);
    team.findMany.mockResolvedValue([]);
  });

  it("reuses only the team mapped to the workspace", async () => {
    team.findUnique.mockResolvedValue({ id: 7, teamUsers: [{ userId: 12, role: "ADMIN" }] });

    await expect(ensureNoyraWorkspaceTeam(12, "workspace-a", "Workspace A")).resolves.toBe(7);
    expect(team.findUnique).toHaveBeenCalledWith({
      where: { noyraWorkspaceId: "workspace-a" },
      include: { teamUsers: { where: { userId: 12, role: "ADMIN" } } },
    });
    expect(team.create).not.toHaveBeenCalled();
  });

  it("rejects an owner who does not administer the mapped team", async () => {
    team.findUnique.mockResolvedValue({ id: 7, teamUsers: [] });

    await expect(ensureNoyraWorkspaceTeam(12, "workspace-a", "Workspace A"))
      .rejects.toBeInstanceOf(NoyraWorkspaceConflictError);
  });

  it("adopts the sole legacy team for the first workspace", async () => {
    team.findMany.mockResolvedValue([{ id: 7 }]);
    team.updateMany.mockResolvedValue({ count: 1 });

    await expect(ensureNoyraWorkspaceTeam(12, "workspace-a", "Workspace A", undefined, true))
      .resolves.toBe(7);
    expect(team.updateMany).toHaveBeenCalledWith({
      where: { id: 7, noyraWorkspaceId: null },
      data: { noyraWorkspaceId: "workspace-a" },
    });
    expect(team.create).not.toHaveBeenCalled();
  });

  it("does not assign pooled legacy usage to an arbitrary workspace", async () => {
    team.findMany.mockResolvedValue([{ id: 7 }]);
    team.create.mockResolvedValue({ id: 8 });

    await expect(ensureNoyraWorkspaceTeam(12, "workspace-a", "Workspace A"))
      .resolves.toBe(8);
    expect(team.updateMany).not.toHaveBeenCalled();
  });

  it("does not replace an existing account with a new team when adoption is ambiguous", async () => {
    team.findMany.mockResolvedValue([{ id: 7 }, { id: 8 }]);

    await expect(ensureNoyraWorkspaceTeam(12, "workspace-a", "Workspace A", undefined, true))
      .rejects.toBeInstanceOf(NoyraWorkspaceConflictError);
    expect(team.create).not.toHaveBeenCalled();
  });

  it("does not adopt a team already linked to another workspace", async () => {
    team.findFirst.mockResolvedValue({ id: 7 });

    await expect(ensureNoyraWorkspaceTeam(12, "workspace-a", "Workspace A", undefined, true))
      .rejects.toBeInstanceOf(NoyraWorkspaceConflictError);
    expect(team.create).not.toHaveBeenCalled();
  });

  it("creates a separate team when another workspace is already linked", async () => {
    team.findFirst.mockResolvedValue({ id: 7 });
    team.create.mockResolvedValue({ id: 8 });

    await expect(ensureNoyraWorkspaceTeam(12, "workspace-b", "Workspace B")).resolves.toBe(8);
    expect(team.create).toHaveBeenCalledWith({
      data: {
        name: "Workspace B",
        noyraWorkspaceId: "workspace-b",
        teamUsers: { create: { userId: 12, role: "ADMIN" } },
      },
      select: { id: true },
    });
  });

  it("returns the same mapped team when concurrent binding wins the race", async () => {
    team.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 7, teamUsers: [{ userId: 12, role: "ADMIN" }] });
    team.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      "Unique constraint", { code: "P2002", clientVersion: "test" },
    ));

    await expect(ensureNoyraWorkspaceTeam(12, "workspace-a", "Workspace A"))
      .resolves.toBe(7);
    expect(team.findUnique).toHaveBeenCalledTimes(2);
  });
});
