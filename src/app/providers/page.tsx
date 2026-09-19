export const metadata = {
  title: "For Providers — AgentResolver",
  description:
    "Join AgentResolver's machine-service routing network with a domain-controlled manifest and verified provider-funded success fees.",
  alternates: { canonical: "https://agentresolver.vercel.app/providers" }
};

export default function ProvidersPage() {
  return (
    <main>
      <div className="eyebrow">AGENTRESOLVER FOR PROVIDERS</div>
      <h1>Sell to agents with one well-known file.</h1>
      <p className="lead">
        No account, email, API key, wallet custody, or manual registry review is
        required for domain-controlled enrollment. Publish the AgentResolver
        provider manifest on the same origin as your x402 service.
      </p>

      <div className="grid">
        <section>
          <h2>1. Publish</h2>
          <p>
            Serve <code>/.well-known/agentresolver-provider.json</code> from your
            domain. It declares your same-origin routes, Base-USDC payment
            identity, and acceptance of the provider success-fee contract.
          </p>
        </section>
        <section>
          <h2>2. Get routed</h2>
          <p>
            When your route is discovered through a supported capability
            catalog, AgentResolver can verify the manifest and return your route
            in constrained procurement. Hard buyer constraints still win.
          </p>
        </section>
        <section>
          <h2>3. Prove the sale</h2>
          <p>
            A selected domain provider receives an
            <code> x-agentresolver-attribution-id</code> handoff. After a routed
            sale, submit the buyer transaction for independent Base-USDC
            verification.
          </p>
        </section>
        <section>
          <h2>4. Pay on success</h2>
          <p>
            The provider success fee is 2% of verified routed GMV with a
            $0.001 minimum. AgentResolver adds no extra buyer fee. The exact
            provider fee amount is attribution-bound to prevent simple proof
            replay.
          </p>
        </section>
      </div>

      <section>
        <h2>Proof, not claims</h2>
        <p>
          AgentResolver verifies the buyer-to-provider Base-USDC settlement and
          the provider-to-AgentResolver success-fee transfer independently. The
          buyer&apos;s wallet remains outside AgentResolver custody and only the
          caller can authorize provider spend.
        </p>
      </section>

      <section>
        <h2>Optional deeper verification</h2>
        <p>
          The paid <code>/api/provider-launch-check</code> remains available for
          a deeper x402 readiness/payment-contract audit. It is not an admission
          gate for domain-controlled enrollment.
        </p>
      </section>

      <p className="links">
        <a href="/provider-manifest.example.json">Manifest example</a> ·{" "}
        <a href="/provider-onboarding.md">Machine onboarding</a> ·{" "}
        <a href="/provider-integration.json">Commercial contract</a> ·{" "}
        <a href="/api/providers">Provider API</a>
      </p>
    </main>
  );
}
