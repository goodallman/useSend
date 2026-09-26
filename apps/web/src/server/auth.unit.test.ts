import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verificationTokenDelete: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((options) => ({ id: "credentials", ...options })),
}));

vi.mock("~/server/db", () => ({
  db: {
    verificationToken: {
      delete: mocks.verificationTokenDelete,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

vi.mock("~/server/auth/magic-link", () => ({
  hashMagicLoginToken: vi.fn((token: string) => `hashed:${token}`),
  MAGIC_LOGIN_IDENTIFIER_PREFIX: "noyra-user:",
}));

vi.mock("~/env", () => ({
  env: {
    ADMIN_EMAIL: "admin@example.com",
  },
}));

import { authOptions } from "~/server/auth";

type Authorize = (
  credentials: Record<string, string> | undefined,
) => Promise<unknown>;

const authorize = (
  authOptions.providers[0] as unknown as { authorize: Authorize }
).authorize;

const user = {
  id: 12,
  name: "Noyra User",
  email: "user@example.com",
  image: null,
  isBetaUser: true,
  isWaitlisted: false,
};

describe("magic-link authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verificationTokenDelete.mockResolvedValue({
      identifier: "noyra-user:12",
      token: "hashed:raw-token",
      expires: new Date(Date.now() + 60_000),
    });
    mocks.userFindUnique.mockResolvedValue(user);
  });

  it("only configures the credentials provider with JWT sessions", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
    expect(authOptions.providers).toHaveLength(1);
    expect(authOptions.providers[0]).toMatchObject({ id: "credentials" });
  });

  it("consumes a one-time token and returns its user", async () => {
    await expect(authorize({ token: "raw-token" })).resolves.toMatchObject({
      id: 12,
      email: "user@example.com",
      isBetaUser: true,
      isWaitlisted: false,
    });

    expect(mocks.verificationTokenDelete).toHaveBeenCalledWith({
      where: { token: "hashed:raw-token" },
    });
    expect(mocks.userFindUnique).toHaveBeenCalledWith({ where: { id: 12 } });
  });

  it("rejects an expired token after consuming it", async () => {
    mocks.verificationTokenDelete.mockResolvedValue({
      identifier: "noyra-user:12",
      token: "hashed:raw-token",
      expires: new Date(Date.now() - 1),
    });

    await expect(authorize({ token: "raw-token" })).resolves.toBeNull();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects tokens that were not issued by Noyra", async () => {
    mocks.verificationTokenDelete.mockResolvedValue({
      identifier: "other:12",
      token: "hashed:raw-token",
      expires: new Date(Date.now() + 60_000),
    });

    await expect(authorize({ token: "raw-token" })).resolves.toBeNull();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a token that was already consumed", async () => {
    mocks.verificationTokenDelete.mockRejectedValue({ code: "P2025" });

    await expect(authorize({ token: "raw-token" })).resolves.toBeNull();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects malformed credentials without querying the database", async () => {
    await expect(authorize({ token: "" })).resolves.toBeNull();
    expect(mocks.verificationTokenDelete).not.toHaveBeenCalled();
  });
});
