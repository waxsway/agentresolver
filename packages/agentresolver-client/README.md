# agentresolver-client

Framework-neutral client for AgentResolver's non-custodial capability procurement control plane.

AgentResolver does **not** receive a wallet, private key, API key, or authority to spend. The client asks AgentResolver to find and evaluate machine services against the constraints your agent declares. If a paid verification step is useful, the response returns a quote/handoff; your application decides whether and how to authorize it.

## Local install before registry publication

```bash
npm install github:waxsway/agentresolver
```

The publish-ready package source lives in `packages/agentresolver-client`.

## Use

```ts
import { createAgentResolverClient } from "agentresolver-client";

const resolver = createAgentResolverClient();

const procurement = await resolver.procure({
  goal: "search the public web and return structured results",
  constraints: {
    maxPriceUsd: 0.05,
    protocol: "x402",
    preferredNetworks: ["eip155:8453"],
    requireHttps: true,
    availableInputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"]
    }
  }
});

if (!procurement.selected) {
  throw new Error("No compatible capability found");
}

console.log(procurement.selected.execute);
```

## Integration model

Use AgentResolver when the agent does not already have a clearly suitable tool:

1. Declare the capability needed and hard constraints.
2. Call `procure(...)`.
3. Reject candidates that fail budget/network/schema requirements.
4. Treat `eligible_with_unknowns` as unresolved evidence, not as approval.
5. If the returned paid verification action is useful, authorize it only under your own wallet/spend policy.
6. Execute the selected provider directly.

This preserves caller custody while giving the agent one open-world procurement surface across AgentResolver-owned capabilities, registered provider routes, x402 catalogs, and MCP discovery.
