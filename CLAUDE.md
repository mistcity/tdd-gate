# tdd-gate 开发规范

## 构建机制

dist/ 不提交到 git。插件使用官方 `${CLAUDE_PLUGIN_DATA}` 机制：
- `SessionStart` hook 自动检测 package.json 变化
- 变化时自动 `npm install` + `tsc` 构建到 `${CLAUDE_PLUGIN_DATA}/dist/`
- 所有 hook 命令从 `${CLAUDE_PLUGIN_DATA}/dist/index.js` 加载
- 构建产物跨版本持久化，只在依赖变化时重新构建

**开发时只需提交 src/，不需要提交 dist/。**

## TDD

tdd-gate 自己也受 tdd-gate 约束。修改实现文件前必须先修改对应的测试文件。

## 版本管理

版本号在 3 个文件中保持同步：
- `package.json`
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

每次发布新功能或修复必须 bump 版本号，否则已安装用户的 `claude plugin update` 拉不到更新。
