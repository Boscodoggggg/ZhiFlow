# Roadmap

ZhiFlow Lite is moving toward a real local-first Spec-to-PR loop.

## 0.1 Preview

- [x] Scan real local projects
- [x] Read OpenSpec changes
- [x] Read Spec Kit specs
- [x] Read Markdown `tasks.md`
- [x] Detect local agent CLIs
- [x] Show multi-agent workbench UI
- [x] Support Chinese / English UI
- [x] Support light / dark themes

## 0.2 Git + Worktree Automation

- [ ] Create isolated Git worktrees from selected tasks
- [ ] Persist ZhiFlow run records under `.zhiflow/`
- [ ] Collect task logs and command output
- [ ] Detect real diffs from worktrees
- [ ] Add PR readiness checks

## 0.3 Multi-Agent Execution

- [ ] Run implementer agents from selected providers
- [ ] Run reviewer agents after implementation
- [ ] Support cross-provider review, such as Codex implements and Claude reviews
- [ ] Support parallel task execution lanes
- [ ] Surface conflicts, blocked tasks, and review verdicts

## 0.4 PR Flow

- [ ] Generate commits from approved diffs
- [ ] Push branches after human confirmation
- [ ] Create draft PRs through GitHub CLI or API
- [ ] Attach logs, spec links, and review summaries to PR descriptions

## Later

- [ ] Native `.zhiflow` spec format
- [ ] Repo-level policy and safety rules
- [ ] Plugin system for more agent providers
- [ ] Desktop packaging
- [ ] Team workflow and shared run history
