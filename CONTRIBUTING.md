# Contributing to Repo Growth

Thanks for helping improve Repo Growth. Bug reports, feature proposals, documentation corrections, and pull requests are welcome.

## Before opening an issue

- Search existing issues to avoid duplicates.
- Confirm the problem still occurs with the current `v1` release.
- Remove tokens, private repository names, and other sensitive information from logs.
- Use the appropriate issue form and include a minimal reproduction where possible.

Security vulnerabilities must be reported through the process in [SECURITY.md](SECURITY.md), not through a public issue.

## Development

Repo Growth requires Node.js 20 or newer and has no runtime dependencies.

```bash
git clone https://github.com/MacRimi/repo-growth.git
cd repo-growth
npm test
npm run demo
```

Before submitting a pull request, run:

```bash
npm run check
xmllint --noout assets/repo-growth-demo.svg
```

## Pull requests

- Keep each pull request focused on one change.
- Add or update tests for behavioral changes.
- Regenerate the demo SVG when visual output changes.
- Update the README when inputs, outputs, or installation steps change.
- Explain user-visible behavior and compatibility implications in the description.

By contributing, you agree that your work will be distributed under the project's [MIT License](LICENSE).
