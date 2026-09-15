const example = `POST /api/resolve
Content-Type: application/json

{"goal":"find a GitHub MCP server"}`;

export default function Home() {
  return (
    <main>
      <div className="eyebrow">MACHINE-FIRST CAPABILITY ROUTING</div>
      <h1>One resolver for whatever your agent needs next.</h1>
      <p className="lead">
        Describe a goal. AgentResolver returns ranked owned capabilities, live
        MCP server matches, and x402 marketplace services. Resolution is free,
        requires no account or API key, and does not spend money.
      </p>

      <div className="grid">
        <section>
          <h2>Live MCP discovery</h2>
          <p>
            Search live MCP directories using privacy-safe capability keywords,
            with timeouts and graceful fallback.
          </p>
        </section>
        <section>
          <h2>Machine native</h2>
          <p>
            MCP, OpenAPI, JSON catalogs, llms.txt, ARD, and x402 marketplace
            metadata from one stable endpoint.
          </p>
        </section>
        <section>
          <h2>Paid execution: off</h2>
          <p>
            AgentResolver-owned paid capabilities are visible for demand
            measurement but are not executable until their verified payment
            routes are enabled.
          </p>
        </section>
      </div>

      <pre><code>{example}</code></pre>

      <p className="links">
        <a href="/docs">Docs</a> ·{" "}
        <a href="/openapi.json">OpenAPI</a> ·{" "}
        <a href="/llms.txt">llms.txt</a> ·{" "}
        <a href="/capabilities.json">Capabilities</a>
      </p>
    </main>
  );
}
