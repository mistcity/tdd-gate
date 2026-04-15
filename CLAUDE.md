# tdd-gate 开发规范

## 构建与提交（必须遵守！）

dist/ 已提交到 git。**每次修改 src/ 下的代码后，必须：**

1. `npx vitest run` — 全部测试通过
2. `npx tsc` — 重新构建 dist/
3. `git add src/ dist/` — 同时提交源码和编译产物
4. 提交

**绝对不允许**只提交 src/ 不提交 dist/，否则安装的用户会拿到过时的编译产物。

## TDD

tdd-gate 自己也受 tdd-gate 约束。修改实现文件前必须先修改对应的测试文件。

## 版本管理

版本号在 3 个文件中保持同步：
- `package.json`
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

每次发布新功能或修复必须 bump 版本号，否则已安装用户的 `claude plugin update` 拉不到更新。
