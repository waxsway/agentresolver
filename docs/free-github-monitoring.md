# Free scheduled agent-commerce health checks

AgentResolver can check a public API, MCP server, or x402 service from GitHub Actions without an AgentResolver account, API key, wallet, or secret.

This is the free recurring tier: your GitHub repository owns the schedule. AgentResolver's managed plan is the hosted option when you want hourly checks and durable status without maintaining the workflow.

## Daily check

Create `.github/workflows/agent-commerce-health.yml` in your repository:

```yaml
name: Agent commerce health

on:
  workflow_dispatch:
  schedule:
    - cron: "17 8 * * *"

jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - uses: waxsway/agentresolver/.github/actions/agent-commerce-health@main
        with:
          origin: https://api.example.com
```

## Add real MCP and x402 checks

Both deeper endpoints must share the monitored origin.

```yaml
      - uses: waxsway/agentresolver/.github/actions/agent-commerce-health@main
        with:
          origin: https://api.example.com
          mcp-endpoint: https://api.example.com/mcp
          x402-endpoint: https://api.example.com/paid
```

The action performs a live MCP initialize + tools/list when `mcp-endpoint` is supplied. For `x402-endpoint`, it sends only a GET-safe unpaid request and inspects the 402 challenge. It never signs a payment or needs a wallet key.

## Use it as a deploy gate

Set `fail-on-degraded: "true"` if a degraded/down result should fail CI.

```yaml
      - uses: waxsway/agentresolver/.github/actions/agent-commerce-health@main
        with:
          origin: https://api.example.com
          mcp-endpoint: https://api.example.com/mcp
          fail-on-degraded: "true"
```

The action writes the current health, readiness score, and stable monitor id to the GitHub Actions job summary.

## Why the paid monitor still exists

The free Action runs on your GitHub schedule and gives you the current result. The managed monitor runs hourly for 30 days on AgentResolver's schedule and keeps durable public state so you do not have to maintain CI scheduling yourself.

Current managed monitoring is machine-paid through x402. A normal card checkout is not live until AgentResolver's merchant onboarding is completed.
