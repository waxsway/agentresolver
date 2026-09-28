const monitorExample = `POST /api/service-monitor
Content-Type: application/json

{
  "label": "Example API",
  "origin": "https://api.example.com",
  "mcpEndpoint": "https://api.example.com/mcp",
  "x402Endpoint": "https://api.example.com/paid"
}`;

const distributionExample = `POST /api/agent-distribution-pack
Content-Type: application/json

{
  "providerName": "Example API",
  "description": "Current structured data for autonomous agents.",
  "origin": "https://api.example.com",
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
      <div className="eyebrow">MANAGED API + MCP MONITORING FOR AGENT SERVICES</div>
      <h1>Know when AI agents can no longer discover, call, or pay your service.</h1>
      <p className="lead">
        AgentResolver continuously checks the machine-facing parts of a public
        API, MCP server, x402 service, or agent product. Capture a free snapshot
        now, then use managed monitoring to detect compatibility, tool-contract,
        and payment-contract drift after launch.
      </p>

      <p className="actions">
        <a className="button" href="/monitor">
          Run a free monitoring snapshot
        </a>{" "}
        <a className="button secondary" href="/api/managed-monitor-30d">
          $19 / 30-day managed monitoring
        </a>
      </p>

      <div className="grid">
        <section>
          <h2>Catch compatibility drift</h2>
          <p>
            Re-check the public origin, discovery files, OpenAPI surface,
            security signals, and optional live MCP handshake instead of
            assuming yesterday&apos;s integration still works.
          </p>
        </section>
        <section>
          <h2>Fingerprint the MCP contract</h2>
          <p>
            AgentResolver can initialize the real MCP endpoint, list its tools,
            and fingerprint the exposed tool contracts so tool/schema changes
            become measurable drift.
          </p>
        </section>
        <section>
          <h2>Watch x402 payment terms</h2>
          <p>
            For GET-safe paid routes, monitor HTTP 402 behavior, network, asset,
            payTo recipient, amount, resource binding, and TLS without holding
            wallet keys or authorizing spend.
          </p>
        </section>
      </div>

      <h2>The monitoring contract</h2>
      <pre><code>{monitorExample}</code></pre>

      <section>
        <div className="eyebrow">LAUNCH + DISTRIBUTION</div>
        <h2>Need to make the service agent-readable first?</h2>
        <p>
          The existing Agent Distribution Pack remains available to diagnose
          discovery gaps and generate launch artifacts. It is now supporting
          the monitoring product rather than being the company&apos;s only
          commercial bet.
        </p>
        <pre><code>{distributionExample}</code></pre>
        <p className="actions">
          <a className="button secondary" href="/distribution">
            Agent Distribution
          </a>
        </p>
      </section>

      <section>
        <div className="eyebrow">HIGH-FREQUENCY X402 INFRASTRUCTURE</div>
        <h2>Route existing x402 verify + settle traffic through AgentResolver.</h2>
        <p>
          Existing sellers can point their facilitator client at
          <code> https://agentresolver.vercel.app</code>. AgentResolver exposes
          the standard /supported, /verify, and /settle surface, measures real
          routed settlement volume, and fails closed when settlement state is
          ambiguous instead of blindly retrying.
        </p>
        <p className="actions">
          <a className="button" href="/facilitator">Use the reliability router</a>
        </p>
      </section>

      <section>
        <div className="eyebrow">BUYER-SIDE INFRASTRUCTURE</div>
        <h2>Verify-before-pay remains available for autonomous buyers.</h2>
        <p>
          Buyer agents can still live-check payTo, quoted price, network, asset,
          resource binding, TLS, and reachability before signing.
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
          Free monitoring/discovery surfaces stay free; priced tools disclose
          their x402 USDC price before execution and require caller-controlled
          payment authorization.
        </p>
        <p className="actions">
          <a className="button secondary" href="/connector">Connector information</a>{" "}
          <a className="button secondary" href="/docs">MCP documentation</a>
        </p>
      </section>

      <section>
        <div className="eyebrow">IMPLEMENTATION OPTION</div>
        <h2>Need the MCP layer built for you?</h2>
        <p>
          The fixed $1,000 implementation sprint remains available for teams
          that want implementation instead of self-serve setup.
        </p>
        <p className="actions">
          <a className="button secondary" href="/mcp-sprint">See the MCP sprint</a>
        </p>
      </section>

      <p className="links">
        <a href="/facilitator">x402 Router</a> ·{" "}
        <a href="/monitor">Monitoring</a> ·{" "}
        <a href="/distribution">Agent Distribution</a> ·{" "}
        <a href="/openapi.json">OpenAPI</a> ·{" "}
        <a href="/mcp/server-card">MCP Server Card</a> ·{" "}
        <a href="/.well-known/x402">x402 manifest</a> ·{" "}
        <a href="/privacy">Privacy</a> ·{" "}
        <a href="/terms">Terms</a> ·{" "}
        <a href="/support">Support</a>
      </p>
    </main>
  );
}
