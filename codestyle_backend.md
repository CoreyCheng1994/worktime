# 后端代码风格

- 语言：TypeScript；缩进 2 空格；字符串默认双引号。
- 命名：类与模块使用 PascalCase（如 `AppModule`、`HealthController`），文件名使用 camelCase 或 kebab-case 保持一致。
- 结构：遵循 NestJS 模块化组织方式，按功能拆分模块、控制器与服务。
- 测试：使用 Jest，主流程必须全部覆盖测试。
- 工具：暂无统一格式化或 lint 工具；如新增请同步在 `package.json` 脚本中说明。
