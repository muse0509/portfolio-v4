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
- Preserve the existing routes, media, mobile menu, contact API, and development noindex rules during repository reorganization.
