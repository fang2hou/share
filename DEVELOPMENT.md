# Development

## Workflow

1. `mise install && pnpm install` to bootstrap the toolchain.
2. Copy `.dev.vars` from `.dev.vars.example` and fill in `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (GitHub → Settings → Developer settings → OAuth Apps), `SESSION_SECRET` (`openssl rand -base64 32`), and `APP_ORIGIN=http://localhost:5173`.

   With the placeholder `dev-placeholder` credentials left in place, `/auth/login` skips GitHub and issues a local session directly (user `local-dev`), so the full product flow works without an OAuth app. Real credentials always take the real OAuth path.

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

`test/worker.test.ts` runs the whole worker inside a real miniflare runtime: auth, item CRUD and idempotency, pagination, WebSocket broadcasts, file upload/download, share links (password gates, grant invalidation, attempt limits, public access counting, budgets, revocation, uniform 404s, collections, selective ZIP streaming), cross-user isolation, and homepage injection with XSS escaping. Touching the worker or `shared/` requires a green run before commit.

## Deploying

Deployments happen in CI, never from a local machine. The Deploy job in `.github/workflows/ci.yml` runs after Validate and Validate commit history pass on every push to `main` — in practice: open a PR, let validation pass, merge (squash), and the worker deploys automatically to https://share.fang2hou.com.

One-time setup (already done):

1. Cloudflare API token `share-github-actions-deploy` (Edit Cloudflare Workers template, scoped to account `fang2hou` + zone `fang2hou.com`), stored as the `CLOUDFLARE_API_TOKEN` repo secret; account id as `CLOUDFLARE_ACCOUNT_ID`.
2. Worker secrets: `wrangler secret put GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`; OAuth app Redirect URI `https://share.fang2hou.com/auth/callback`.
3. R2 bucket `share-files`.

After changing any binding in `wrangler.jsonc`, run `pnpm cf-typegen` and commit the regenerated `worker-configuration.d.ts`. `mise run deploy` still exists for emergencies and requires a Cloudflare login.

## Verification

Local and CI run the exact same commands: `mise run check` and `mise run test` (CI additionally runs `cog check`). A command that passes locally but fails in CI means the environments diverged — realign them instead of adding CI-only fixes.

## Shared public UI

`shared/ui/` owns components used by both the SPA and the public share views. Edit these components once; do not add Worker HTML templates or separate public versions of the header, language menu, or file browser. `pnpm build` produces both the SvelteKit shell and the public Svelte SSR/client artifacts. `mise run dev:worker` prepares the public artifacts, and Vite rebuilds them when shared UI or CSS changes. Generated renderers and hashed assets are not committed.

## Styling

Use Tailwind utilities in component markup for layout, typography, responsive sizing, and interaction states. Define shared font and color tokens with `@theme` in `src/app.css`; keep document defaults in `@layer base`. Register custom utilities with `@utility` only for behavior without a built-in utility, such as continuous corners and scrollbar styling. Keep scoped CSS for transitions that need coordinated timing, and global component CSS for generated Shiki markup and View Transition pseudo-elements.

Use inline styles for values calculated at runtime, such as upload progress, scroll thumb positions, and item transition names. Text inputs use `text-base` by default and smaller text only with `pointer-fine`, keeping touch inputs readable without iOS focus zoom. Use `font-sans` for localized UI copy and placeholders, and `font-mono` for filenames, extensions, and code; both resolve through the shared theme and font fallback.
