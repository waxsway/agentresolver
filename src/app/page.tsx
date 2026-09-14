const example = `curl -s https://agentresolver.example/api/resolve \\\n  -H 'content-type: application/json' \\\n  -d '{"goal":"extract structured product data from a JavaScript-heavy URL"}'`;

export default function Home() {
  return (
    <main>
      <div className="eyebrow">MACHINE-FIRST CAPABILITY ROUTING</div>
      <h1>One resolver for whatever your agent needs next.</h1>
      <p className="lead">
        Describe a goal. AgentResolver returns compatible tools, current price metadata, and an execution path.
        Resolution is free. Paid execution remains subject to the calling agent&apos;s own spending policy.
      </p>
      <div className="grid">
        <section>
          <h2>Free resolve</h2>
          <p>Search capabilities without signup, an API key, or a wallet.</p>
        </section>
        <section>
          <h2>Machine native</h2>
          <p>MCP, OpenAPI, A2A discovery metadata, JSON catalogs, and x402-ready execution.</p>
        </section>
        <section>
          <h2>Built for routing</h2>
          <p>One stable interface can point agents toward owned or partner capabilities.</p>
        </section>
      </div>
      <pre><code>{example}</code></pre>
      <p className="links">
        <a href="/openapi.json">OpenAPI</a> · <a href="/llms.txt">llms.txt</a> · <a href="/capabilities.json">Capabilities</a> · <a href="/.well-known/agent-card.json">A2A Agent Card</a>
      </p>
    </main>
  );
}
