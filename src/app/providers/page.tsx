export const metadata = {
  title: "For Providers — AgentResolver",
  description: "Get discovered by AI agents looking for external tools, APIs, MCP servers, and machine services.",
  alternates: { canonical: "https://agentresolver.vercel.app/providers" }
};

export default function ProvidersPage() {
  return (
    <main>
      <div className="eyebrow">AGENTRESOLVER FOR PROVIDERS</div>
      <h1>Be there when an agent needs what you sell.</h1>
      <p className="lead">
        AgentResolver helps autonomous agents find external capabilities when
        their current toolset is missing something. Organic inclusion remains
        free. The founding provider pilot adds disclosed, relevance-limited
        placement and demand reporting without changing the integrity of
        organic results.
      </p>

      <div className="grid">
        <section>
          <h2>Organic — free</h2>
          <p>
            Eligible public providers can appear in normal resolver results
            based on capability relevance. Payment is not required for organic
            discovery.
          </p>
        </section>
        <section>
          <h2>Founding Provider — $250/mo</h2>
          <p>
            A limited pilot for providers that want a claimed profile,
            disclosed sponsored eligibility when relevant, and a monthly
            qualified-demand summary. No guaranteed rank or volume.
          </p>
        </section>
        <section>
          <h2>Trust stays intact</h2>
          <p>
            Sponsored treatment is labeled, must still match the requested
            capability, and never authorizes an agent to spend money or use a
            provider automatically.
          </p>
        </section>
      </div>

      <section>
        <h2>Founding pilot terms</h2>
        <p>
          Month-to-month. Cancel any time before the next billing period.
          AgentResolver does not promise traffic, conversions, rankings, or
          revenue. The pilot is intended to establish measurable demand before
          expanding provider products.
        </p>
        <p>
          <a className="button" href="mailto:waxsway@gmail.com?subject=AgentResolver%20Founding%20Provider&body=Provider%20name%3A%0AWebsite%3A%0ACapabilities%3A%0AMCP%20or%20API%20endpoint%3A%0A">
            Request a founding provider slot
          </a>
        </p>
      </section>

      <p className="links">
        <a href="/">AgentResolver</a> ·{" "}
        <a href="/docs">Integration docs</a> ·{" "}
        <a href="/openapi.json">OpenAPI</a>
      </p>
    </main>
  );
}
