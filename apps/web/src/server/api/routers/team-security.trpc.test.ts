import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockSendTeamInviteEmail } = vi.hoisted(() => ({
  mockDb: {
    team: {
      findMany: vi.fn(),
    },
    teamUser: {
      findMany: vi.fn(),
    },
    teamInvite: {
      findFirst: vi.fn(),
    },
  },
  mockSendTeamInviteEmail: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: mockDb,
}));

vi.mock("~/server/auth", () => ({
  getServerAuthSession: vi.fn(),
}));

vi.mock("~/server/mailer", () => ({
  sendMail: vi.fn(),
  sendTeamInviteEmail: mockSendTeamInviteEmail,
}));

vi.mock("~/server/service/webhook-service", () => ({}));

import { createCallerFactory } from "~/server/api/trpc";
import { teamRouter } from "~/server/api/routers/team";

const createCaller = createCallerFactory(teamRouter);

function getContext(teamId?: number) {
  return {
    db: mockDb,
    headers: new Headers(),
    session: {
      user: {
        id: 1,
        email: "admin@example.com",
        isWaitlisted: false,
        isAdmin: false,
        isBetaUser: true,
        teamId,
      },
    },
  } as any;
}

describe("teamRouter.resendTeamInvite authorization", () => {
  beforeEach(() => {
    mockDb.teamUser.findMany.mockReset();
    mockDb.teamInvite.findFirst.mockReset();
    mockDb.team.findMany.mockReset();
    mockSendTeamInviteEmail.mockReset();

    mockDb.teamUser.findMany.mockResolvedValue([{
      teamId: 1,
      userId: 1,
      role: "ADMIN",
      team: { id: 1, name: "Team One" },
    }]);
  });

  it("does not resend invites that belong to another team", async () => {
    mockDb.teamInvite.findFirst.mockResolvedValue(null);

    const caller = createCaller(getContext());

    await expect(
      caller.resendTeamInvite({ inviteId: "invite_team_2" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Invite not found",
    });

    expect(mockDb.teamInvite.findFirst).toHaveBeenCalledWith({
      where: {
        teamId: 1,
        id: {
          equals: "invite_team_2",
        },
      },
    });

    expect(mockSendTeamInviteEmail).not.toHaveBeenCalled();
  });

  it("does not select another workspace's team from a bound session", async () => {
    mockDb.teamUser.findMany.mockResolvedValue([]);
    const caller = createCaller(getContext(2));

    await expect(caller.getTeamUsers()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.teamUser.findMany).toHaveBeenCalledWith({
      where: { userId: 1, teamId: 2 },
      include: { team: true },
      take: 1,
    });
  });

  it("requires a new Noyra login when an old session has multiple teams", async () => {
    mockDb.teamUser.findMany.mockResolvedValue([
      { teamId: 1, team: { id: 1 } },
      { teamId: 2, team: { id: 2 } },
    ]);
    const caller = createCaller(getContext());

    await expect(caller.getTeamUsers()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockDb.teamUser.findMany).toHaveBeenCalledWith({
      where: { userId: 1 },
      include: { team: true },
      take: 2,
    });
  });

  it("only lists the team selected by a workspace-bound session", async () => {
    mockDb.team.findMany.mockResolvedValue([{ id: 2, name: "Workspace Two" }]);
    const caller = createCaller(getContext(2));

    await expect(caller.getTeams()).resolves.toEqual([{ id: 2, name: "Workspace Two" }]);
    expect(mockDb.team.findMany).toHaveBeenCalledWith({
      where: {
        id: 2,
        teamUsers: { some: { userId: 1 } },
      },
      include: { teamUsers: { where: { userId: 1 } } },
    });
  });
});
