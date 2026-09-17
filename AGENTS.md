# AGENTS.md

## AgentResolver operating instruction

Before doing substantial work in this repository, **read [PROJECT_STATE.md](./PROJECT_STATE.md) first**.

`PROJECT_STATE.md` is the canonical cross-chat / cross-agent operational handoff for:

- mission and commercial objectives
- verified revenue state
- current architecture
- recent completed work
- active blockers
- current priorities
- non-negotiable operator guardrails
- handoff/update protocol

### Required behavior

1. Read `PROJECT_STATE.md` before material architecture, pricing, payment-rail, discovery, distribution, or revenue changes.
2. Verify current production telemetry before making claims about users, signed retries, settlements, or revenue.
3. Preserve existing working funnels unless evidence supports changing them.
4. Do not put secrets, wallet credentials, private keys, seed phrases, API credentials, personal-account details, or other sensitive operator information in repo documentation.
5. After substantial work, update `PROJECT_STATE.md` so the next chat/agent can continue from the actual state.
6. If current source/runtime evidence conflicts with `PROJECT_STATE.md`, trust the current evidence and repair the state file.

### Commercial north star

Optimize for:

**qualified external buyer → signed retry → settlement → paid fulfillment → repeat paid use**

HTTP 402 traffic alone is not revenue.
