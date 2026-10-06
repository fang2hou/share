<div align="center">

# share

A personal relay for moving text and files between your own machines, in real time.

[![CI](https://github.com/fang2hou/share/actions/workflows/ci.yml/badge.svg)](https://github.com/fang2hou/share/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

</div>

share is for anyone who juggles two computers — dictate text on one, watch it appear on the other, ready to copy or download. It is a single Cloudflare Worker backed by per-user Durable Objects and R2; sign in with a GitHub account and your space is isolated from everyone else's.

## 🚀 Quick Start

**With an AI coding agent** — paste this into the agent to hand it the repository:

```text
Work in this repository. Read AGENTS.md at the repository root first and follow it.
```

**As a human** — requires [mise](https://mise.jdx.dev/) on macOS or Linux. Runtime versions are pinned in `mise.toml`; local sign-in additionally needs a GitHub OAuth app and a session secret in `.dev.vars` (copy from `.dev.vars.example`).

```bash
mise install
mise run dev:worker   # worker on 8787 (local DO + R2 simulation)
mise run dev          # frontend on 5173, proxying /api and /auth
```

Open http://localhost:5173 and sign in with GitHub. `mise run` lists every other task (`test`, `check`, `build`, `deploy`).

<details>
<summary>Advanced setup</summary>

- `mise run preview` builds the SPA shell and serves it from the worker on 8787 — closest to production.
- Deploying requires a wrangler login, the R2 bucket `share-files`, and the three worker secrets; see DEVELOPMENT.md.
- The full quality gate is `mise run test` — lint, format check, typecheck, then the worker test suite.

</details>

## ✨ Features

- **Text blocks** — Shift+Enter to send (IME-safe), editable, one-click copy
- **Code snippets** — optional filename and language suffix per text block; recognized languages get syntax highlighting (lazy highlight.js, one small chunk per language) and a language tag; a filename adds a download action
  to the item menu
- **Files** — drag, paste, or pick; multiple files auto-package into one zip; 75 MB cap with live progress
- **Realtime** — WebSocket push with automatic reconnect and polling fallback
- **Share links** — per-item public URLs (`/f/<sub>.<token>`) that work without login; optional download budget; revoke anytime; rich social-preview cards, excluded from search indexes
- **Day grouping** — today and yesterday expanded, older days collapsed, history loads on demand
- **Permanent retention** — items stay until you remove them
- **Five-language UI** — 简体中文 / 繁體中文 / 日本語 / 한국어 / English, follows the browser language with a manual switch

## ⚡ Performance

First paint is a single HTML round trip: the worker injects the initial list into the prerendered shell, so no second data request happens before the list is visible.

Evidence: long-cached JS chunks (the split bundle keeps highlighting grammars out of the initial load), CSS inlined into the shell, zero web-font requests; cross-tab push latency measured at 2–6 ms against a local
wrangler dev worker (Apple M-series, Node 24, 2026-10).

## 📚 Learn More

| Goal                  | Read                                 |
| --------------------- | ------------------------------------ |
| Understand the system | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Develop and validate  | [DEVELOPMENT.md](./DEVELOPMENT.md)   |
| Contribute a change   | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Give it to an agent   | [AGENTS.md](./AGENTS.md)             |

## 📄 License

MIT — see [LICENSE](./LICENSE).
