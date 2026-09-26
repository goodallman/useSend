import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizationStatus: vi.fn(),
  findUser: vi.fn(),
  ensureTeam: vi.fn(),
}));

vi.mock("~/server/noyra-api-auth", () => ({
  getNoyraAuthorizationStatus: mocks.authorizationStatus,
}));
vi.mock("~/server/db", () => ({
  db: { user: { findFirst: mocks.findUser } },
}));
vi.mock("~/server/noyra-workspace", () => ({
  ensureNoyraWorkspaceTeam: mocks.ensureTeam,
  NoyraWorkspaceConflictError: class extends Error {},
}));

import { POST } from "./[workspaceId]/team/route";

function request(body: unknown) {
  return new Request("https://mail.example.com/api/noyra/workspaces/ws-1/team", {
    method: "POST",
    headers: { Authorization: "Bearer noyra-secret", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ workspaceId: "ws-1" }) };

describe("Noyra workspace binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizationStatus.mockReturnValue("authorized");
    mocks.findUser.mockResolvedValue({ id: 12, email: "owner@example.com" });
    mocks.ensureTeam.mockResolvedValue(42);
  });

  it("rejects unauthorized binding", async () => {
    mocks.authorizationStatus.mockReturnValue("unauthorized");
    const response = await POST(request({ email: "owner@example.com" }), params);
    expect(response.status).toBe(401);
    expect(mocks.ensureTeam).not.toHaveBeenCalled();
  });

  it("reports missing server configuration before accessing account data", async () => {
    mocks.authorizationStatus.mockReturnValue("unconfigured");
    const response = await POST(request({ email: "owner@example.com" }), params);
    expect(response.status).toBe(503);
    expect(mocks.findUser).not.toHaveBeenCalled();
  });

  it("links the existing user's team without issuing a login token", async () => {
    const response = await POST(request({
      email: "OWNER@example.com",
      workspaceName: "My workspace",
      adoptLegacyTeam: true,
    }), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaceId: "ws-1", teamId: 42, userId: 12, email: "owner@example.com",
    });
    expect(mocks.findUser).toHaveBeenCalledWith({
      where: { email: { equals: "owner@example.com", mode: "insensitive" } },
      select: { id: true, email: true },
    });
    expect(mocks.ensureTeam).toHaveBeenCalledWith(
      12, "ws-1", "My workspace", expect.anything(), true, false,
    );
  });

  it("forwards strict legacy matching for an existing workspace", async () => {
    const response = await POST(request({
      email: "owner@example.com",
      workspaceName: "EpicWave",
      adoptLegacyTeam: true,
      requireLegacyNameMatch: true,
    }), params);

    expect(response.status).toBe(200);
    expect(mocks.ensureTeam).toHaveBeenCalledWith(
      12, "ws-1", "EpicWave", expect.anything(), true, true,
    );
  });

  it("does not create another useSend user if the tracked account is missing", async () => {
    mocks.findUser.mockResolvedValue(null);
    const response = await POST(request({
      email: "owner@example.com",
      workspaceName: "My workspace",
      adoptLegacyTeam: true,
    }), params);

    expect(response.status).toBe(404);
    expect(mocks.ensureTeam).not.toHaveBeenCalled();
  });
});
