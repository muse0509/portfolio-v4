# Portfolio V4 agent guide

## Purpose and current state

Portfolio V4 presents Yusuke Kikuta’s development work, responsibilities, and design decisions for engineering hiring, centered on Solana and DeFi experience. Profiles and project records are managed in code. Blog posts will be managed through a custom admin UI and database in a later phase.

The current implementation is the existing Next.js App Router / OpenNext application in `apps/web`, managed with pnpm workspace, including the existing contact API. See [README.md](README.md) for the current structure and [docs/architecture.md](docs/architecture.md) for future adoption policy, responsibilities, validation questions, and migration order.

The future design uses TypeScript, React + TanStack Router, Hono, oRPC, Better Auth with its Passkey plugin, Cloudflare D1 (SQLite), and Drizzle ORM. Separate Web and API Workers communicate through Service Binding. DB, private R2 storage, and Cloudflare Images Workers bindings belong to the API Worker; use Workers Static Assets for static files and Workers Logs for logs. This design is not implemented. Public-page SSR is a future requirement; do not substitute TanStack Start for TanStack Router.

The 2026-10-26 decision is to continue using pnpm for package and workspace management in both the current and future architecture. The existing workspace, CI, and dependency protections are established, and this application does not require Bun-specific features. Bun migration is not a required future task; reconsider it only as an optional evaluation when a concrete need arises.

Turborepo, Lefthook, Oxlint, and Oxfmt remain uninstalled candidates. Keep the existing ESLint and Vitest tooling. Neither Bun migration nor replacing development tools is a prerequisite for backend foundation and authentication validation. Better T Stack is reference material only; never run its generator against this repository as part of organization work.

See [docs/package-manager-migration.md](docs/package-manager-migration.md) for the current decision and the preserved 2026-10-24 Bun 1.4.4 review, which put migration on hold at that time. The historical options are not required follow-up tasks. Preserve all existing protections in any future evaluation; frozen installs alone do not establish equivalence. Do not add unsupported Bun settings, broaden lifecycle trust, or introduce a custom auditor, external service, or dual package management as a workaround in this task.

## Stack and structure

Keep the existing Node.js 24.19.0, pnpm 11.22.0, and dependency versions unless the task explicitly requests an update. Preserve `minimumReleaseAge`, `minimumReleaseAgeStrict`, `minimumReleaseAgeIgnoreMissingTime`, `trustLockfile`, `overrides`, and `allowBuilds`. Keep the root `pnpm-lock.yaml` as the only lockfile; do not add Bun, npm, Yarn, or app-specific lockfiles.

- `apps/web`: Next.js, React, strict TypeScript, Tailwind CSS, Motion, OpenNext, Wrangler, and Vitest
- `apps/web/src/app`: routes, metadata, robots, and the existing contact API
- `apps/web/src/content`: reviewed site copy, profile, and project records
- `apps/web/public/images/concepts`: generated concept candidates only
- `apps/web/public/images/product`: verified real product captures only
- `e2e` and `playwright.config.ts`: repository-level Playwright smoke tests
- `docs`: requirements, design history, UI workflow, and security decisions
- Root `package.json`, `pnpm-workspace.yaml`, and the single `pnpm-lock.yaml`: workspace management

Read [apps/web/AGENTS.md](apps/web/AGENTS.md) before changing the web application. Its Next.js guide resolves from `apps/web/node_modules/next/dist/docs/`. Keep application-specific configuration, environment samples, and generated types in `apps/web`. Do not create `apps/api` or `packages/contracts` until their implementation phase.

## Commands

Run from the repository root:

- `pnpm install --frozen-lockfile`: install the workspace
- `pnpm dev`: explicitly delegates to `@portfolio-v4/web`; arguments such as `--hostname 127.0.0.1 --port 3100` pass through
- `pnpm lint`, `pnpm typecheck`: check both the web application and root E2E code/configuration
- `pnpm test`: web unit tests, including mocked contact processing
- `pnpm build:worker`: OpenNext Worker build
- `pnpm test:e2e`: Chromium smoke tests
- `pnpm check`: lint, types, unit tests, and Worker build; run E2E separately

The root owns E2E dependencies and validation; do not silently drop `e2e` or `playwright.config.ts` from lint or type checking. App environment files load from `apps/web/.env.local` and `apps/web/.dev.vars`.

## Workflow and safeguards

- Work in this order: repository organization (completed, with uncommitted changes) → backend foundation and authentication validation → blog API → frontend implementation. The current task updates documentation only.
- For future UI work, fix requirements, generate three desktop/mobile concept directions, compare them, select one, extract tokens and motion rules, and review the specification before implementation.
- Existing requirements and Product Cinema documents preserve earlier decisions; current purpose is defined in README and future design is defined in `docs/architecture.md`. Repository organization must preserve UI, copy, assets, animation, and the contact API.
- Never fabricate Axis screens, metrics, or results. Use verified Devnet captures and label them as Devnet with no real-fund trading.
- Never modify `portfolio_no.3` or any sibling project.
- Never expose, copy into tracked files, or commit secrets, real `.env`/`.dev.vars` files, API keys, private email addresses, or inquiry PII. Keep only dummy values in environment samples.
- Use the existing contact mocks during verification; do not send real email.
- Preserve user changes. Inspect the current branch and working tree before work. Only create, switch, or delete branches, commit, push, open a PR, or deploy when explicitly requested. When a new branch is requested, base it on `main` unless instructed otherwise; the initial foundation is recorded on `setup/initial-foundation`.
- Do not modify external Cloudflare settings as part of local repository organization. Do not reset, clean, restore, check out over, or stash user changes.
- Do not invent unspecified limits, authentication lifetimes, or backup retention periods. Record them as open decisions for the appropriate validation phase.
- This organization task ends with reviewable changes; do not automatically continue into backend or frontend implementation.

## Completion criteria

Relevant lint, type, unit, Worker-build, and E2E checks must pass; noindex must remain enabled during development; documentation must match implementation; and the diff must contain no secrets or fabricated claims. Record pre-existing failures and blocked or unperformed verification accurately, keeping prior validation history distinct from the current run. Match behavior claims to existing test coverage. Do not disable tests or change dependencies, fonts, or UI to conceal failures.

Leave a reviewable uncommitted diff unless the user explicitly requests a commit. For the workspace reorganization, do not perform branch operations, commit, push, create a PR, or deploy.
