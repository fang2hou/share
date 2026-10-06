# Architecture

## Overview

A single Cloudflare Worker does three jobs: it serves the prerendered SvelteKit SPA shell, handles `/api/*` and `/auth/*`, and exports the per-user Durable Object class. Item text lives in the DO's SQLite; file bytes live in R2; realtime updates ride the DO's WebSocket hibernation.

## Code map

- `shared/` — the only frontend/worker contract: `protocol.ts` (types and constants), `i18n.ts` (message catalogs for three locales)
- `worker/index.ts` — routing: homepage bootstrap injection, `/api/items|files|ws`, public share path `/f/<sub>.<token>`
- `worker/auth.ts` — HMAC sessions, GitHub OAuth callback, origin checks
- `worker/space.ts` — the Space DO: item CRUD, pagination, share tokens and budgets, broadcasts
- `src/lib/space.svelte.ts` — client state: optimistic inserts, WS heartbeat/reconnect/polling fallback, upload progress
- `src/lib/files.ts` — upload payload construction (single passthrough, multi-file zip)
- `src/routes/+page.svelte` — composition: composer, day groups, uploads, language switch

## Invariants

1. Isolation: every `/api/*` request derives its DO from the session `sub` (`gh:<githubId>`); there is no cross-user read path.
2. First paint: `GET /` is a single round trip — the HTMLRewriter-injected bootstrap is the only initial data source, and `<` must be escaped as `\u003c`.
3. Share links: the path is the capability. Tokens are 16 random bytes; not enabled, wrong token, and exhausted budget all return an indistinguishable 404; public responses are `no-store`.
4. Write protection: POST/PATCH and the WS upgrade must pass `originAllowed`; authenticated downloads reject `Sec-Fetch-Site: cross-site`.
5. The DO schema only gains columns (idempotent ALTERs); existing instances upgrade in place without data loss.
6. Retention is permanent; any deletion capability must be explicit user action, never implicit cleanup.
