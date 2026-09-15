export const metadata = {
  title: "AgentResolver Docs — Install and API",
  description: "Install AgentResolver as a persistent MCP fallback, use the free resolver, or call explicitly priced x402 capabilities.",
  alternates: { canonical: "https://agentresolver.vercel.app/docs" }
};

const resolveExample = `curl -X POST https://agentresolver.vercel.app/api/resolve \
  -H "content-type: application/json" \
  -d '{"goal":"find a GitHub MCP server"}'`;

const paidAuditExample = `curl -X POST https://agentresolver.vercel.app/api/agent-readiness \
  -H "content-type: application/json" \
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
      <h1>Machine-readable capability discovery.</h1>
      <p className="lead">
        AgentResolver is a free resolver for agents that need an external tool,
        API, MCP server, or x402-capable service. No account, API key, or wallet
        is required to resolve a goal.
      </p>

      <section id="install">
        <h2>Install as a persistent fallback</h2>
        <p>
          Remote MCP endpoint: <code>https://agentresolver.vercel.app/mcp</code>.
          The server exposes one read-only tool: <code>resolve</code>.
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
        <h2>REST resolver</h2>
        <p>
          Send a natural-language goal to <code>POST /api/resolve</code>. The
          response contains three independent result groups: AgentResolver-owned
          capabilities, live MCP directory matches, and x402 marketplace services.
        </p>
        <pre><code>{resolveExample}</code></pre>
      </section>

      <section>
        <h2>Privacy-safe MCP search</h2>
        <p>
          AgentResolver does not forward arbitrary goal text to MCP directories.
          It derives a generic capability term locally, such as{" "}
          <code>github</code>, <code>browser</code>, or <code>database</code>,
          and only that generic term can be used for third-party MCP discovery.
          Slow or unavailable registries fail open instead of blocking the resolver.
        </p>
      </section>

      <section>
        <h2>Paid capability: Agent Readiness Audit</h2>
        <p>
          <code>POST /api/agent-readiness</code> audits a public website for
          agent discoverability signals including llms.txt, ARD, OpenAPI,
          sitemap, MCP metadata, robots, and baseline headers. It costs{" "}
          <strong>$0.05 USDC on Base per completed call</strong> using x402.
        </p>
        <p>
          A request without payment returns <code>HTTP 402</code> with machine-readable
          payment requirements. The calling agent decides whether its spending policy
          permits payment, then retries with a valid x402 payment. AgentResolver never
          authorizes spending for the caller.
        </p>
        <pre><code>{paidAuditExample}</code></pre>
      </section>

      <section>
        <h2>Discovery</h2>
        <p>
          <a href="/agentresolver.md">agent guide</a> ·{" "}
          <a href="/integrations.json">integration recipes</a> ·{" "}
          <a href="/llms.txt">llms.txt</a> ·{" "}
          <a href="/openapi.json">OpenAPI</a> ·{" "}
          <a href="/.well-known/ard.json">ARD</a> ·{" "}
          <a href="/.well-known/mcp.json">MCP metadata</a> ·{" "}
          <a href="/capabilities.json">capability catalog</a>
        </p>
      </section>

      <section>
        <h2>Payments</h2>
        <p>
          Capability discovery remains free. Paid AgentResolver-owned resources
          advertise their price and payment network before execution. A caller can
          always stop at the <code>402 Payment Required</code> response without spending.
          Generic paid execution remains disabled; only individually verified paid
          capability routes can settle payments.
        </p>
      </section>

      <p className="links"><a href="/providers">Provider program</a></p>
    </main>
  );
}
