# Worktime 使用指南（新手友好）

本指南只讲「怎么跑起来、怎么保持更新」。
你可以把所有命令理解为两种等价写法：
- 已安装全局命令后：`worktime <command>`
- 未安装全局命令时：`pnpm worktime <command>`

## 1. 第一次安装（推荐顺序）

### 1.1 准备依赖
```bash
git --version
node -v
pnpm -v
```
建议：
- Node.js >= 20
- pnpm >= 9

### 1.2 拉代码并安装依赖
```bash
git clone <your-repo-url> worktime
cd worktime
pnpm i
```

### 1.4 安装全局命令（可选但强烈推荐）
```bash
pnpm worktime install
```
安装成功后可直接使用：
```bash
worktime help
```

## 2. 先做环境检测（强烈推荐）

```bash
worktime doctor
# 或 pnpm worktime doctor
```

这个命令会检测：
- 必要命令（node/pnpm/git）
- 环境文件是否存在
- 端口占用
- 网络可达性（含 npm 官方源与国内镜像）

如果你没有 VPN，`doctor` 会给出国内可访问方案建议（例如 `npmmirror`）。

## 3. 启动项目（生产单进程）

### 3.1 一键启动并打开浏览器
```bash
worktime
# 等价于 worktime open
```

### 3.2 常用启动/停止命令
```bash
worktime start
worktime status
worktime logs
worktime stop
worktime restart
```

默认访问地址：
- `http://localhost:13119`

## 4. 注册开机自启（macOS）

```bash
worktime autostart enable
worktime autostart status
worktime autostart disable
```

## 5. 更新项目（小白推荐）

### 最推荐：单命令更新
```bash
worktime update
```
这条命令会自动执行：
1. 检查本地是否有未提交改动（有则停止，避免覆盖）
2. `git pull --ff-only`
3. 停服务、重新安装依赖和构建
4. 重启服务

### 手动更新（等价流程）
```bash
git pull --ff-only
worktime refresh
```

> 你要求的“更新前先 git pull”已固化在 `worktime update` 里。

## 6. 配置页面说明

启动后进入：
- `http://localhost:<API_PORT>/settings`

可在配置页完成：
- MySQL 配置
- AI 配置
- MCP 路由开关
- 本机 AI CLI 的 MCP 集成开关（Codex / Claude / Gemini / Kimi）

## 7. MCP 相关命令

### 7.1 HTTP MCP（默认跟服务同进程）
服务启动后自动提供 `/mcp`。

### 7.2 stdio MCP（给本地 AI CLI）
```bash
worktime mcp
```

## 8. 命令总览

```bash
worktime open
worktime start
worktime stop
worktime restart
worktime status
worktime logs
worktime build
worktime doctor
worktime refresh
worktime update
worktime mcp
worktime install
worktime autostart enable|disable|status
```

---

如果你要让 agent 帮你一键安装/修复，建议直接发：

```text
请在当前项目执行 worktime doctor，根据 FAIL/WARN 自动修复；
如果网络无法访问境外源，优先改成国内可访问方案；
修复后执行 worktime start 并验证 settings 页可用。
```
