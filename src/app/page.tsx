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
        <a href="/docs">Docs</a> ·{" "}
        <a href="/mcp/server-card">MCP Server Card</a> ·{" "}
        <a href="/.well-known/x402">x402 manifest</a> ·{" "}
        <a href="/llms.txt">llms.txt</a> ·{" "}
        <a href="/capabilities.json">Capabilities</a> ·{" "}
        <a href="/legal">Legal & Safety</a>
      </p>
    </main>
  );
}
