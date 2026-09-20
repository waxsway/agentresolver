# Strict x402 client compatibility production release

Application candidate: `f7ed22f7632ac634279bbd73cf7adb97d9baf0fe`.

This release is intentionally limited to the real external payment-conversion failure exposed by 402 Atlas:
- preserve the original x402 `PAYMENT-REQUIRED` contract emitted by the resource server;
- stop injecting or rewriting AgentResolver-specific data inside the payment contract after challenge creation;
- keep Bazaar discovery metadata unchanged;
- keep buyer handoff/setup information in ordinary `x-agentresolver-*` response headers;
- preserve existing Ping and Payment Preflight behavior.

External evidence before release:
- x402-payment-preflight settled successfully for 402 Atlas;
- x402-ping settled successfully for 402 Atlas;
- repeated signed x402-settlement-verify retries from the same payer were rejected.

One guarded Vercel production build only. No self-payment.


Release trigger:
- production release PR must contain `AGENTRESOLVER_PRODUCTION_RELEASE_ONCE`;
- application fix included in main history: `f7ed22f7632ac634279bbd73cf7adb97d9baf0fe`.
