const resolveExample = `curl -X POST https://agentresolver.vercel.app/api/resolve \
  -H "content-type: application/json" \
  -d '{"goal":"find a service that can extract structured data from a webpage"}'`;

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

      <section>
        <h2>REST resolver</h2>
        <p>
          Send a natural-language goal to <code>POST /api/resolve</code>. The
          response includes AgentResolver capabilities and matching marketplace
          services with machine-readable invocation and price metadata.
        </p>
        <pre><code>{resolveExample}</code></pre>
      </section>

      <section>
        <h2>MCP</h2>
        <p>
          Streamable HTTP endpoint: <code>https://agentresolver.vercel.app/mcp</code>
        </p>
        <p>
          Tools: <code>resolve</code> and <code>list_capabilities</code>.
          Resolver calls are read-only and free.
        </p>
      </section>

      <section>
        <h2>Discovery</h2>
        <p>
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
          Resolution does not spend money. Any paid capability must use its own
          verified payment route, and the calling agent remains responsible for
          its authorization and spending policy.
        </p>
      </section>
    </main>
  );
}
