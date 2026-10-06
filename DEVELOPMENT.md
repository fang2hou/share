# Development

## Workflow

1. `mise install && pnpm install` to bootstrap the toolchain.
2. Copy `.dev.vars` from `.dev.vars.example` and fill in `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (GitHub → Settings → Developer settings → OAuth Apps), `SESSION_SECRET` (`openssl rand -base64 32`), and `APP_ORIGIN=http://localhost:5173`.
3. Develop with `mise run dev:worker` plus `mise run dev`. For near-production verification use `pnpm preview` (builds, then serves on 8787 with bootstrap injection active).
4. Before committing, run `mise run test` — identical to CI: lint, format check, typecheck, tests.

## Toolchain

| Tool      | Role                                                                                      | Managed by |
| --------- | ----------------------------------------------------------------------------------------- | ---------- |
| Node 24   | Runtime (Active LTS)                                                                      | mise       |
| pnpm 12   | Package manager                                                                           | mise       |
| oxlint    | Linter (`.oxlintrc.json`)                                                                 | pnpm       |
| oxfmt     | Formatter (`.oxfmtrc.json`; TS/JS plus `.svelte` via the embedded prettier-plugin-svelte) | pnpm       |
| vitest    | Tests (`@cloudflare/vitest-pool-workers`)                                                 | pnpm       |
| prek      | Pre-commit hook → `mise run check`                                                        | mise       |
| cocogitto | Conventional Commits validation                                                           | mise       |
| wrangler  | Cloudflare deploy and local simulation                                                    | pnpm       |

## Common mise tasks

`dev`, `dev:worker`, `lint`, `format`, `format:check`, `typecheck`, `check` (lint + format + typecheck), `test` (check, then tests), `build`, `deploy`.

## Testing

`test/worker.test.ts` runs the whole worker inside a real miniflare runtime: auth, item CRUD and idempotency, pagination, WebSocket broadcasts, file upload/download, share links (public access counting, budgets, revocation, uniform 404s), cross-user isolation, and homepage injection with XSS escaping. Touching the worker or `shared/` requires a green run before commit.

## Deploying

1. One-time setup: `wrangler r2 bucket create share-files`; `wrangler secret put GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`; set the OAuth app's Redirect URI to `https://share.fang2hou.com/auth/callback`.
2. `mise run deploy`.
3. After changing any binding in `wrangler.jsonc`, run `pnpm cf-typegen` and commit the regenerated `worker-configuration.d.ts`.

## Verification

Local and CI run the exact same commands: `mise run check` and `mise run test` (CI additionally runs `cog check`). A command that passes locally but fails in CI means the environments diverged — realign them instead of adding CI-only fixes.
