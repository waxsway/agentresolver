import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API + MCP Monitoring | AgentResolver",
  description:
    "Check whether an API, MCP server, or x402 service is still reachable, agent-compatible, and payment-ready, then detect drift from a prior snapshot."
};

export default function MonitorPage() {
  return (
    <main>
      <div className="eyebrow">AGENT COMPATIBILITY MONITORING</div>
      <h1>Know when AI agents can no longer use or pay your service.</h1>
      <p className="lead">
        AgentResolver checks the machine-readable surface, can perform a real MCP
        initialize + tools/list exchange, can inspect a GET-safe x402 payment
        contract, and returns a stable fingerprint you can compare over time.
      </p>

      <h2>Run a live snapshot — free</h2>
      <form className="actions" action="/api/service-monitor" method="get">
        <input
          aria-label="Public service origin"
          name="origin"
          type="url"
          placeholder="https://api.example.com"
          required
        />{" "}
        <input
          aria-label="Optional MCP endpoint"
          name="mcpEndpoint"
          type="url"
          placeholder="https://api.example.com/mcp"
        />{" "}
        <input
          aria-label="Optional GET-safe x402 endpoint"
          name="x402Endpoint"
          type="url"
          placeholder="https://api.example.com/paid"
        />{" "}
        <button className="button" type="submit">
          Check service now
        </button>
      </form>

      <div className="grid">
        <section>
          <h2>API + discovery health</h2>
          <p>
            Tracks homepage reachability, llms.txt, OpenAPI, sitemap, MCP
            metadata, crawler signals, and baseline security headers.
          </p>
        </section>
        <section>
          <h2>Real MCP compatibility</h2>
          <p>
            When you provide an MCP endpoint, AgentResolver performs an MCP
            initialize exchange and tools/list, then fingerprints the tool
            contract so schema drift can be detected.
          </p>
        </section>
        <section>
          <h2>Payment-contract drift</h2>
          <p>
            For a GET-safe x402 endpoint, AgentResolver watches the network,
            asset, payTo recipient, resource binding, and quoted amount without
            authorizing or spending customer funds.
          </p>
        </section>
      </div>

      <h2>Managed monitoring</h2>
      <p>
        The managed plan runs the same check hourly for 30 days and keeps a
        durable status record. No wallet keys, API secrets, private endpoints,
        or customer credentials are required. The first managed plan is
        machine-paid with x402; card billing can be added after merchant
        onboarding is complete.
      </p>
      <p className="actions">
        <a className="button" href="/api/managed-monitor-30d">
          See the $19 / 30-day managed quote
        </a>{" "}
        <a className="button secondary" href="/distribution">
          Distribution tools
        </a>
      </p>

      <p className="links">
        <a href="/openapi.json">OpenAPI</a> ·{" "}
        <a href="/api/service-monitor?origin=https%3A%2F%2Fagentresolver.vercel.app&mcpEndpoint=https%3A%2F%2Fagentresolver.vercel.app%2Fmcp&x402Endpoint=https%3A%2F%2Fagentresolver.vercel.app%2Fapi%2Fx402-ping">
          Live AgentResolver example
        </a>
      </p>
    </main>
  );
}
