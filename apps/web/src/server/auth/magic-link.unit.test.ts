import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verificationTokenCreate: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    verificationToken: {
      create: mocks.verificationTokenCreate,
    },
  },
}));

vi.mock("~/env", () => ({
  env: {
    NEXTAUTH_URL: "https://mail.example.com",
  },
}));

import {
  createMagicLoginLink,
  hashMagicLoginToken,
  isSafeRedirectPath,
  MAGIC_LOGIN_IDENTIFIER_PREFIX,
  MAGIC_LOGIN_TTL_MS,
} from "~/server/auth/magic-link";

describe("magic login links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T10:00:00.000Z"));
    mocks.verificationTokenCreate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores only a token hash and returns a short-lived login URL", async () => {
    const result = await createMagicLoginLink(42, "/settings");
    const url = new URL(result.url);
    const rawToken = url.searchParams.get("token");

    expect(rawToken).toBeTruthy();
    expect(url.pathname).toBe("/magic-login");
    expect(url.searchParams.get("redirectTo")).toBe("/settings");
    expect(result.expiresAt).toEqual(new Date(Date.now() + MAGIC_LOGIN_TTL_MS));
    expect(mocks.verificationTokenCreate).toHaveBeenCalledWith({
      data: {
        identifier: `${MAGIC_LOGIN_IDENTIFIER_PREFIX}42`,
        token: hashMagicLoginToken(rawToken!),
        expires: result.expiresAt,
      },
    });
    expect(
      mocks.verificationTokenCreate.mock.calls[0]?.[0].data.token,
    ).not.toBe(rawToken);
  });

  it("only permits local redirect paths", () => {
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
    expect(isSafeRedirectPath("https://attacker.example")).toBe(false);
    expect(isSafeRedirectPath("//attacker.example")).toBe(false);
  });
});
