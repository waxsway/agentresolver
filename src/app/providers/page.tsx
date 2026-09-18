export const metadata = {
  title: "For Providers — AgentResolver",
  description: "Join AgentResolver's machine-service routing and provider-funded attribution network.",
  alternates: { canonical: "https://agentresolver.vercel.app/providers" }
};

const sponsorshipApply =
  "https://github.com/waxsway/agentresolver/issues/new?template=sponsorship.yml";

export default function ProvidersPage() {
  return (
    <main>
      <div className="eyebrow">AGENTRESOLVER FOR PROVIDERS</div>
      <h1>Sell to agents without making every agent discover you first.</h1>
      <p className="lead">
        AgentResolver routes machine intent to registered services. Providers can
        buy a machine-native launch check, submit the generated registry packet
        for review, and fund attributed distribution after fulfillment.
      </p>

      <div className="grid">
        <section>
          <h2>Paid launch check</h2>
          <p>
            Buy a $0.05 USDC x402 readiness and payment-contract check at
            <code> /api/provider-launch-check</code>. A passing paid result returns
            the bounded registry packet used for provider-network review.
          </p>
        </section>
        <section>
          <h2>Registered routing</h2>
          <p>
            AgentResolver returns execution-ready handoffs only for reviewed
            registered routes. It does not proxy arbitrary URLs, hold wallet
            keys, forward payment signatures, or authorize buyer spend.
          </p>
        </section>
        <section>
          <h2>Provider-funded success fee</h2>
          <p>
            Pilot partners can fund distribution instead of requiring every
            buyer to pay AgentResolver separately. Current machine-readable
            success-fee terms are published through the provider network API.
          </p>
        </section>
        <section>
          <h2>Sponsored discovery</h2>
          <p>
            Providers can separately apply for disclosed relevance-limited
            sponsored placement. Sponsorship never changes the organic ranking
            contract and applying creates no purchase or financial commitment.
          </p>
        </section>
      </div>

      <section>
        <h2>Machine flow</h2>
        <p>
          Provider pays for launch verification → submits the returned registry
          entry → approved route becomes discoverable → agents receive attributed
          direct handoffs → provider can settle the attribution fee after a
          fulfilled request.
        </p>
        <p>
          A successful provider-fee settlement proves that the provider paid
          AgentResolver&apos;s fee. It does not by itself prove the underlying
          buyer transaction or fulfillment.
        </p>
      </section>

      <section>
        <h2>Privacy-conscious reporting</h2>
        <p>
          The routing layer emits hashed demand and attribution events rather
          than raw goals or raw IP addresses. Pilot reporting uses existing
          runtime telemetry; no new paid analytics storage service is required.
        </p>
        <p>
          <a className="button" href={sponsorshipApply}>
            Apply for a provider pilot
          </a>
        </p>
      </section>

      <p className="links">
        <a href="/api/providers">Provider network API</a> ·{" "}
        <a href="/api/provider-launch-check">Paid launch check</a> ·{" "}
        <a href="/provider-integration.json">Integration contract</a> ·{" "}
        <a href="/provider-onboarding.md">Onboarding contract</a> ·{" "}
        <a href="/api/sponsorship">Sponsorship info</a>
      </p>
    </main>
  );
}
