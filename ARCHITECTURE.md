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
- `worker/share-view.ts` — public document envelope, safe bootstrap serialization, and response security headers
- `shared/ui/` — the single Svelte source for the header, logo, language and mode controls, icons, and file browser; both the SPA and public pages import these components
- `shared/ui/PublicPage.svelte` — public password, file, and text views, server-rendered in the Worker and hydrated in the browser
- `scripts/build-public.mjs` — compiles the same public Svelte tree into a Worker SSR module and hashed client assets; generated files are ignored
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

## Link previews

Discord's crawler receives the public SPA shell at `/` without a session or private bootstrap data, so the website card uses the existing `static/og.png`. Human visitors retain the login redirect. Public share pages include server-rendered Open Graph and Twitter metadata in the visitor's language. Legacy single-file links still download directly for human visitors; Discord receives the file listing instead. Discord text previews use the same capability validation without consuming an access.

Unprotected files advertise `/f/<sub>.<token>/og.png?lang=<locale>`. The Worker renders a 1200×630 PNG with resvg WASM using the existing brand palette, file names, MIME type, size, or collection count and total size. Long names are bounded to two lines, and all dynamic SVG text is XML-escaped. Fonts are fetched from the static-assets binding, never from third-party services. The PNG route inspects the live share before rendering, consumes no access, and returns no-store/noindex responses. Revoked, exhausted, missing, and password-protected shares return the same 404; unlock cookies cannot make protected image URLs public. Password gates and unlocked protected pages use the generic brand image.

## Public-page rendering

The SPA and public pages compose `AppHeader.svelte` and `FileBrowser.svelte` directly. Component markup, interaction logic, language persistence, fonts, and the stylesheet have one source. Public pages use Svelte `render` in the Worker and `hydrate` in the browser; the Worker contains no hand-written UI or inline event script.

`pnpm build` builds the SvelteKit shell first, then compiles the public component twice for server and browser targets. Public client assets live under `build/_public/`; the generated Worker renderer includes their hashed asset URLs. Development rebuilds public artifacts when shared UI or application CSS changes. No deployment bindings or routing configuration are changed.

The password gate receives only the locale and share path. Protected item content and file metadata enter the renderer only after the Worker validates the grant. JSON bootstrap data escapes `<` before entering the document. Public pages retain no-store, noindex, uniform 404 behavior and use a self-only script CSP. A password form remains usable without JavaScript, while selection, previews, and language changes hydrate through Svelte.

Both entry points use `ReadyFrame.svelte` to hide the first frame while the restored locale and its fonts settle. A three-dot status indicator appears during that wait. Font loading is bounded to 1.8 seconds; on failure or timeout, the frame uses system fonts for the remainder of its lifetime so late font arrivals cannot move visible content. No-JavaScript public pages reveal the server-rendered content through a noscript style.

Files are limited to 256 MiB. The client sends files larger than 32 MiB through owner-scoped R2 multipart sessions, with 32 MiB requests and aggregate progress. Completion streams the staging object into an immutable final key before publishing the item. Failed transfers abort their multipart session; inaccessible abandoned parts expire through R2 after seven days. Session manifests expire after one hour and are cleaned up when accessed. Text files up to 10 MiB can be previewed in ranged, UTF-8-safe 256 KiB sections. Larger text files are download-only; both the shared UI and Worker enforce this preview limit. Image, audio, video, and PDF previews retain the 256 MiB file limit.
