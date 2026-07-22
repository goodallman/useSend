import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MagicLoginPage from "./page";

const auth = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(async () => ({
    user: { id: 1, email: "existing@example.com" },
  })),
}));

const navigation = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock("~/server/auth", () => auth);
vi.mock("next/navigation", () => navigation);

describe("magic login page", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
  });

  it("renders the token handler instead of keeping an existing session", () => {
    const page = MagicLoginPage();

    expect(page).toBeTruthy();
    expect(auth.getServerAuthSession).not.toHaveBeenCalled();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });
});
