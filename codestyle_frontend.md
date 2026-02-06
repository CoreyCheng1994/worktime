# 前端代码风格

- 语言：TypeScript；缩进 2 空格；字符串默认双引号。
- 命名：React 组件使用 PascalCase（如 `Todos.tsx`），hooks/store 使用 camelCase（如 `todosPage.ts`）。
- 样式：必须使用 CSS-in-JS。
- 组件：不允许直接使用 Ant Design 组件，必须在组件库中封装后再使用。
- 页面：必须数据驱动（状态来源于 store/props/接口数据），避免硬编码展示。
- 测试：使用 Vitest + Testing Library，主流程必须全部覆盖测试。
- 工具：暂无统一格式化或 lint 工具；如新增请同步在 `package.json` 脚本中说明。
