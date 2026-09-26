import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockLogger, mockRedis } = vi.hoisted(() => ({
  mockDb: {
    team: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
  },
  mockRedis: {
    del: vi.fn(),
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/server/logger/log", () => ({ logger: mockLogger }));
vi.mock("~/server/redis", () => ({
  getRedis: () => mockRedis,
  redisKey: (key: string) => key,
}));
vi.mock("~/server/mailer", () => ({
  sendMail: vi.fn(),
  sendTeamInviteEmail: vi.fn(),
}));
vi.mock("~/server/service/limit-service", () => ({
  LimitService: {},
}));
vi.mock("~/server/email-templates/UsageLimitReachedEmail", () => ({
  renderUsageLimitReachedEmail: vi.fn(),
}));
vi.mock("~/server/email-templates/UsageWarningEmail", () => ({
  renderUsageWarningEmail: vi.fn(),
}));

import { TeamService } from "~/server/service/team-service";

describe("TeamService.createTeam", () => {
  beforeEach(() => {
    mockDb.team.create.mockReset();
    mockDb.team.findFirst.mockReset();
    mockDb.team.findMany.mockReset();
    mockDb.team.findUnique.mockReset();
    mockLogger.info.mockReset();
    mockRedis.setex.mockReset();

    mockDb.team.findMany.mockResolvedValue([]);
    mockDb.team.findFirst.mockResolvedValue({ id: 1, name: "Existing Team" });
    mockDb.team.create.mockResolvedValue({ id: 2, name: "Second Team" });
    mockDb.team.findUnique.mockResolvedValue({ id: 2, name: "Second Team" });
    mockRedis.setex.mockResolvedValue("OK");
  });

  it("allows a new user to create a team when another team already exists", async () => {
    await expect(TeamService.createTeam(22, "Second Team")).resolves.toEqual({
      id: 2,
      name: "Second Team",
    });

    expect(mockDb.team.findFirst).not.toHaveBeenCalled();
    expect(mockDb.team.create).toHaveBeenCalledWith({
      data: {
        name: "Second Team",
        teamUsers: {
          create: {
            userId: 22,
            role: "ADMIN",
          },
        },
      },
    });
  });

  it("does not create another team for a user who already has one", async () => {
    mockDb.team.findMany.mockResolvedValue([{ id: 2, name: "Second Team" }]);

    await expect(TeamService.createTeam(22, "Third Team")).resolves.toBeUndefined();

    expect(mockDb.team.create).not.toHaveBeenCalled();
  });
});
