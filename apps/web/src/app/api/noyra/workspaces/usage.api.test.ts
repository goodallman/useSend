import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizationStatus: vi.fn(),
  findTeam: vi.fn(),
  countEmail: vi.fn(),
}));

vi.mock("~/server/noyra-api-auth", () => ({
  getNoyraAuthorizationStatus: mocks.authorizationStatus,
}));
vi.mock("~/server/db", () => ({
  db: {
    team: { findUnique: mocks.findTeam },
    email: { count: mocks.countEmail },
  },
}));

import { GET } from "./[workspaceId]/usage/route";

function request() {
  return new Request("https://mail.example.com/api/noyra/workspaces/ws-1/usage?from=2026-09-01T00%3A00%3A00.000Z&to=2026-10-01T00%3A00%3A00.000Z", {
    headers: { Authorization: "Bearer noyra-secret" },
  });
}

describe("Noyra workspace usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizationStatus.mockReturnValue("authorized");
    mocks.findTeam.mockResolvedValue({ id: 42 });
    mocks.countEmail.mockResolvedValue(17);
  });

  it("rejects requests without Noyra authorization", async () => {
    mocks.authorizationStatus.mockReturnValue("unauthorized");
    const response = await GET(request(), { params: Promise.resolve({ workspaceId: "ws-1" }) });
    expect(response.status).toBe(401);
    expect(mocks.findTeam).not.toHaveBeenCalled();
  });

  it("reports missing server configuration without querying usage", async () => {
    mocks.authorizationStatus.mockReturnValue("unconfigured");
    const response = await GET(request(), { params: Promise.resolve({ workspaceId: "ws-1" }) });
    expect(response.status).toBe(503);
    expect(mocks.findTeam).not.toHaveBeenCalled();
  });

  it("counts accepted sends for the mapped team and period", async () => {
    const response = await GET(request(), { params: Promise.resolve({ workspaceId: "ws-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaceId: "ws-1", teamId: 42, from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z", sent: 17,
    });
    expect(mocks.findTeam).toHaveBeenCalledWith({
      where: { noyraWorkspaceId: "ws-1" }, select: { id: true },
    });
    expect(mocks.countEmail).toHaveBeenCalledWith({
      where: {
        teamId: 42,
        sentAt: {
          gte: new Date("2026-09-01T00:00:00.000Z"),
          lt: new Date("2026-10-01T00:00:00.000Z"),
        },
      },
    });
  });

  it("does not report a workspace without a team", async () => {
    mocks.findTeam.mockResolvedValue(null);
    const response = await GET(request(), { params: Promise.resolve({ workspaceId: "ws-1" }) });
    expect(response.status).toBe(404);
    expect(mocks.countEmail).not.toHaveBeenCalled();
  });
});
