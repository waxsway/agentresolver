import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Distribution — Make Your API or MCP Discoverable | AgentResolver",
  description:
    "Seller-side agent distribution for APIs and MCP servers: live readiness evidence, ready-to-commit discovery artifacts, and a launch sequence built for machine buyers."
};

const example = `POST /api/agent-distribution-pack
Content-Type: application/json

{
  "providerName": "Example API",
  "description": "Current structured data for autonomous agents.",
  "origin": "https://api.example.com",
  "primaryEndpoint": "https://api.example.com/v1/search",
  "openapiUrl": "https://api.example.com/openapi.json",
  "mcpName": "com.example/api",
  "mcpEndpoint": "https://api.example.com/mcp",
  "repositoryUrl": "https://github.com/example/api",
  "tags": ["search", "data", "agents"]
}`;

export default function DistributionPage() {
  return (
    <main>
      <div className="eyebrow">AGENT DISTRIBUTION FOR SELLERS</div>
      <h1>Make the API or MCP you already built findable and callable by AI agents.</h1>
      <p className="lead">
        AgentResolver now focuses on the seller side of the agent economy.
        The paid Distribution Pack audits your live machine-readable surfaces,
        identifies the launch gaps, and returns ready-to-commit discovery
        artifacts plus a concrete publication sequence. If you already sell
        through x402 and only need to verify the live route/payment contract,
        the $0.05 Provider Launch Check is the lower-friction entry point.
      </p>

      <h2>See your gaps before you pay</h2>
      <p>
        Run a bounded free preview against your public origin. It shows the
        current readiness score and the most important missing machine-readable
        surfaces, but keeps the generated files and full launch sequence inside
        the paid Distribution Pack.
      </p>
      <form className="actions" action="/api/agent-distribution-preview" method="get">
        <input
          aria-label="Public API or MCP origin"
          name="origin"
          type="url"
          placeholder="https://api.example.com"
          required
        />{" "}
        <button className="button" type="submit">
          Preview my distribution gaps — free
        </button>
      </form>

      <p className="actions">
        <a className="button" href="/api/agent-distribution-pack">
          See the $5 USDC quote
        </a>{" "}
        <a className="button secondary" href="/api/provider-launch-check">
          $0.05 live launch check
        </a>
      </p>

      <div className="grid">
        <section>
          <h2>Audit the live origin</h2>
          <p>
            Check llms.txt, OpenAPI, sitemap, MCP metadata, crawler signals,
            and baseline machine-readiness against the public deployment.
          </p>
        </section>
        <section>
          <h2>Get files you can ship</h2>
          <p>
            Receive a generated llms.txt, MCP Registry server.json when
            applicable, crawler-discovery additions, and MCP client config.
          </p>
        </section>
        <section>
          <h2>Know what to publish next</h2>
          <p>
            The result separates missing technical surfaces from external
            registry work so teams stop confusing “deployed” with “discoverable.”
          </p>
        </section>
      </div>

      <h2>One product, one job</h2>
      <p>
        AgentResolver is not asking providers to buy generic traffic. The job is
        specific: expose a canonical machine interface, make it legible to agent
        discovery systems, verify the live route, and measure what happens next.
      </p>

      <h2>Paid input</h2>
      <pre><code>{example}</code></pre>

      <h2>What the $5 pack returns</h2>
      <p>
        A current readiness baseline, missing-surface diagnosis, generated
        discovery artifacts, distribution-target status, and a prioritized
        launch sequence. No account or subscription is required; payment is
        caller-authorized x402 USDC on Base or Solana.
      </p>

      <h2>Two entry points, one seller funnel</h2>
      <p>
        x402 sellers can start with the $0.05 Provider Launch Check when they
        only need live route and payment-contract verification. Sellers that
        need discoverability diagnosis or files to ship use the $5 Distribution
        Pack. Both feed the same provider-network review and downstream
        attribution path.
      </p>

      <p className="links">
        <a href="/openapi.json">OpenAPI</a> ·{" "}
        <a href="/mcp/server-card">MCP Server Card</a> ·{" "}
        <a href="/.well-known/x402">x402 manifest</a> ·{" "}
        <a href="/legal">Legal & Safety</a>
      </p>
    </main>
  );
}
