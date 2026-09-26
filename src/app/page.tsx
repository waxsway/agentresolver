const distributionExample = `POST /api/agent-distribution-pack
Content-Type: application/json

{
  "providerName": "Example API",
  "description": "Current structured data for autonomous agents.",
  "origin": "https://api.example.com",
  "primaryEndpoint": "https://api.example.com/v1/search",
  "openapiUrl": "https://api.example.com/openapi.json",
  "mcpName": "com.example/api",
  "mcpEndpoint": "https://api.example.com/mcp"
}`;

const guardExample = `POST /api/x402-payment-preflight
Content-Type: application/json

{
  "url": "https://merchant.example/api",
  "method": "GET",
  "maxPriceUsd": 0.01
}`;

export default function Home() {
  return (
    <main>
      <div className="eyebrow">AGENT DISTRIBUTION FOR API + MCP PROVIDERS</div>
      <h1>Make the software you already built discoverable to AI agents.</h1>
      <p className="lead">
        AgentResolver is a seller-side distribution layer for APIs, MCP servers,
        and agent services. It audits the live machine-readable surface,
        generates the files agents and registries need, verifies callable
        routes, and turns “we shipped it” into a measurable distribution
        process.
      </p>

      <p className="actions">
        <a className="button" href="/distribution">
          Launch with the $5 Distribution Pack
        </a>{" "}
        <a className="button secondary" href="/api/provider-launch-check">
          Run the $0.05 live launch check
        </a>
      </p>

      <div className="grid">
        <section>
          <h2>Audit what agents can actually see</h2>
          <p>
            Check llms.txt, OpenAPI, sitemap, MCP metadata, crawler signals,
            and the canonical public origin instead of assuming deployment
            equals discovery.
          </p>
        </section>
        <section>
          <h2>Generate launch artifacts</h2>
          <p>
            Produce a ready-to-commit llms.txt, MCP Registry server.json when
            applicable, crawler-discovery additions, and MCP client config.
          </p>
        </section>
        <section>
          <h2>Verify the live route</h2>
          <p>
            Seller-side launch verification checks the public route and x402
            payment contract before AgentResolver provider-network review.
          </p>
        </section>
      </div>

      <h2>The paid seller workflow</h2>
      <pre><code>{distributionExample}</code></pre>

      <section>
        <div className="eyebrow">SUPPORTING INFRASTRUCTURE</div>
        <h2>Verify-before-pay remains available for buyer agents.</h2>
        <p>
          The existing x402 Guard is now supporting infrastructure rather than
          the company&apos;s primary commercial thesis. Buyer agents can still
          live-check payTo, quoted price, network, asset, resource binding, TLS,
          and reachability before signing.
        </p>
        <pre><code>{guardExample}</code></pre>
        <p className="actions">
          <a className="button secondary" href="/api/x402-payment-preflight">
            See the $0.001 Guard quote
          </a>
        </p>
      </section>

      <section>
        <div className="eyebrow">HOSTED MCP CONNECTOR</div>
        <h2>AgentResolver itself is callable over MCP.</h2>
        <p>
          Hosted endpoint: <code>https://agentresolver.vercel.app/mcp</code>.
          Free discovery surfaces stay free; priced tools disclose their x402
          USDC price before execution and require caller-controlled payment
          authorization.
        </p>
        <p className="actions">
          <a className="button secondary" href="/connector">Connector information</a>{" "}
          <a className="button secondary" href="/docs">MCP documentation</a>
        </p>
      </section>

      <section>
        <div className="eyebrow">HIGHER-TOUCH OPTION</div>
        <h2>Need us to implement the first-party MCP layer?</h2>
        <p>
          The fixed $1,000 implementation sprint remains available for
          companies that want implementation rather than a self-serve
          distribution pack.
        </p>
        <p className="actions">
          <a className="button secondary" href="/mcp-sprint">See the MCP sprint</a>
        </p>
      </section>

      <p className="links">
        <a href="/distribution">Agent Distribution</a> ·{" "}
        <a href="/openapi.json">OpenAPI</a> ·{" "}
        <a href="/mcp/server-card">MCP Server Card</a> ·{" "}
        <a href="/.well-known/x402">x402 manifest</a> ·{" "}
        <a href="/llms.txt">llms.txt</a> ·{" "}
        <a href="/privacy">Privacy</a> ·{" "}
        <a href="/terms">Terms</a> ·{" "}
        <a href="/support">Support</a>
      </p>
    </main>
  );
}
