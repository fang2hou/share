# Architecture

## Overview

A single Cloudflare Worker does three jobs: it serves the prerendered SvelteKit SPA shell, handles `/api/*` and `/auth/*`, and exports the per-user Durable Object class. Item text lives in the DO's SQLite; file bytes live in R2; realtime updates ride the DO's WebSocket hibernation.

## Code map

- `shared/` — the only frontend/worker contract: `protocol.ts` (types and constants), `i18n.ts` (message catalogs for five locales), `file-preview.ts` (safe preview classification), `format.ts` (file sizes)
- `worker/index.ts` — routing: homepage bootstrap injection, `/api/items|files|ws`, public share path `/f/<sub>.<token>` (noindex but fully OG-tagged for link previews)
- `worker/auth.ts` — HMAC sessions, GitHub OAuth callback, origin checks
- `worker/space.ts` — the Space DO: item CRUD, pagination, share tokens and budgets, broadcasts
- `src/lib/space.svelte.ts` — client state: optimistic inserts, WS heartbeat/reconnect/polling fallback, upload progress
- `worker/file-transfer.ts` — file responses, byte ranges, and streaming ZIP archives
- `worker/share-password.ts` — salted password hashes and share-scoped unlock cookies
- `worker/share-view.ts` — localized password gates and public file-selection pages
- `src/lib/stage.svelte.ts` — independent file staging, upload IDs, and collection retry state
- `src/routes/+page.svelte` — composition: composer, day groups, uploads, language switch

## Invariants

1. Isolation: every `/api/*` request derives its DO from the session `sub` (`gh:<githubId>`); there is no cross-user read path.
2. First paint: `GET /` is a single round trip — the HTMLRewriter-injected bootstrap is the only initial data source, and `<` must be escaped as `\u003c`.
3. Share links: the path is the capability. Tokens are 16 random bytes; not enabled, wrong token, and exhausted budget all return an indistinguishable 404; public responses are `no-store`. Optional passwords use salted PBKDF2-SHA256 hashes; content is served only after a share-scoped HMAC grant passes validation. Grants expire after one hour and password changes invalidate them. Unlock failures are limited to ten per minute per share.
4. Write protection: POST/PATCH and the WS upgrade must pass `originAllowed`; authenticated downloads reject `Sec-Fetch-Site: cross-site`.
5. The DO schema only gains columns (idempotent ALTERs); existing instances upgrade in place without data loss.
6. Retention is permanent; any deletion capability must be explicit user action, never implicit cleanup.

## File collections

Each upload stores one R2 object. Collections retain a JSON manifest in the additive `files_json` column; file IDs and collection IDs stay stable across retries. Collection membership is checked before transfers, and deleting a collection removes every member object. Existing single-file items and direct share downloads continue to work.

The owner and public file pages support individual downloads, selections, ZIP archives, and safe media/text previews. ZIP archives stream from R2 with backpressure using standard ZIP entries; selections requiring ZIP64 are rejected. Raster images, audio, video, PDFs, and text can be previewed. HTML/XML are served as plain text and SVG remains an attachment. Byte ranges support media seeking.

A public file listing and password prompt do not consume the access budget. Each content transfer, including a preview or range request, consumes one access; one ZIP response consumes one access for the whole selection. Protected file names and content do not appear on the password gate.
