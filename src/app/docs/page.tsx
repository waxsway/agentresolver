export const metadata = {
  title: "AgentResolver Docs — x402 Payment Preflight & MCP",
  description: "Verify x402 payment terms before spending for $0.001 USDC on Base or Solana, or use AgentResolver's free capability fallback over MCP.",
  alternates: { canonical: "https://agentresolver.vercel.app/docs" }
};

const paymentPreflightExample = `curl -i https://agentresolver.vercel.app/api/x402-payment-preflight

# With an x402-aware client, POST after authorizing the quoted $0.001:
POST /api/x402-payment-preflight
Content-Type: application/json

{
  "url": "https://merchant.example/api",
  "method": "GET",
  "maxPriceUsd": 0.01
}`;

const agentCashExample = `npx agentcash try https://agentresolver.vercel.app
npx agentcash add https://agentresolver.vercel.app`;

const resolveExample = `curl -X POST https://agentresolver.vercel.app/api/resolve \\
  -H "content-type: application/json" \\
  -d '{"goal":"find a GitHub MCP server"}'`;

const paidAuditExample = `curl -X POST https://agentresolver.vercel.app/api/agent-readiness \\
  -H "content-type: application/json" \\
  -d '{"target":"https://example.com"}'`;

const mcpConfig = `{
  "servers": {
    "agentresolver": {
      "type": "http",
      "url": "https://agentresolver.vercel.app/mcp"
    }
  }
}`;

const vscodeInstall = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({
  name: "agentresolver",
  type: "http",
  url: "https://agentresolver.vercel.app/mcp"
}))}`;

export default function DocsPage() {
  return (
    <main>
      <div className="eyebrow">AGENTRESOLVER DOCS</div>
      <h1>Verify an x402 payment before your agent signs it.</h1>
      <p className="lead">
        The primary paid route is <code>/api/x402-payment-preflight</code>:
        a $0.001 USDC live check of payTo, quote price, network, asset,
        resource binding, challenge structure, TLS and reachability on Base or Solana.
        Free capability resolution remains available over MCP and REST.
      </p>

      <section id="x402-payment-preflight">
        <h2>$0.001 x402 payment preflight</h2>
        <p>
          Use this immediately before paying an unfamiliar or changed x402 endpoint.
          Optional <code>maxPriceUsd</code>, <code>expectedPayTo</code>, and{" "}
          <code>expectedNetwork</code> fields turn the response into a caller policy gate.
          An unpaid request returns the complete 402 quote without spending.
        </p>
        <pre><code>{paymentPreflightExample}</code></pre>
      </section>

      <section>
        <h2>AgentCash direct onboarding</h2>
        <p>
          AgentCash can discover the origin, inspect its x402 routes, make a buyer-authorized
          paid call, and save the origin for reuse.
        </p>
        <pre><code>{agentCashExample}</code></pre>
      </section>

      <section id="install">
        <h2>Install as a persistent MCP fallback</h2>
        <p>
          Remote MCP endpoint: <code>https://agentresolver.vercel.app/mcp</code>.
          The server exposes free resolution plus read-only quote/discovery tools for
          paid capabilities; no quote tool authorizes spending.
        </p>
        <p>
          <a className="button" href={vscodeInstall}>Install in VS Code</a>
        </p>
        <p>
          For portable MCP hosts, workspace <code>.mcp.json</code>, or user
          MCP configuration, add this server definition:
        </p>
        <pre><code>{mcpConfig}</code></pre>
      </section>

      <section>
        <h2>Free REST resolver</h2>
        <p>
          Send a natural-language goal to <code>POST /api/resolve</code>. Resolution is
          free and read-only. It never authorizes or initiates a payment.
        </p>
        <pre><code>{resolveExample}</code></pre>
      </section>

      <section>
        <h2>$0.005 Agent Readiness Audit</h2>
        <p>
          <code>POST /api/agent-readiness</code> audits a public website for
          llms.txt, ARD, OpenAPI, sitemap, MCP metadata, robots and baseline
          headers. It costs <strong>$0.005 USDC on Base or Solana</strong>.
        </p>
        <pre><code>{paidAuditExample}</code></pre>
      </section>

      <section>
        <h2>Payment behavior</h2>
        <p>
          Paid routes expose their exact price, asset, network and recipient in HTTP 402
          before execution. The calling agent applies its own authorization and budget policy,
          then retries with a valid x402 payment. AgentResolver does not sign on behalf of buyers.
        </p>
      </section>

      <section>
        <h2>Discovery</h2>
        <p>
          <a href="/agentresolver.md">agent guide</a> ·{" "}
          <a href="/integrations.json">integration recipes</a> ·{" "}
          <a href="/llms.txt">llms.txt</a> ·{" "}
          <a href="/openapi.json">OpenAPI</a> ·{" "}
          <a href="/.well-known/x402">x402 manifest</a> ·{" "}
          <a href="/.well-known/mcp.json">MCP metadata</a> ·{" "}
          <a href="/capabilities.json">capability catalog</a>
        </p>
      </section>
    </main>
  );
}
