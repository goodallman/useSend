import { beforeEach, describe, expect, it, vi } from "vitest";
import type { inferRouterContext } from "@trpc/server";

const { mockDb, refresh } = vi.hoisted(() => ({
  mockDb: {
    teamUser: { findMany: vi.fn() },
    domain: { findUnique: vi.fn() },
  },
  refresh: vi.fn(),
}));

vi.mock("~/server/db", () => ({ db: mockDb }));
vi.mock("~/server/auth", () => ({ getServerAuthSession: vi.fn() }));
vi.mock("~/server/service/domain-service", () => ({
  createDomain: vi.fn(),
  deleteDomain: vi.fn(),
  getDomain: vi.fn(),
  getDomains: vi.fn(),
  updateDomain: vi.fn(),
  refreshDomainVerification: refresh,
}));
vi.mock("~/server/service/email-service", () => ({ sendEmail: vi.fn() }));
vi.mock("~/server/service/ses-settings-service", () => ({
  SesSettingsService: {},
}));

import { domainRouter } from "./domain";

const domain = { id: 12, teamId: 10, name: "example.com" };
function context(authenticated = true) {
  return {
    db: mockDb,
    headers: new Headers(),
    session: authenticated
      ? {
          user: { id: 42, teamId: 10, isWaitlisted: false },
        }
      : null,
  } as unknown as inferRouterContext<typeof domainRouter>;
}

describe("manual domain verification", () => {
  beforeEach(() => {
    mockDb.teamUser.findMany.mockResolvedValue([{ team: { id: 10 } }]);
    mockDb.domain.findUnique.mockResolvedValue(domain);
  });

  it("performs verification immediately and returns the DNS result", async () => {
    const result = {
      ...domain,
      status: "PENDING",
      dnsRecords: [],
      isVerifying: true,
    };
    refresh.mockResolvedValue(result);
    await expect(
      domainRouter.createCaller(context()).startVerification({ id: 12 }),
    ).resolves.toEqual(result);
    expect(refresh).toHaveBeenCalledWith(domain);
    expect(mockDb.domain.findUnique).toHaveBeenCalledWith({
      where: { id: 12, teamId: 10 },
    });
  });

  it("returns verification failures to the caller", async () => {
    refresh.mockRejectedValue(new Error("Verification service unavailable"));
    await expect(
      domainRouter.createCaller(context()).startVerification({ id: 12 }),
    ).rejects.toThrow("Verification service unavailable");
  });

  it("does not verify a domain outside the selected team", async () => {
    mockDb.domain.findUnique.mockResolvedValue(null);
    await expect(
      domainRouter.createCaller(context()).startVerification({ id: 12 }),
    ).rejects.toThrow("Domain not found");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    await expect(
      domainRouter.createCaller(context(false)).startVerification({ id: 12 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(refresh).not.toHaveBeenCalled();
  });
});
