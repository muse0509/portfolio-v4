<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Web application guide

The repository-wide [AGENTS.md](../../AGENTS.md) also applies. This directory contains the current Next.js / OpenNext application. The future React + TanStack Router Web Worker and its public-page SSR requirement are described in [docs/architecture.md](../../docs/architecture.md) and are not implemented here. Do not substitute TanStack Start or introduce the planned tools during repository organization.

The 2026-10-26 decision formally retains pnpm for package and workspace management: the workspace, CI, and dependency protections are established, and this application does not need Bun-specific features. Continue to use pnpm 11.22.0 with Node.js 24.19.0 and the existing ESLint and Vitest tooling. Bun is not a required migration; re-evaluation is optional only when a concrete need arises. Tool replacement is not a prerequisite for backend validation. Turborepo, Lefthook, Oxlint, and Oxfmt are not installed. See [the decision and historical review](../../docs/package-manager-migration.md). Do not switch tool runtimes or create an app-specific lockfile.

- Read the relevant installed Next.js guides at `node_modules/next/dist/docs/` before writing application code. Resolve this path from `apps/web`, not the repository root.
- Keep the managed Next.js block above intact in this file. Do not duplicate it in the root guide.
- Run repository validation from the root so E2E files remain covered. Web-only commands can be selected explicitly with `pnpm --filter @portfolio-v4/web <command>`.
- Keep TypeScript aliases and generated Next.js types relative to this app; keep `.next`, `.open-next`, and `.wrangler` out of Git.
- Environment samples and types belong here. Local environment files are `.env.local` and `.dev.vars`; never expose or track their real values.
- `wrangler.jsonc` refers to `.open-next/worker.js` and `.open-next/assets` from this app. Root commands delegate here; external build systems must use the workspace root for installation and the documented app configuration for deployment.
- `API` is a Service Binding to `portfolio-v4-api`. `/api/health/backend` calls only its fixed `/health` endpoint and returns a generic unavailable response on failure. Do not add D1 access, a public-URL fallback, or a configurable proxy destination to Web.
- Authentication and `/api/admin/session` use a fixed path/method allowlist through the same Service Binding. The API owns identity, origin checks, Passkey verification, and sessions. Forward only required browser headers; preserve Origin and each Set-Cookie header individually. Never trust browser-supplied administrator IDs, proxy headers, or destinations. Registration permits travel only in the registration header, never query strings or persisted context.
- Keep auth responses uncached and failures generic. Do not expose session tokens or credential records in response JSON, client storage, logs, or test artifacts; retain HttpOnly / SameSite cookie handling and production Secure-cookie behavior.
- Keep Next.js development (`pnpm dev`) distinct from built Worker validation (`pnpm build:worker`, then `pnpm dev:worker`). Use the root `pnpm test:integration` after building Web for real local Worker-to-Worker tests.
- Local auth is fixed to `http://localhost:8788` with RP ID `localhost`: use `pnpm dev --port 8788` or the built `pnpm dev:worker --port 8788` alongside `pnpm dev:api`. Default port 3000 remains suitable for health checks. The final production auth domain is unvalidated.
- Browser authentication validation uses root `pnpm test:e2e:auth` after the Worker build, with port 8788 free. Keep its virtual-authenticator entry page in Playwright fixtures only; do not add a production auth test page or admin UI. Leave trace, screenshot, video, and storage-state capture disabled for auth credentials. Recovery and backup-key UI are not implemented.
- Preserve the existing routes, media, mobile menu, contact API, and development noindex rules during repository reorganization.
