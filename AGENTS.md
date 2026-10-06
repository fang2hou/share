# AGENTS.md

share is a personal cross-device content relay: a Cloudflare Worker (one SQLite Durable Object per user, plus R2) hosting a SvelteKit 3 SPA shell.

## Commands

```bash
mise install                # toolchain: Node 24, pnpm 12, prek, cocogitto
mise run dev                # Vite on 5173 (proxies /api and /auth to 8787)
mise run dev:worker         # wrangler dev on 8787 (local DO/R2 simulation)
mise run check              # fast gate without tests
pnpm vitest run test/worker.test.ts -t "share"   # one test by name
mise run deploy             # build and deploy to Cloudflare
pnpm cf-typegen             # regenerate types after changing wrangler.jsonc
```

## Engineering standards

Follow the [ai-coding-guidelines](https://github.com/fang2hou/ai-coding-guidelines). Approved exceptions:

- SvelteKit 3.0 prerelease line: validating this stack is a stated goal of the project; upgrade the kit / vite-plugin / adapter trio together.
- Hand-rolled UI (Tailwind v4 utilities + inline Lucide paths) instead of DaisyUI / shadcn-svelte: the whole UI is six small components and bundle size wins.
- oxfmt's default style (2-space, double quotes) owns every TS/JS file; never fight the formatter.
- oxlint stable does not yet lint `.svelte` files (verified against 1.87.0; the oxc docs describe an unreleased capability). `.svelte` script blocks are covered by `svelte-check` and the Svelte MCP autofixer. oxfmt formats `.svelte` files (`"svelte": true` in `.oxfmtrc.json`).

## Layout

- `shared/` — the only code imported by both sides: `protocol.ts` (types, constants) and `i18n.ts` (message catalogs)
- `worker/` — Cloudflare Worker: `index.ts` routing, `auth.ts` sessions and GitHub OAuth, `space.ts` the Durable Object
- `src/lib/` — frontend-only library: `space.svelte.ts` (state, WS, uploads), `files.ts` (upload payload), `time.ts`, UI components
- `src/routes/` — the SPA page (SSR off, prerendered shell)
- `test/` — vitest-pool-workers integration tests against a real miniflare runtime

## Boundaries

- Always do: run `pnpm cf-typegen` after touching `wrangler.jsonc`; run the svelte autofixer after editing any `.svelte` file; write Conventional Commits (enforced by prek and `cog check`).
- Never do: commit `.dev.vars` or any secret; bypass `mise run check`; change the DO schema without an idempotent migration (existing DO instances must upgrade in place).
- Ask first: new runtime dependencies; changes to auth, share links, or cross-user isolation; deployment configuration.

## Language policy (confirmed)

- Code, comments, and commit messages: English.
- All project documents: English. Non-English text appears only inside localization catalogs (`shared/i18n.ts`) and localized test fixtures.
- UI copy: zh-CN / ja / en fully supported, follows the browser language with a manual persistent switch; Japanese copy is written natively, never translated from Chinese.
- The public share page renders in the visitor's Accept-Language.

## Project conventions

- Everything shared between frontend and worker lives in `shared/` and nowhere else; the worker imports it with explicit `../shared/*.ts` paths.
- The DO schema evolves by adding columns only (idempotent ALTER TABLE guarded by PRAGMA); never rename or drop columns.
- Share tokens are 16 random bytes; the path is the capability — every failure mode returns an indistinguishable 404.
- The session cookie `ts_session` is HMAC-SHA256 with a 30-day lifetime; every write and the WS upgrade must pass `originAllowed`.

## Further docs

DEVELOPMENT.md (workflow and deploy), CONTRIBUTING.md (PRs and checks), ARCHITECTURE.md (boundaries and invariants).
