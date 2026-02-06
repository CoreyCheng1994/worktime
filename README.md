# Worktime Skeleton

一个可直接运行的前后端分离空白骨架：
- 前端：React + Vite + TypeScript + Ant Design 6 + Zustand + React Router
- 后端：NestJS（空壳，仅可启动）

## 目录结构
```
repo/
  api/
  web/
  package.json
  pnpm-workspace.yaml
  README.md
```

## 快速开始
```bash
pnpm i
pnpm dev
```

或分别启动：
```bash
pnpm -C web dev
pnpm -C api dev
```

## 端口
- Web: http://localhost:13018
- API: http://localhost:13019

## 环境变量
复制 `.env.example` 为 `.env` 并补充实际值。新增 OpenAI 相关变量用于自然语言解析接口：
- `AI_KEY`：OpenAI API Key
- `AI_MODEL`：模型名称（默认 `gpt-4o-mini`）
- `TZ`：可选，服务器时区（用于相对日期解释）

## 说明
- `/todos` 页面完全由 Zustand store 状态驱动（loading / empty / error / ready）。
- Ant Design 主题通过 `ConfigProvider` 的 `theme` token 驱动，无全局样式覆盖。
- API 仅提供可启动的空壳。如需健康检查，可以在 `api/src` 新增 `HealthController` 并在 `AppModule` 中注册，例如 `GET /health -> { status: "ok" }`。

## 自然语言解析接口
`POST /work/normalize`：传入自然语言，返回特定日期范围的每日工作清单（由 OpenAI 解析）。

示例请求体：
```json
{
  "text": "下周一到周三，每天上午写周报，下午开会，周二完成 REF 1001 进度 20-40。"
}
```

示例响应体（简化结构，仅文本数组）：
```json
{
  "days": [
    {
      "date": "2026-02-02",
      "items": ["09:00-10:00 写周报", "下午开会"]
    }
  ]
}
```

## 批量添加任务接口
`POST /work/batch-items`：批量新增记录项（TEXT 类型，状态固定为完成）。

示例请求体：
```json
{
  "days": [
    {
      "date": "2026-02-02",
      "items": ["写周报", "下午开会"]
    }
  ]
}
```
