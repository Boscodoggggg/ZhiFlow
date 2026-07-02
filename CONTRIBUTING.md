# Contributing

Thanks for caring about ZhiFlow Lite.

The project is early, so the best contributions are focused and practical:

- bug reports with reproduction steps
- support for more spec formats
- improvements to project scanning
- UI polish that makes the workbench clearer
- agent execution experiments behind explicit gates

## Local Setup

```bash
npm install
npm run dev:app
```

Run checks before opening a PR:

```bash
npm test
npm run build
```

## Pull Request Guidelines

- Keep PRs small enough to review.
- Avoid unrelated refactors.
- Add tests for scanner, provider, i18n, theme, and API behavior changes.
- Do not automate destructive Git actions without a human confirmation step.

## Product Principle

ZhiFlow should feel like a control room for real coding work: local-first, transparent, reviewable, and calm under pressure.
