# AGENTS.md

share 是个人使用的跨设备内容中转站：Cloudflare Workers（每用户一个 SQLite Durable Object + R2）承载 SvelteKit 3 SPA 外壳。

## 命令

```bash
mise install                # 工具链：Node 24、pnpm、prek、cocogitto
mise run dev                # Vite 5173（代理 /api、/auth 到 8787）
mise run dev:worker         # wrangler dev 8787（本地 DO/R2 模拟）
mise run test               # 完整门禁：lint + format + typecheck + 测试
mise run check              # 快速门禁（不含测试）
pnpm vitest run test/worker.test.ts -t "share"   # 单个测试
mise run deploy             # 构建并部署到 Cloudflare
pnpm cf-typegen             # 改动 wrangler.jsonc 后重新生成类型
```

## 工程标准

遵循 [ai-coding-guidelines](https://github.com/fang2hou/ai-coding-guidelines)。已确认的例外：

- SvelteKit 3.0 预发布线：本项目立项目的即验证该版本；SDK 三件套（kit/vite-plugin/adapter）需同步升级。
- UI 组件手写（Tailwind v4 原子类 + 内联 Lucide path），不引入 DaisyUI / shadcn-svelte：整个 UI 仅 6 个小组件，体积优先。
- oxfmt 默认风格（2 空格、双引号）接管仓库全部 TS/JS；不要手工对抗格式化。

## 目录布局

- `worker/` — Cloudflare Worker：`index.ts` 路由、`auth.ts` 会话与 GitHub OAuth、`space.ts` Durable Object
- `src/lib/` — 前端共享：`protocol.ts`（前后端共用类型与常量）、`i18n.ts`、`space.svelte.ts`（状态/WS）、组件
- `src/routes/` — SPA 页面（SSR 关闭，预渲染外壳）
- `test/` — vitest-pool-workers 集成测试（真实 miniflare 运行时）
- `static/` — 静态资源与 `_headers`

## 边界

- 必须做：改 `wrangler.jsonc` 后运行 `pnpm cf-typegen`；改任何 `.svelte` 后运行 svelte autofixer；提交走 Conventional Commits（prek + cog 已校验）。
- 绝不做：提交 `.dev.vars` 或任何密钥；绕过 `mise run check`；改动 `worker/space.ts` 的 schema 而不写幂等迁移（老 DO 实例必须无损升级）。
- 先问：新增运行时依赖；改动鉴权、外链或跨用户隔离逻辑；触碰部署配置。

## 语言政策（已确认）

- 代码、注释、提交信息：英文。
- UI 文案：zh-CN / ja / en 三语完整支持，跟随浏览器语言，用户可手动切换并持久化；日语文案独立撰写，不从中文直译。
- 公开外链页面按访问者 Accept-Language 渲染。

## 项目约定

- 前后端共享类型只放 `src/lib/protocol.ts`；Worker 用带 `.ts` 后缀的相对路径导入。
- DO 表结构演进只加列（幂末 ALTER TABLE + PRAGMA 探测），不重命名、不删列。
- 外链 token 16 字节随机，路径即能力：所有失败原因统一 404。
- 会话 cookie `ts_session`：HMAC-SHA256 + 30 天有效期；写操作与 WS 升级必须过 `originAllowed`。

## 深入文档

DEVELOPMENT.md（工作流与部署）、CONTRIBUTING.md（PR 与校验）、ARCHITECTURE.md（边界与不变量）。
