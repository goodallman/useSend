import { timingSafeEqual } from "crypto";

import { env } from "~/env";

export type NoyraAuthorizationStatus =
  "authorized" | "unauthorized" | "unconfigured";

export function getNoyraAuthorizationStatus(
  request: Request,
): NoyraAuthorizationStatus {
  if (!env.NOYRA_API_KEY) {
    return "unconfigured";
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return "unauthorized";
  }

  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(env.NOYRA_API_KEY);

  if (provided.length !== expected.length) {
    return "unauthorized";
  }

  return timingSafeEqual(provided, expected) ? "authorized" : "unauthorized";
}
