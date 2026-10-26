# API agent guide

Follow the [repository guide](../../AGENTS.md) and current [README commands](../../README.md). Detailed design and work logs are maintained outside the repository; existing `docs/` records predate this API foundation.

This package is the local Hono / Drizzle / D1 foundation. `GET /health` reads `SELECT 1`; no application schema, migrations, authentication, or blog API exists yet. The Next.js contact API remains in `apps/web`.

- Keep the pinned dependency versions and the single root pnpm lockfile.
- Use the local D1 binding. Its all-zero database ID is a placeholder; do not create a remote database or deploy without explicit authorization.
- Keep `workers_dev` and `preview_urls` disabled, omit public routes, and preserve `remote: false` on D1.
- Generate `ApiEnv` with root `pnpm cf-typegen:api` after binding changes; do not hand-edit `cloudflare-env.d.ts`.
- Keep database failures and environment values out of responses and logs.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` in this package. The build command only performs a local Wrangler dry run.
- Tests use Wrangler's local test harness and real local D1 for the successful health check. Failure-path tests must not add production-only test switches or contact external services.
