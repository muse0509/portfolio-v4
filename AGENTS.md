<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Portfolio V4 agent guide

## Purpose

Portfolio V4 is a Japanese portfolio for winning contract work. It positions the owner as a full-stack engineer who understands the business and carries 0→1 delivery through implementation.

## Stack

Node.js 24, pnpm 11, Next.js App Router, React, strict TypeScript, Tailwind CSS 4, Motion for React, OpenNext for Cloudflare, Wrangler, Vitest, and Playwright.

## Structure

- `src/app`: routes, metadata, robots, and global styles
- `src/content`: reviewed site copy
- `docs`: product, UI workflow, and security decisions
- `e2e`: Playwright smoke tests
- `public/images/concepts`: generated concept candidates only
- `public/images/product`: verified real product captures only

## Commands

- `pnpm dev`: Next.js development server
- `pnpm lint`, `pnpm typecheck`, `pnpm test`: static and unit checks
- `pnpm build:worker`: OpenNext Worker build
- `pnpm test:e2e`: Chromium smoke test
- `pnpm check`: lint, types, unit tests, and Worker build

## Workflow and safeguards

- Branch from `main`; the initial foundation lives on `setup/initial-foundation`.
- Fix UI requirements, generate three desktop/mobile concept directions, compare them, select one, extract tokens and motion rules, then implement React components.
- Never fabricate Axis screens, metrics, or results. Use verified Devnet captures and label them as Devnet with no real-fund trading.
- Never modify `portfolio_no.3` or any sibling project.
- Never commit secrets, `.env` files, `.dev.vars`, API keys, private email addresses, or inquiry PII.
- Do not deploy, push, or open a pull request unless the user explicitly requests it.

## Completion criteria

Work is complete only when relevant lint, type, unit, Worker-build, and E2E checks pass; noindex remains enabled during development; documentation matches implementation; the diff contains no secrets or fabricated claims; and the working tree is clean after an intentional local commit.
