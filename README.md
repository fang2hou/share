# share

A personal relay for moving content across machines — dictate text or drop files on one computer, watch them appear instantly on another, ready to copy or download. Built for people who shuttle snippets between a personal and a work machine all day.

## 🚀 Quick Start

Hand the repository to an AI coding agent:

```text
Read AGENTS.md and work according to the commands and conventions it defines.
```

Run it yourself:

```bash
mise install          # Node 24, pnpm, prek, cocogitto
pnpm install
cp .dev.vars.example .dev.vars   # fill in GitHub OAuth app credentials and SESSION_SECRET
mise run test         # quality gate + full test suite
mise run dev:worker   # worker on 8787 (local DO + R2 simulation)
mise run dev          # Vite frontend on 5173 (proxies /api and /auth)
```

Expected result: open http://localhost:5173, sign in with GitHub, and the app is live.

Deploying: `mise run deploy`. This expects a wrangler login, the R2 bucket `share-files`, and three worker secrets configured once — see DEVELOPMENT.md.

## ✨ Features

- **Text blocks** — Shift+Enter to send (IME-safe), editable, one-click copy
- **Files** — drag, paste, or pick; multiple files auto-package into one zip; 75 MB cap
- **Realtime** — WebSocket push with automatic reconnect and polling fallback
- **Share links** — per-item public links (`/f/<sub>.<token>`) that work without login; optional download budget; revoke anytime
- **Day grouping** — today and yesterday expanded, older days collapsed, cursor pagination loads history on demand
- **Permanent retention** — items stay until you remove them
- **Trilingual UI** — zh-CN / ja / en, follows the browser language with a manual switch
- **Isolation** — GitHub sign-in, one private Durable Object space per user

## ⚡ Performance

First paint is a single HTML round trip: the worker injects the initial list into the shell, so no second data request happens. One long-cached JS bundle, inlined CSS, no web fonts. Cross-tab sync measured at 2–6 ms locally.

## 📚 Learn More

| Goal                | Read            |
| ------------------- | --------------- |
| Development worship | DEVELOPMENT.md  |
| Contributing        | CONTRIBUTING.md |
| Architecture        | ARCHITECTURE.md |
| Agent conventions   | AGENTS.md       |

## 📄 License

MIT
