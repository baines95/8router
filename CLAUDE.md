# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root app (Next.js dashboard + API)
- Install: `npm install`
- Dev (port 20128): `npm run dev`
- Type-check: `./node_modules/.bin/tsc --noEmit`
- Build: `npm run build`
- Start prod: `npm run start`
- Bun variants: `npm run dev:bun`, `npm run build:bun`, `npm run start:bun`
- Note: do not use `next build --no-lint` (invalid flag in this setup)

Common local run env (from README):
- `PORT=20128 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run dev`

### Cloud worker (`cloud/`)
- Install: `cd cloud && npm install`
- Dev: `npm run dev`
- Deploy: `npm run deploy`

Typical setup uses Wrangler KV + D1 migration:
- `wrangler login`
- `wrangler kv namespace create KV`
- `wrangler d1 create proxy-db`
- `wrangler d1 execute proxy-db --remote --file=./migrations/0001_init.sql`

### Tests (`tests/`, Vitest)
- Install: `cd tests && npm install`
- All tests: `npm test`
- Watch: `npm run test:watch`
- Single file:
  - `NODE_PATH=/tmp/node_modules /tmp/node_modules/.bin/vitest run unit/embeddingsCore.test.js --reporter=verbose --config ./vitest.config.js`
  - `NODE_PATH=/tmp/node_modules /tmp/node_modules/.bin/vitest run unit/usage-live-ticker.test.js --reporter=verbose --config ./vitest.config.js`
  - `NODE_PATH=/tmp/node_modules /tmp/node_modules/.bin/vitest run unit/usage-live-stats-merge.test.js --reporter=verbose --config ./vitest.config.js`

## Big-picture architecture

8Router is a local-first AI router exposing an OpenAI-compatible endpoint (`/v1`) plus a web dashboard.

Request flow:
1. Client tools call `http://localhost:20128/v1`.
2. Router normalizes/translates payloads and applies combo/fallback routing.
3. Provider auth/token refresh and account selection are handled per integration.
4. Compatible response/stream is returned; usage/quota is tracked.

Main parts:
- **Root Next.js app**: dashboard UI + server routes (including `/v1`).
- **Routing/translation layer**: OpenAI-style interface to provider-specific behavior.
- **Persistence**: file-based local state (LowDB JSON) for providers/combos/settings/keys; separate usage/log storage.
- **`cloud/` worker**: Cloudflare Worker path for cloud deployment/sync scenarios.
- **`tests/` project**: embeddings-focused Vitest suite (`/v1/embeddings` core + cloud handler behavior).

## Important repo notes

- Default dashboard: `http://localhost:20128/dashboard`
- Default API base: `http://localhost:20128/v1`
- Docs indicate preferring server-side `BASE_URL` and `CLOUD_URL` for cloud runtime behavior.
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` currently present.
- `/dashboard/usage` uses `useSearchParams`; keep client page wrapped by `Suspense` in `src/app/(dashboard)/dashboard/usage/page.tsx` to avoid prerender build errors.
- For high-frequency live UI updates (usage stream), prefer no-op guards (return previous state reference when payload unchanged) to prevent unnecessary rerenders.

## MCP & Skills policy (stable)

- Do not list volatile plugin inventory in this file.
- Keep only stable policy here: when using shadcn components/registry/docs, prefer shadcn MCP tools first.
- Use Context7 for up-to-date library/framework/API docs lookups when implementation depends on current docs.
- Runtime plugin install/reload state should be checked via `/plugin`, `/skills`, `/mcp` (not persisted in `CLAUDE.md`).

## Claude workflow note

- Press `#` during a Claude session to quickly fold validated learnings into `CLAUDE.md`.
- Keep updates concise, project-specific, and copy-paste actionable.

## UI default ruler (mandatory)

- All UI work must follow shadcn preset `buFznsW`: https://ui.shadcn.com/create?preset=buFznsW
- Keep using `@/components/ui/*` primitives and existing project tokens/variants; avoid introducing a parallel visual system.
- Icon system is fixed to **Phosphor** (`@phosphor-icons/react`), matching `components.json` (`iconLibrary: "phosphor"`).
- For UI edits, prefer consistency with existing shadcn spacing, radius, border, typography, and interaction patterns over ad-hoc custom styling.
- Do not switch to other icon packs (lucide/heroicons/etc.) unless explicitly requested by the user.
- When restyling an existing screen, keep behavior and data flow unchanged unless the task explicitly asks for behavior changes.
- If icon deprecation warnings appear from `@phosphor-icons/react`, treat as non-blocking unless they break build/type-check.
- For UI/frontend changes, verify by running dev server and testing the page interaction path, not only type-check/build.

## UI default ruler (mandatory)

- All UI work must follow shadcn preset `buFznsW`: https://ui.shadcn.com/create?preset=buFznsW
- Keep using `@/components/ui/*` primitives and existing project tokens/variants; avoid introducing a parallel visual system.
- Icon system is fixed to **Phosphor** (`@phosphor-icons/react`), matching `components.json` (`iconLibrary: "phosphor"`).
- For UI edits, prefer consistency with existing shadcn spacing, radius, border, typography, and interaction patterns over ad-hoc custom styling.
- Do not switch to other icon packs (lucide/heroicons/etc.) unless explicitly requested by the user.
- When restyling an existing screen, keep behavior and data flow unchanged unless the task explicitly asks for behavior changes.
