# Repository Guidelines

## Project Structure & Module Organization

- apps/web: Next.js app (primary product). Uses Prisma, TRPC, Tailwind.
- apps/marketing: Public marketing site (Next.js, static export).
- apps/docs: Mintlify docs content.
- apps/smtp-server: SMTP proxy/server (TypeScript → tsup build).
- packages/\*: Shared libraries (email-editor, ui, eslint-config, tailwind-config, typescript-config, sdk).
- docker/: Dev/compose files; .env\* at repo root define configuration.

## Noyra Fork: Authentication and Account Lifecycle

This repository is a Noyra-specific fork of useSend. Do not restore upstream
login, signup, or self-hosted-admin behavior without an explicit request. The
authentication boundary is intentionally different from base useSend.

### Differences from base useSend

- Base useSend supports email OTP/magic-link login plus optional GitHub and
  Google OAuth through the Prisma NextAuth adapter. This fork removes those
  providers and configures one credentials provider named `Noyra magic link`.
- Base useSend permits interactive registration under its hosted/self-hosted
  rules. In this fork, `/signup` redirects to `/login`, and `/login` is only an
  informational page telling users to launch useSend from Noyra. It must not
  contain an email form, password form, OAuth buttons, or a registration path.
- The Noyra platform workspace screen is the only normal user entry point. It
  calls the protected Noyra endpoints server-to-server, receives a single-use
  link, and redirects the browser to that link.
- NextAuth uses JWT sessions in this fork. It does not use `PrismaAdapter`, and
  NextAuth must not create users. User provisioning happens only through the
  Noyra integration API.
- Upstream auth-provider environment variables such as `GITHUB_ID`,
  `GITHUB_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are not part
  of this fork's runtime contract. `NOYRA_API_KEY` is the integration
  credential.

### Server-to-server Noyra endpoints

The integration endpoints are:

- `POST /api/noyra/accounts`: create a new useSend `User` and return a
  single-use login link. It normalizes the email, marks the provisioned user as
  verified/beta-enabled/not-waitlisted, and returns `409` if the email already
  exists. User creation and token creation are one database transaction.
- `POST /api/noyra/login-links`: find an existing user case-insensitively and
  return a new single-use login link. It returns `404` when the account does
  not exist.

Both routes authenticate `Authorization: Bearer <NOYRA_API_KEY>` with a
length check and `timingSafeEqual`. Missing `NOYRA_API_KEY` is a server
configuration error (`503`); a missing or incorrect bearer value is `401`.
The key is server-only and must never be exposed through a `NEXT_PUBLIC_`
variable, browser response, log, or committed configuration.

The corresponding Noyra platform client is in the sibling repository at
`../noyra-platform/src/server/noyra-apps/usesend-client.ts`. Its current
fallback is intentional: try account creation, and on `409`, request a login
link for the existing user. It also rejects a returned magic-link URL whose
origin differs from the configured useSend origin.

### Magic-link security invariants

- `createMagicLoginLink` generates a 32-byte random base64url token with a
  ten-minute lifetime.
- Only the SHA-256 token hash is stored in `VerificationToken`; the raw token
  exists only in the returned URL.
- Redeeming the credentials provider deletes the database token before
  validating it further. A token is therefore single-use, including when an
  expired or malformed Noyra token is presented.
- The verification-token identifier must start with `noyra-user:` and contain
  a safe integer user ID.
- Redirect targets must be absolute paths inside this application: they must
  start with `/` and must not start with `//`. Never permit an absolute URL.
- `/magic-login` must process a supplied token even if the browser already has
  a useSend session. This allows Noyra to switch the browser to the account it
  just selected instead of retaining a stale session.
- The magic-login page must remain non-indexable and use a `no-referrer`
  policy so the token is not leaked through referrer headers.
- The browser redeems the token through the NextAuth credentials callback;
  when `AUTH_EMAIL_RATE_LIMIT` is enabled, that callback is rate-limited by
  client IP.

Primary files for this flow:

- `apps/web/src/server/auth.ts`
- `apps/web/src/server/auth/magic-link.ts`
- `apps/web/src/server/noyra-api-auth.ts`
- `apps/web/src/app/api/noyra/accounts/route.ts`
- `apps/web/src/app/api/noyra/login-links/route.ts`
- `apps/web/src/app/magic-login/`
- `apps/web/src/app/login/`

### Current user, team, and workspace semantics

Be precise about these terms when modifying the integration:

- A useSend `User` is the login identity.
- A useSend `Team` is the existing tenant boundary for domains, API keys,
  emails, contact books, campaigns, templates, usage, suppressions, and
  webhooks.
- The current Noyra provisioning endpoints create or find a `User`; they do
  not create a `Team`, accept a Noyra workspace ID, synchronize workspace
  members, or bind a login link to a particular team.
