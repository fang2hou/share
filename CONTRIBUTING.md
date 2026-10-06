# 贡献指南

个人仓库，改动以小步提交为主；如使用分支与 pull request，遵循以下流程。

## 提交规范

- Conventional Commits：`feat(scope): ...`、`fix: ...`、`docs`、`ci`、`chore` 等；历史由 `cog check` 在 CI 校验。
- pre-commit 钩子（prek）运行 `mise run check`，失败即阻止提交。

## 变更步骤

1. 从 main 拉分支或直接小步提交。
2. 实现 + 补测试（行为级：覆盖边界、错误路径、隔离与预算等真实风险）。
3. 本地 `mise run test` 全绿。
4. push；CI（Validate + Validate commit history）必须通过。

## Pull Request 描述必须包含

- 变更目的
- 变更影响
- 相关背景
- 潜在风险
- 已执行的校验（命令 + 结果）

## 评审要点

- 安全敏感面（auth、公开外链、跨用户隔离、cookie/origin 校验）变更必须逐行评审。
- Durable Object schema 变更必须幂等可迁移。
- 新依赖需说明五个问题：解决什么、为何这个、维护状态、体积、替代方案。
