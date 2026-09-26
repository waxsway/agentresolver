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
        artifacts plus a concrete publication sequence.
      </p>

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

      <h2>Then verify the live route</h2>
      <p>
        Once the discovery files are published, the existing $0.05 Provider
        Launch Check verifies the seller's live route and x402 contract before
        AgentResolver provider-network review. Distribution and verification are
        now one seller funnel rather than unrelated products.
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
