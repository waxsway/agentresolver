# Muse MCP review hardening — release candidate

Prepared 2026-09-23.

This release candidate carries the already-merged review-hardening changes from main into a single owner-gated production release.

Included:
- MCP runtime identity aligned to 0.1.4
- root package and lockfile version aligned to 0.1.4
- reviewer-style MCP protocol smoke covering:
  - legacy 2025-06-18 initialize
  - modern 2026-07-28 server/discover
  - tools/list
  - free resolve execution
  - unpaid payment_guard challenge
  - Base + Solana challenge options
  - confirmation that no settlement receipt appears on an unpaid call

Validation already completed on PR #718 and merged main:
- typecheck passed
- tests passed
- client package build passed
- npm pack dry-run passed
- app build passed
- reviewer-style MCP smoke passed
- app smoke passed

This file creates the explicit production release boundary only. It does not change pricing, custody, payment rails, authentication, or connector scope.
