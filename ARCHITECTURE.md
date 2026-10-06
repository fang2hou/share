# 架构

## 概览

单个 Cloudflare Worker 同时承担三件事：托管 SvelteKit 静态 SPA 外壳、处理 `/api/*` 与 `/auth/*`、导出每用户一个的 Durable Object。文件正文进 SQLite（DO 内），文件字节进 R2，实时性由 DO 的 WebSocket Hibernation 推送保证。

## 代码地图

- `worker/index.ts` —— 路由层：首页 bootstrap 注入、`/api/items|files|ws`、公开外链 `/f/<sub>.<token>`
- `worker/auth.ts` —— HMAC 会话、GitHub OAuth 回调、Origin 校验
- `worker/space.ts` —— Space DO：条目 CRUD、分页、外链 token 与预算、广播
- `src/lib/protocol.ts` —— 前后端共享的唯一类型/常量契约
- `src/lib/space.svelte.ts` —— 客户端状态：乐观插入、WS 心跳/重连/降级拉取、上传进度
- `src/routes/+page.svelte` —— 组合层：输入、按天分组、上传、语言切换

## 不变量

1. 隔离：所有 `/api/*` 请求的 DO 一律由会话 `sub` 派生（`gh:<githubId>`）；不存在跨用户读取路径。
2. 首屏：`GET /` 单次往返 —— HTMLRewriter 注入的 bootstrap 是唯一的首屏数据源，`<` 必须转义为 `\u003c`。
3. 外链：路径即能力。token 16 字节随机；未启用 / 错 token / 预算耗尽一律返回不可区分的 404；公开响应 `no-store`。
4. 写保护：POST/PATCH/WS 升级必须通过 `originAllowed`；已登录下载拒绝 `Sec-Fetch-Site: cross-site`。
5. DO schema 只加列（幂等 ALTER），存量 DO 实例必须无损升级。
6. 保留策略：数据永久保留；任何删除能力必须显式由用户触发，绝不隐式清理。
