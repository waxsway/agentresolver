import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — AgentResolver",
  description: "Support and integration help for AgentResolver."
};

export default function SupportPage() {
  return (
    <main>
      <div className="eyebrow">SUPPORT</div>
      <h1>AgentResolver support.</h1>
      <p className="lead">
        For connector review, MCP integration, payment behavior, or general
        product questions, contact{" "}
        <a href="mailto:waxsway@gmail.com">waxsway@gmail.com</a>.
      </p>

      <section>
        <h2>Integration references</h2>
        <p>
          Hosted MCP: <code>https://agentresolver.vercel.app/mcp</code>
        </p>
        <p>
          <a href="/docs">Documentation</a> ·{" "}
          <a href="/connector">Connector information</a> ·{" "}
          <a href="/mcp/server-card">MCP server card</a> ·{" "}
          <a href="/openapi.json">OpenAPI</a>
        </p>
      </section>

      <section>
        <h2>Security reports</h2>
        <p>
          Security information and the preferred reporting path are published at{" "}
          <a href="/.well-known/security.txt">/.well-known/security.txt</a>.
          Never send private keys or seed phrases in a support request.
        </p>
      </section>

      <p className="links">
        <a href="/">Home</a> · <a href="/privacy">Privacy</a> ·{" "}
        <a href="/terms">Terms</a>
      </p>
    </main>
  );
}
