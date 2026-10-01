import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free GitHub Agent Commerce Monitoring | AgentResolver",
  description:
    "Run daily API, MCP, and x402 agent-commerce health checks from GitHub Actions with no AgentResolver account, API key, wallet, or secret.",
  alternates: { canonical: "/docs/free-github-monitoring" }
};

const workflow = `name: Agent commerce health

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
          # Optional:
          # mcp-endpoint: https://api.example.com/mcp
          # x402-endpoint: https://api.example.com/paid
          # fail-on-degraded: "true"`;

export default function FreeGithubMonitoringPage() {
  return (
    <main>
      <div className="eyebrow">FREE RECURRING AGENT COMMERCE MONITORING</div>
      <h1>Put AgentResolver in your GitHub Actions schedule.</h1>
      <p className="lead">
        No AgentResolver account, API key, wallet, or secret. Your repository
        owns the schedule. AgentResolver checks the public service and writes
        health, readiness score, and monitor ID into the job summary.
      </p>

      <h2>Copy this workflow</h2>
      <pre><code>{workflow}</code></pre>

      <div className="grid">
        <section>
          <h2>Discovery health</h2>
          <p>Checks machine-readable readiness on the public origin.</p>
        </section>
        <section>
          <h2>MCP health</h2>
          <p>Add the same-origin MCP endpoint for initialize + tools/list.</p>
        </section>
        <section>
          <h2>x402 health</h2>
          <p>Add a GET-safe paid endpoint to validate its unpaid payment challenge without signing or spending.</p>
        </section>
      </div>

      <section>
        <h2>Want AgentResolver to own the schedule?</h2>
        <p>
          The managed plan runs on a recurring schedule for 30 days, targets an hourly cadence without guaranteeing exact run times, and keeps durable status.
          Current paid activation is x402 machine-paid; normal card checkout is
          not live until merchant onboarding is complete.
        </p>
        <p className="actions">
          <a className="button" href="/api/managed-monitor-30d">See the $19 managed quote</a>{" "}
          <a className="button secondary" href="/monitor">Run one free check</a>
        </p>
      </section>
    </main>
  );
}
