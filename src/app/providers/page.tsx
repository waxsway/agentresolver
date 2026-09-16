export const metadata = {
  title: "For Providers — AgentResolver",
  description: "Get discovered by AI agents looking for external tools, APIs, MCP servers, and machine services.",
  alternates: { canonical: "https://agentresolver.vercel.app/providers" }
};

const sponsorshipApply =
  "https://github.com/waxsway/agentresolver/issues/new?template=sponsorship.yml";

export default function ProvidersPage() {
  return (
    <main>
      <div className="eyebrow">AGENTRESOLVER FOR PROVIDERS</div>
      <h1>Be there when an agent needs what you sell.</h1>
      <p className="lead">
        AgentResolver helps autonomous agents find external capabilities when
        their current toolset is missing something. Organic inclusion remains
        free. A provider-funded sponsorship pilot is open for explicitly
        labeled, relevance-limited placements that never change organic rank.
      </p>

      <div className="grid">
        <section>
          <h2>Organic discovery — free</h2>
          <p>
            Eligible public providers can appear in resolver results based on
            capability relevance. Sponsorship is never required for organic
            inclusion.
          </p>
        </section>
        <section>
          <h2>Founding sponsorship pilot</h2>
          <p>
            Providers can apply for a labeled sponsored placement alongside
            matching agent intent. Pricing, duration, placement, and reporting
            are agreed only after operator approval. Applying creates no
            purchase or financial commitment.
          </p>
        </section>
        <section>
          <h2>Trust stays intact</h2>
          <p>
            Sponsored treatment is machine-readably labeled, must match the
            requested capability, and does not alter organic ranking or
            authorize an agent to spend money.
          </p>
        </section>
      </div>

      <section>
        <h2>What the pilot can measure</h2>
        <p>
          AgentResolver can distinguish qualified intent from directory probes,
          liveness crawlers, internal smoke traffic, and paid retries. Pilot
          reporting is designed around eligible and qualified-intent
          impressions rather than inflated raw request counts.
        </p>
        <p>
          <a className="button" href={sponsorshipApply}>
            Apply for the sponsorship pilot
          </a>
        </p>
        <p>
          Submission is an inquiry only. No placement, billing, ranking,
          traffic volume, conversion, or revenue is guaranteed.
        </p>
      </section>

      <p className="links">
        <a href="/">AgentResolver</a> ·{" "}
        <a href="/api/sponsorship">Machine-readable sponsorship info</a> ·{" "}
        <a href="/.well-known/sponsorship.json">Sponsorship manifest</a> ·{" "}
        <a href="/docs">Integration docs</a>
      </p>
    </main>
  );
}
