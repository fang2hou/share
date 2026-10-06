# 开发指南

## 工作流

1. `mise install && pnpm install` 初始化环境。
2. 从 `.dev.vars.example` 复制 `.dev.vars`，填入 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`（GitHub → Settings → Developer settings → OAuth Apps）、`SESSION_SECRET`（`openssl rand -base64 32`）、`APP_ORIGIN=http://localhost:5173`。
3. `mise run dev:worker` + `mise run dev` 双进程开发；接近生产的本地验证用 `pnpm preview`（构建后在 8787 提供服务，支持 bootstrap 注入路径）。
4. 提交前 `mise run test`（含 lint / format / typecheck / 测试，与 CI 完全一致）。

## 工具链

| 工具      | 角色                               | 管理 |
| --------- | ---------------------------------- | ---- |
| Node 24   | 运行时（LTS）                      | mise |
| pnpm      | 包管理                             | mise |
| oxlint    | Lint（`.oxlintrc.json`）           | pnpm |
| oxfmt     | 格式化（`.oxfmtrc.json`）          | pnpm |
| vitest    | 测试（cloudflare:pool-workers）    | pnpm |
| prek      | pre-commit 钩子 → `mise run check` | mise |
| cocogitto | Conventional Commits 校验          | mise |
| wrangler  | Cloudflare 部署与本地模拟          | pnpm |

## 常用 mise 任务

`dev`、`dev:worker`、`lint`、`format`、`format:check`、`typecheck`、`check`（lint+format+typecheck）、`test`（check 之后跑测试）、`build`、`deploy`。

## 测试

`test/worker.test.ts` 在真实 miniflare 运行时里跑完整 Worker：鉴权、条目 CRUD 与幂等、分页、WS 广播、文件上传/下载、外链（公开访问计数、预算、撤销、404 一致性）、跨用户隔离、首页注入与 XSS 转义。改 Worker 或共享协议后必须全绿再提交。

## 部署

1. 前置（一次性）：`wrangler r2 bucket create share-files`；`wrangler secret put GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / SESSION_SECRET`；GitHub OAuth App 的 Redirect URI 填 `https://share.fang2hou.com/auth/callback`。
2. `mise run deploy`。
3. 改动 `wrangler.jsonc` 任何绑定后：先 `pnpm cf-typegen` 再提交生成的 `worker-configuration.d.ts`。

## 校验

本地与 CI 执行完全相同的命令：`mise run check` + `mise run test`（CI 另加 `cog check` 校验提交历史）。任何一端失败都视为环境不一致，需要对齐而不是加只属于某一端的修复。
