const challengeExample = `curl -i https://agentresolver.vercel.app/api/x402-payment-preflight`;

const agentCashExample = `npx agentcash try https://agentresolver.vercel.app
npx agentcash add https://agentresolver.vercel.app`;

const paidExample = `POST /api/x402-payment-preflight
Content-Type: application/json

{
  "url": "https://merchant.example/api",
  "method": "GET",
  "maxPriceUsd": 0.01,
  "expectedNetwork": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
}`;

export default function Home() {
  return (
    <main>
      <div className="eyebrow">X402 VERIFY-BEFORE-PAY</div>
      <h1>Check an x402 payment before your agent signs it.</h1>
      <p className="lead">
        AgentResolver live-checks an unfamiliar x402 endpoint, decodes its
        payment challenge, and verifies payTo, quoted USDC price, network,
        asset, resource binding, TLS, and reachability before your agent spends.
        One check costs $0.001 USDC on Base or Solana.
      </p>

      <p className="actions">
        <a className="button" href="/api/x402-payment-preflight">See the live $0.001 quote</a>{" "}
        <a className="button secondary" href="/openapi.json">OpenAPI</a>
      </p>

      <section>
        <div className="eyebrow">HOSTED MCP CONNECTOR</div>
        <h2>Connect AgentResolver directly to an MCP host.</h2>
        <p>
          Hosted endpoint: <code>https://agentresolver.vercel.app/mcp</code>.
          No account, API key, OAuth login, or subscription is required to
          connect. Free discovery surfaces stay free; paid tools disclose their
          x402 USDC price before execution and require caller-controlled payment
          authorization.
        </p>
        <p className="actions">
          <a className="button" href="/connector">Connector information</a>{" "}
          <a className="button secondary" href="/docs">MCP documentation</a>
        </p>
      </section>

      <section>
        <div className="eyebrow">FOR API COMPANIES</div>
        <h2>Need an official MCP layer for your existing API?</h2>
        <p>
          AgentResolver also offers a fixed $1,000 implementation sprint for up
          to five existing API operations: first-party MCP, canonical discovery
          metadata, validation, and handoff. Your team owns the code.
        </p>
        <p className="actions">
          <a className="button" href="/mcp-sprint">See the $1,000 MCP sprint</a>
        </p>
      </section>

      <div className="grid">
        <section>
          <h2>PayTo verification</h2>
          <p>
            Compare the live payment recipient with the address your agent
            expects. Fail the policy check if the destination changed.
          </p>
        </section>
        <section>
          <h2>Budget guard</h2>
          <p>
            Set <code>maxPriceUsd</code> and verify the quoted USDC amount
            before signing a payment authorization.
          </p>
        </section>
        <section>
          <h2>Base + Solana</h2>
          <p>
            The same endpoint accepts $0.001 USDC over x402 on Base or Solana,
            with no account, API key, subscription, or card.
          </p>
        </section>
      </div>

      <h2>Use it from AgentCash</h2>
      <p>
        Discover the origin, make a live call, then keep AgentResolver available
        to the agent for future verify-before-pay checks.
      </p>
      <pre><code>{agentCashExample}</code></pre>

      <h2>Inspect the quote first</h2>
      <p>
        An unpaid request returns HTTP 402 with both supported payment options.
        Seeing the quote does not authorize spending.
      </p>
      <pre><code>{challengeExample}</code></pre>

      <h2>Paid preflight input</h2>
      <pre><code>{paidExample}</code></pre>

      <h2>Free capability fallback</h2>
      <p>
        AgentResolver still provides free capability resolution and MCP
        discovery when your agent is missing a tool. Connect the remote MCP
        endpoint at <code>https://agentresolver.vercel.app/mcp</code> or call
        <code> POST /api/resolve</code>. Free resolution never spends money.
      </p>

      <p className="links">
        <a href="/connector">Connector info</a> ·{" "}
        <a href="/docs">Docs</a> ·{" "}
        <a href="/mcp/server-card">MCP Server Card</a> ·{" "}
        <a href="/.well-known/x402">x402 manifest</a> ·{" "}
        <a href="/llms.txt">llms.txt</a> ·{" "}
        <a href="/capabilities.json">Capabilities</a> ·{" "}
        <a href="/privacy">Privacy</a> ·{" "}
        <a href="/terms">Terms</a> ·{" "}
        <a href="/support">Support</a>
      </p>
    </main>
  );
}