- After a newly provisioned user first signs in, `DashboardProvider` displays
  the existing `CreateTeam` UI when that user has no team.
- `TeamService.createTeam` currently returns without creating another team if
  that user already belongs to one. `teamProcedure` resolves the first
  `TeamUser` membership, and the client `TeamProvider` displays `teams[0]`.
  These are one-team-per-user assumptions, not workspace-aware selection.
- On the Noyra platform, a workspace currently stores a tracked
  `useSendAccount` containing the workspace owner's useSend user ID/email and
  timestamps. Any current workspace member may launch it, but the launched
  identity is always the workspace owner's email. Workspaces owned by the same
  person intentionally reuse that existing useSend user, and the platform
  currently aggregates their email entitlement by owner identity.

Consequently, do not claim that the current fork already maps one Noyra
workspace to one useSend team/account. Team-level data isolation exists, but
the Noyra integration is presently identity-based rather than
workspace-to-team-based. Implementing a strict one-workspace/one-team model
requires an explicit immutable workspace-to-team mapping, team-bound login
sessions, deterministic team resolution, membership synchronization, and
cross-team authorization tests in both repositories.

### Admin and navigation differences

- Self-hosted status no longer makes every authenticated user an application
  administrator. `session.user.isAdmin` is true only when the session email
  equals `ADMIN_EMAIL`.
- `adminProcedure` and the `/admin` layout enforce that administrator check;
  the layout is dynamically rendered so authorization is evaluated per
  request.
- Only administrators load or initialize global SES settings. Ordinary Noyra
  users must not see the SES bootstrap screen.
- The sidebar intentionally omits the general Settings entry, Team/Usage menu
  shortcuts, the self-hosted version display, and the SMTP developer-settings
  tab. The Admin entry is shown only to `ADMIN_EMAIL`.
- Dashboard layouts are dynamically rendered and pass the server session into
  `NextAuthProvider`; preserve this to avoid auth-loading regressions.

### Required tests when changing this integration

- Update the targeted auth unit tests, magic-link unit tests, and Noyra route
  API tests for every contract change.
- Preserve coverage for unauthorized/unconfigured Noyra requests, duplicate
  account handling, case-insensitive email lookup, local-only redirects,
  hashed token storage, expiry, one-time consumption, token namespace checks,
  and processing a new magic link while an old session exists.
- If workspace/team binding is introduced, add tests proving that a link for
  one workspace cannot select or access another workspace's team and that
  retries cannot create duplicate teams.

## Build, Test, and Development Commands

- `pnpm i`: Install workspace deps (Node >= 20).
- `pnpm dev`: Turbo dev for all relevant apps (loads `.env`).
- `pnpm start:web:local`: Run only `apps/web` locally on port 3000.
- `pnpm build`: Turbo build across the monorepo.
- `pnpm dx` / `pnpm dx:up` / `pnpm dx:down`: Spin up/down local infra via Docker Compose, then run migrations.
- Database (apps/web filter): `pnpm db:generate` | `db:migrate-dev` | `db:push` | `db:studio`.
- Never run migrations unless users explicitly asked

## Coding Style & Naming Conventions

- Files: React components PascalCase (e.g., `AppSideBar.tsx`); folders kebab/lowercase.
- Paths (web): use alias `~/` for src imports (e.g., `import { x } from "~/utils/x"`).
- NEVER USE DYNAMIC IMPORTS. ALWAYS IMPORT ON THE TOP

## Rules

- Prefer to use trpc alway unless asked otherwise

## Testing Guidelines

- Web testing is configured with Vitest in `apps/web`; add tests when changes impact logic, APIs, or behavior.
- Prefer targeted suites first: `pnpm test:web:unit`, `pnpm test:web:trpc`, `pnpm test:web:api`; use `pnpm test:web` for default non-integration coverage.
- Test file conventions: `*.unit.test.ts`, `*.trpc.test.ts`, `*.api.test.ts`, `*.integration.test.ts`.
- Integration tests require infra and env (`RUN_INTEGRATION=true` with Postgres/Redis available). Root commands `pnpm test:web:all` and `pnpm test:web:integration:full` auto-manage infra lifecycle.
- Use `pnpm test:infra:up` / `pnpm test:infra:down` when running targeted integration commands manually.
- `pnpm test:web:integration:full` and `test:integration:prepare` run Prisma migrations (`prisma migrate deploy`); never run these unless the user explicitly asks.
- Test defaults are cloud mode (`NEXT_PUBLIC_IS_CLOUD=true`); keep new tests compatible with cloud behavior unless the task says otherwise.

## Commit & Pull Request Guidelines

- Prefer Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`). Git history shows frequent feat/fix usage.
- PRs must include: clear description, linked issues, screenshots for UI changes, migration notes, and verification steps.
- never run build,migration commands unless asked for
