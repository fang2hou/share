# Contributing

Personal repository; small, direct commits are the norm. Branches and pull requests follow the flow below when used.

## Commit conventions

- Conventional Commits: `feat(scope): ...`, `fix: ...`, `docs`, `ci`, `chore`. History is validated by `cog check` in CI.
- The pre-commit hook (prek) runs `mise run check` and blocks the commit on failure.

## Change steps

1. Branch from main or commit directly in small steps.
2. Implement and add behavior-level tests: cover boundaries, error paths, isolation, and budgets — the risks that are real.
3. `mise run test` green locally.
4. Push; CI (Validate + Validate commit history) must pass.

## Every pull request description must include

- Purpose of the change
- Impact of the change
- Relevant background or context
- Potential risks or concerns
- Checks executed (commands and outcomes)

## Review focus

- Security-sensitive surfaces (auth, public share links, cross-user isolation, cookie/origin checks) get line-by-line review.
- Durable Object schema changes must be idempotent and migrate existing instances.
- A new dependency answers five questions: what problem, why this package, maintenance status, bundle cost, alternatives considered.
