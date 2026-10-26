# Portfolio V4 agent guide

## Purpose and current state

Portfolio V4 presents Yusuke Kikuta’s development work, responsibilities, and design decisions for engineering hiring, centered on Solana and DeFi experience. Profiles and project records are managed in code. Blog posts will be managed through a custom admin UI and database in a later phase.

The current implementation includes the existing Next.js App Router / OpenNext application in `apps/web`, its contact API, and a Hono API Worker in `apps/api`, managed with pnpm workspace. The API foundation connects to local D1 through Drizzle and is reached from Web through Service Binding. See [README.md](README.md) for current structure and commands. Existing `docs/` files preserve earlier decisions; detailed design, investigation, and work logs are maintained outside this repository.

The future design uses TypeScript, React + TanStack Router, Hono, oRPC, Better Auth with its Passkey plugin, Cloudflare D1 (SQLite), and Drizzle ORM. Only the Hono/D1/Drizzle foundation and local Web/API Service Binding are implemented. Authentication, blog features, oRPC, and the future frontend remain unimplemented. DB, private R2 storage, and Cloudflare Images Workers bindings belong to the API Worker; use Workers Static Assets for static files and Workers Logs for logs. Public-page SSR is a future requirement; do not substitute TanStack Start for TanStack Router.

The 2026-10-26 decision is to continue using pnpm for package and workspace management in both the current and future architecture. The existing workspace, CI, and dependency protections are established, and this application does not require Bun-specific features. Bun migration is not a required future task; reconsider it only as an optional evaluation when a concrete need arises.

Turborepo, Lefthook, Oxlint, and Oxfmt remain uninstalled candidates. Keep the existing ESLint and Vitest tooling. Neither Bun migration nor replacing development tools is a prerequisite for backend foundation and authentication validation. Better T Stack is reference material only; never run its generator against this repository as part of organization work.

See [docs/package-manager-migration.md](docs/package-manager-migration.md) for the current decision and the preserved 2026-10-24 Bun 1.4.4 review, which put migration on hold at that time. The historical options are not required follow-up tasks. Preserve all existing protections in any future evaluation; frozen installs alone do not establish equivalence. Do not add unsupported Bun settings, broaden lifecycle trust, or introduce a custom auditor, external service, or dual package management as a workaround in this task.

## Stack and structure

Keep the existing Node.js 24.19.0, pnpm 11.22.0, and dependency versions unless the task explicitly requests an update. Preserve `minimumReleaseAge`, `minimumReleaseAgeStrict`, `minimumReleaseAgeIgnoreMissingTime`, `trustLockfile`, `overrides`, and `allowBuilds`. Keep the root `pnpm-lock.yaml` as the only lockfile; do not add Bun, npm, Yarn, or app-specific lockfiles.

- `apps/web`: Next.js, React, strict TypeScript, Tailwind CSS, Motion, OpenNext, Wrangler, and Vitest
- `apps/api`: Hono Worker, Drizzle connection to local D1, generated binding types, and local Worker tests
- `apps/web/src/app`: routes, metadata, robots, and the existing contact API
- `apps/web/src/content`: reviewed site copy, profile, and project records
- `apps/web/public/images/concepts`: generated concept candidates only
- `apps/web/public/images/product`: verified real product captures only
- `e2e` and `playwright.config.ts`: repository-level Playwright smoke tests
- `docs`: requirements, design history, UI workflow, and security decisions
- Root `package.json`, `pnpm-workspace.yaml`, and the single `pnpm-lock.yaml`: workspace management

Read [apps/web/AGENTS.md](apps/web/AGENTS.md) before changing the web application and [apps/api/AGENTS.md](apps/api/AGENTS.md) before changing the API. The Next.js guide resolves from `apps/web/node_modules/next/dist/docs/`. Keep each application's configuration and generated types in its own directory. Do not create `packages/contracts` until its implementation phase.

## Commands

Run from the repository root:

- `pnpm install --frozen-lockfile`: install the workspace
- `pnpm dev`: explicitly delegates to `@portfolio-v4/web`; arguments such as `--hostname 127.0.0.1 --port 3100` pass through
- `pnpm dev:api`: local API Worker and D1; `pnpm dev:worker`: local built OpenNext Worker
- `pnpm lint`, `pnpm typecheck`: check Web, API, and root E2E code/configuration
- `pnpm test`: web unit tests, including mocked contact processing
- `pnpm build:worker`: OpenNext Worker build
- `pnpm test:api`, `pnpm build:api`: API tests and local dry-run build
- `pnpm test:integration`: built Web/API Service Binding and D1 tests; build Web first
- `pnpm test:e2e`: Chromium smoke tests
- `pnpm check`: lint, types, Web/API tests, both Worker builds, and integration tests; run E2E separately

The root owns E2E dependencies and validation; do not silently drop `e2e` or `playwright.config.ts` from lint or type checking. App environment files load from `apps/web/.env.local` and `apps/web/.dev.vars`.

## Workflow and safeguards

- Work in this order: repository organization (completed) → backend foundation and authentication validation → blog API → frontend implementation. The current scope is local backend connectivity; authentication and schema/migrations come later.
- For future UI work, fix requirements, generate three desktop/mobile concept directions, compare them, select one, extract tokens and motion rules, and review the specification before implementation.
- Existing requirements, architecture, and Product Cinema documents preserve earlier decisions; current implementation is described in README. Preserve UI, copy, assets, animation, and the contact API. Do not add report-only files or new `docs/` records for this task, or assume access to external design documents.
- Keep D1 access in the API Worker. The Web health route must call only the fixed Service Binding endpoint, never a user-selected proxy destination or remote fallback. Keep API `workers_dev` and `preview_urls` disabled, with no public routes. Local-only verification does not prove deployed reachability.
- Never fabricate Axis screens, metrics, or results. Use verified Devnet captures and label them as Devnet with no real-fund trading.
- Never modify `portfolio_no.3` or any sibling project.
- Never expose, copy into tracked files, or commit secrets, real `.env`/`.dev.vars` files, API keys, private email addresses, or inquiry PII. Keep only dummy values in environment samples.
- Use the existing contact mocks during verification; do not send real email.
- Preserve user changes. Inspect the current branch and working tree before work. Only create, switch, or delete branches, commit, push, open a PR, or deploy when explicitly requested. When a new branch is requested, base it on `main` unless instructed otherwise; the initial foundation is recorded on `setup/initial-foundation`.
- Do not modify external Cloudflare settings as part of local repository organization. Do not reset, clean, restore, check out over, or stash user changes.
- Do not invent unspecified limits, authentication lifetimes, or backup retention periods. Record them as open decisions for the appropriate validation phase.
- Stop after the authorized local foundation and validation; do not proceed into authentication, blog, or frontend implementation.

## Completion criteria

Relevant lint, type, unit, Worker-build, and E2E checks must pass; noindex must remain enabled during development; documentation must match implementation; and the diff must contain no secrets or fabricated claims. Record pre-existing failures and blocked or unperformed verification accurately, keeping prior validation history distinct from the current run. Match behavior claims to existing test coverage. Do not disable tests or change dependencies, fonts, or UI to conceal failures.

Leave a reviewable uncommitted diff unless the user explicitly requests a commit. Branch operations, commits, pushes, PR creation, and deployments each require explicit user authorization.
