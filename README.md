# share

跨设备实时中转站 —— 语音输入的文字、随手拖入的文件，在一台电脑上发送，在另一台电脑上即时看到、复制、下载。面向需要频繁跨机器搬运内容的个人用户。

## 🚀 Quick Start

交给 AI 编码 Agent：

```text
请阅读 AGENTS.md 并按其中的命令与约定工作。
```

手动运行：

```bash
mise install          # Node 24 + pnpm + prek + cocogitto
pnpm install
cp .dev.vars.example .dev.vars   # 填入 GitHub OAuth App 的 client id/secret 与 SESSION_SECRET
mise run test         # 质量门禁 + 全部测试
mise run dev:worker   # 8787 端口，本地 Worker（DO + R2 模拟）
mise run dev          # 5173 端口，Vite 前端（代理 /api 与 /auth）
```

预期结果：浏览器打开 http://localhost:5173 ，GitHub 登录后进入应用。

部署：`mise run deploy`（需 wrangler 已登录，且已配置 R2 桶 `share-files` 与三个 Worker secret，详见 DEVELOPMENT.md）。

## ✨ Features

- **文字块**：Shift+Enter 发送（IME 安全）、可编辑、单击复制
- **文件**：拖拽 / 粘贴 / 按钮上传，多文件自动打包 zip，一键下载；上限 75MB
- **实时同步**：WebSocket 推送，断线自动重连并降级为轮询
- **外链分享**：按条目生成短链 `/f/<id>.<token>`，无需登录即可查看/下载；可设访问次数上限，随时关闭
- **按天折叠**：今天/昨天展开，更早按日折叠，游标分页按需加载
- **永久保存**：数据保留到你手动处理为止
- **多语言**：zh-CN / ja / en，跟随浏览器语言并可手动切换
- **隔离**：GitHub 登录，每个用户一个独立 Durable Object 空间

## ⚡ Performance

首屏单次 HTML 往返，列表数据由 Worker 注入（无二次数据请求）；JS 单 bundle 长缓存，CSS 内联，无外部字体。本地实测跨标签页同步 2–6ms。

## 📚 Learn More

| 目标         | 阅读            |
| ------------ | --------------- |
| 开发工作流   | DEVELOPMENT.md  |
| 贡献与评审   | CONTRIBUTING.md |
| 架构与不变量 | ARCHITECTURE.md |
| Agent 约定   | AGENTS.md       |

## 📄 License

MIT
