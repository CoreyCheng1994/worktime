# Repository Guidelines

## 项目结构与模块组织
- `api/`：NestJS 后端（入口：`api/src/main.ts`；模块：`api/src/app.module.ts`）。
- `web/`：React + Vite 前端（入口：`web/src/main.tsx`；路由与页面：`web/src/App.tsx`、`web/src/pages/`）。
- `web/src/stores/`：Zustand 状态管理示例；`web/src/styles/`：基础与页面样式。
- 根目录：`package.json` 与 `pnpm-workspace.yaml` 负责工作区脚本与依赖。

## 构建、测试与本地开发命令
- `pnpm i`：安装全仓依赖。
- `pnpm dev`：并行启动前后端（工作区根命令）。
- `pnpm -C web dev`：仅启动前端（Vite）。
- `pnpm -C api dev`：仅启动后端（ts-node-dev）。
- `pnpm -C web build` / `pnpm -C web preview`：前端构建与预览。
- `pnpm -C api build` / `pnpm -C api start`：后端编译与运行产物。

## 编码风格与命名约定
- 前端代码风格参考 `codestyle_frontend.md`；后端代码风格参考 `codestyle_backend.md`。

## 测试指南
- 前端使用 Vitest + Testing Library；后端使用 Jest（NestJS）。
- 主流程必须全部覆盖测试；新增功能需同步补充测试用例。
- 测试目录建议：前端 `web/src/**/__tests__` 或 `*.test.tsx`；后端 `api/test/` 或 `*.spec.ts`。
- 运行：`pnpm test`（全量）或 `pnpm -C web test` / `pnpm -C api test`（单端）。

## 提交与 Pull Request 指南
- 当前目录未包含 `.git`，无法从历史总结提交规范。
- 建议提交信息使用简洁动词开头（如 `feat:` / `fix:` / `chore:`），PR 需包含：变更说明、影响范围、必要的截图（前端 UI）与启动/验证步骤。

## 安全与配置提示（可选）
- 本仓库默认端口：Web `http://localhost:13018`，API `http://localhost:13019`。
- 如新增环境变量，请在根目录补充 `.env.example` 并在 README 记录用途。
