# Production release candidate — verified fallback correctness batch

Prepared from main SHA `537a11955315f423fc2dbfd3168baf3162c97b8a`.

This release candidate exists only to authorize one guarded production deployment after explicit owner approval.

Included since current production `5f06f08b3ad4f6b255da14b133b3fdab0f1db1e7`:

- semantic fail-closed procurement matching;
- live MCP tool schema/annotation evidence for verified fallback;
- x402 capability unknowns remain fail-closed;
- semantic regression corpus, including the independently reported Hronaut browser-workspace mismatch;
- lifecycle qualifier evidence for persistence/local-vs-remote/workspace/human-control/freshness/read/write semantics;
- conservative classification of known directory/liveness probes;
- free-to-paid verified-fallback offer telemetry;
- stable-fallback README positioning;
- MCP Registry metadata refresh to 0.2.1.

Release policy:

- do not merge until Wade explicitly approves one Vercel production build/deploy;
- one build only;
- guarded prebuilt deployment path;
- existing production remains canonical until smoke succeeds;
- no self-payments and no paid smoke transactions.
