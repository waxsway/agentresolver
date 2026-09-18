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
        AgentResolver routes machine intent to registered services. Organic
        discovery stays independent, sponsored placement is explicitly labeled,
        and the provider-funded pilot can settle a fixed $0.001 USDC attribution
        fee after a provider reports an attributed request as fulfilled.
      </p>

      <div className="grid">
        <section>
          <h2>Registered routing</h2>
          <p>
            AgentResolver returns execution-ready handoffs only for registered
            routes. It does not proxy arbitrary URLs, hold wallet keys, forward
            payment signatures, or authorize buyer spend.
          </p>
        </section>
        <section>
          <h2>Provider-funded success fee</h2>
          <p>
            Pilot partners can fund distribution instead of requiring every
            buyer to pay AgentResolver separately. The current deterministic
            pilot fee is $0.001 USDC per provider-reported fulfilled attribution.
          </p>
        </section>
        <section>
          <h2>Sponsored discovery</h2>
          <p>
            Providers can also apply for disclosed relevance-limited sponsored
            placement. Sponsorship never changes the organic ranking contract.
          </p>
        </section>
      </div>

      <section>
        <h2>Machine flow</h2>
        <p>
          Agents resolve a capability, receive registered provider routes, ask
          <code> /api/execute </code> for a handoff and attribution ID, then call
          the selected provider directly under their own trust and spending
          policy. Provider partners can settle the attribution fee through
          <code> /api/provider-attribution-settle</code>.
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
          than raw goals or raw IP addresses. During the pilot, operator
          reporting uses existing runtime telemetry; no new paid analytics
          storage service has been introduced.
        </p>
        <p>
          <a className="button" href={sponsorshipApply}>
            Apply for a provider pilot
          </a>
        </p>
      </section>

      <p className="links">
        <a href="/api/providers">Provider network API</a> ·{" "}
        <a href="/provider-integration.json">Integration contract</a> ·{" "}
        <a href="/api/sponsorship">Sponsorship info</a> ·{" "}
        <a href="/docs">Integration docs</a>
      </p>
    </main>
  );
}
