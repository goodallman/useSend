import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const userFindFirst = vi.fn();
  const transactionUserCreate = vi.fn();
  const transaction = vi.fn(async (callback) =>
    callback({
      user: { create: transactionUserCreate },
      verificationToken: { create: vi.fn() },
    }),
  );

  return {
    authorizationStatus: vi.fn(),
    createMagicLoginLink: vi.fn(),
    userFindFirst,
    transactionUserCreate,
    transaction,
  };
});

vi.mock("~/server/noyra-api-auth", () => ({
  getNoyraAuthorizationStatus: mocks.authorizationStatus,
}));

vi.mock("~/server/auth/magic-link", () => ({
  createMagicLoginLink: mocks.createMagicLoginLink,
  isSafeRedirectPath: (value: string) =>
    value.startsWith("/") && !value.startsWith("//"),
}));

vi.mock("~/server/db", () => ({
  db: {
    user: {
      findFirst: mocks.userFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

import { POST as createAccount } from "~/app/api/noyra/accounts/route";
import { POST as createLoginLink } from "~/app/api/noyra/login-links/route";

function post(path: string, body: unknown) {
  return new Request(`https://mail.example.com${path}`, {
    method: "POST",
    headers: {
      Authorization: "Bearer noyra-secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const magicLink = {
  url: "https://mail.example.com/magic-login?token=one-time-token",
  expiresAt: new Date("2026-07-22T10:10:00.000Z"),
};

describe("Noyra account routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizationStatus.mockReturnValue("authorized");
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.transactionUserCreate.mockResolvedValue({
      id: 7,
      email: "user@example.com",
      name: "User",
      createdAt: new Date("2026-07-22T10:00:00.000Z"),
    });
    mocks.createMagicLoginLink.mockResolvedValue(magicLink);
  });

  it("rejects account provisioning without Noyra authorization", async () => {
    mocks.authorizationStatus.mockReturnValue("unauthorized");

    const response = await createAccount(
      post("/api/noyra/accounts", { email: "user@example.com" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
  });

  it("creates a fresh account and returns its one-time login link", async () => {
    const response = await createAccount(
      post("/api/noyra/accounts", {
        email: "USER@example.com",
        name: "User",
        redirectTo: "/settings",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      user: { id: 7, email: "user@example.com" },
      magicLink: { url: magicLink.url },
    });
    expect(mocks.transactionUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "user@example.com",
          emailVerified: expect.any(Date),
          isBetaUser: true,
          isWaitlisted: false,
        }),
      }),
    );
    expect(mocks.createMagicLoginLink).toHaveBeenCalledWith(
      7,
      "/settings",
      expect.anything(),
    );
  });

  it("does not let the provisioning route register an existing email", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: 7 });

    const response = await createAccount(
      post("/api/noyra/accounts", { email: "user@example.com" }),
    );

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("issues another login link for an existing account", async () => {
    mocks.userFindFirst.mockResolvedValue({
      id: 7,
      email: "user@example.com",
      name: "User",
    });

    const response = await createLoginLink(
      post("/api/noyra/login-links", { email: "USER@example.com" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { id: 7, email: "user@example.com" },
      magicLink: { url: magicLink.url },
    });
    expect(mocks.createMagicLoginLink).toHaveBeenCalledWith(7, undefined);
  });

  it("rejects external callback URLs", async () => {
    const response = await createLoginLink(
      post("/api/noyra/login-links", {
        email: "user@example.com",
        redirectTo: "https://attacker.example",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
  });
});
