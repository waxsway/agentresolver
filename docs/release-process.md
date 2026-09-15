# Production release process

AgentResolver production changes use a staged release path:

1. Make changes on a non-`main` branch.
2. Open a pull request targeting `main`.
3. CI must pass typecheck, tests, production build, and built-app smoke tests.
4. Merge using a GitHub merge commit.
5. Vercel is configured to ignore non-merge commits, so direct pushes to `main` are not deployable.
6. After Vercel promotes the merge commit, the Production Smoke workflow verifies the canonical health, agent guide, integrations catalog, OpenAPI, AI plugin manifest, and MCP server card.

Do not bypass the PR + CI path for production changes.
