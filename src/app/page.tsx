const example = `POST /api/resolve
Content-Type: application/json

{"goal":"find a GitHub MCP server"}`;

const vscodeInstall = `vscode:mcp/install?${encodeURIComponent(JSON.stringify({
  name: "agentresolver",
  type: "http",
  url: "https://agentresolver.vercel.app/mcp"
}))}`;

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

      <p className="actions">
        <a className="button" href={vscodeInstall}>Install in VS Code</a>{" "}
        <a className="button secondary" href="/docs#install">Other MCP hosts</a>
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
          <h2>Provider demand</h2>
          <p>
            Providers can stay organically discoverable for free or join a
            disclosed founding provider pilot for measurable qualified demand.
          </p>
        </section>
      </div>

      <pre><code>{example}</code></pre>

      <p className="links">
        <a href="/docs">Docs</a> ·{" "}
        <a href="/providers">For providers</a> ·{" "}
        <a href="/openapi.json">OpenAPI</a> ·{" "}
        <a href="/llms.txt">llms.txt</a> ·{" "}
        <a href="/capabilities.json">Capabilities</a>
      </p>
    </main>
  );
}
