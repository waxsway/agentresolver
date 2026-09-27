import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Commerce Health Check | AgentResolver",
  description:
    "Run a free live check to see whether AI agents can still discover, call, and pay your API, MCP server, or x402 service.",
  alternates: { canonical: "/monitor" }
};

export default function MonitorPage() {
  return (
    <main>
      <div className="eyebrow">FREE AGENT COMMERCE HEALTH CHECK</div>
      <h1>Can AI agents still discover, call, and pay your service?</h1>
      <p className="lead">
        Paste one public service URL. AgentResolver checks the machine-readable
        surface immediately. Add your MCP or x402 endpoint only when you want
        the deeper protocol checks.
      </p>

      <section className="scanner">
        <form action="/monitor/result" method="get">
          <label htmlFor="origin">Public API, MCP, x402, or agent-service URL</label>
          <div className="scan-row">
            <input
              id="origin"
              aria-label="Public service origin"
              name="origin"
              type="url"
              placeholder="https://api.example.com"
              required
            />
            <button className="button" type="submit">
              Check agent-commerce health — free
            </button>
          </div>
          <details>
            <summary>Optional deeper MCP + x402 checks</summary>
            <div className="advanced-fields">
              <input
                aria-label="Optional MCP endpoint"
                name="mcpEndpoint"
                type="url"
                placeholder="https://api.example.com/mcp"
              />
              <input
                aria-label="Optional GET-safe x402 endpoint"
                name="x402Endpoint"
                type="url"
                placeholder="https://api.example.com/paid"
              />
            </div>
          </details>
        </form>
      </section>

      <div className="grid">
        <section>
          <h2>Discovery</h2>
          <p>
            Checks whether machine-facing discovery surfaces are present and
            reachable instead of assuming agents can interpret the website.
          </p>
        </section>
        <section>
          <h2>Execution</h2>
          <p>
            With an MCP endpoint, performs a real initialize + tools/list
            exchange and fingerprints the exposed tool contract.
          </p>
        </section>
        <section>
          <h2>Payment</h2>
          <p>
            With a GET-safe x402 endpoint, validates the unpaid 402 challenge,
            payment recipient, network, asset, amount, and resource binding.
          </p>
        </section>
      </div>

      <section>
        <div className="eyebrow">FREE RECURRING MONITORING</div>
        <h2>Run it every day from GitHub Actions.</h2>
        <p>
          No AgentResolver account, API key, wallet, or secret is required.
          Your repository owns the schedule; AgentResolver returns the current
          discovery, MCP, and x402 health result.
        </p>
        <p className="actions">
          <a className="button secondary" href="/docs/free-github-monitoring">
            Copy the free GitHub Action
          </a>
        </p>
      </section>

      <h2>Why monitor it?</h2>
      <p className="lead">
        Passing once is not the same as staying compatible. AgentResolver can
        run the same check hourly for 30 days and detect machine-readiness,
        MCP-tool, and x402-payment drift.
      </p>

      <p className="links">
        <a href="/openapi.json">OpenAPI</a> ·{" "}
        <a href="/api/service-monitor?origin=https%3A%2F%2Fagentresolver.vercel.app&mcpEndpoint=https%3A%2F%2Fagentresolver.vercel.app%2Fmcp&x402Endpoint=https%3A%2F%2Fagentresolver.vercel.app%2Fapi%2Fx402-ping">
          Raw API example
        </a>
      </p>
    </main>
  );
}
