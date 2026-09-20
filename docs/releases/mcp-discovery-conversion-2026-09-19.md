# MCP discovery conversion production release

Application candidate: `1e8a38ccebf3af2efe1ac115be17bfe6813d47ca`.

This release is intentionally limited to the already-green MCP discovery/conversion changes from #627:
- tell clients not to stop after tools/list;
- call procure when installed tools do not clearly satisfy the task;
- keep procure free and fail-closed;
- use verified_resolve as the explicit paid $0.02 uncertainty-resolution step on the full MCP surface;
- preserve independent host spending authorization.

One guarded Vercel production build only.
