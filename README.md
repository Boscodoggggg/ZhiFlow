# ZhiFlow Lite

本地优先的 Spec-to-PR 多 Agent 工作台。

ZhiFlow Lite 不是又一个静态任务看板，而是面向真实项目的开发工作台：它会读取本地仓库里的 OpenSpec、Spec Kit 或 `tasks.md`，把规格任务转成可执行队列，并为后续的多 Agent 实现、评审、人工门禁和 PR 流程留好入口。

## 现在能做什么

- 自动扫描真实项目，不使用假数据
- 兼容 OpenSpec、Spec Kit、Markdown `tasks.md`
- 检测本机可用的 Agent CLI：Codex、Claude Code、Gemini CLI 等
- 展示多 Agent 工作流：实现、Diff、评审、决策、人工门禁
- 支持中文默认界面和英文切换
- 支持亮色 / 暗色主题
- 支持真实项目路径运行

## 快速启动

```bash
npm install
npm run dev:app
```

打开：

```text
http://127.0.0.1:5173/
```

扫描指定项目：

```bash
ZHIFLOW_PROJECT=/path/to/your/project npm run dev:app
```

如果端口冲突：

```bash
PORT=5174 ZHIFLOW_PROJECT=/path/to/your/project npm run dev:app
```

## 开发命令

```bash
npm test
npm run build
```

## 产品方向

ZhiFlow Lite 的目标是成为本地优先的 Spec-to-PR 控制台：

1. 从规格读取任务
2. 为任务创建隔离 worktree
3. 调度一个或多个 Agent 实现
4. 调度另一个 Agent 评审
5. 汇总 Diff、日志、风险和结论
6. 人工确认后创建 PR

## 状态

早期原型，正在快速迭代。当前版本重点验证真实项目扫描、SDD 兼容和多 Agent 工作台形态。
