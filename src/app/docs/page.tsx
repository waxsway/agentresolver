const resolveExample = `curl -X POST https://agentresolver.vercel.app/api/resolve \
  -H "content-type: application/json" \
  -d '{"goal":"find a GitHub MCP server"}'`;

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
          Resolution does not spend money. Generic paid execution is intentionally
          disabled. A paid capability must expose its own verified payment route,
          and the calling agent remains responsible for its authorization and
          spending policy.
        </p>
      </section>
    </main>
  );
}
