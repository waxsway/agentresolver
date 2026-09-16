export default function Legal() {
  return (
    <main>
      <div className="eyebrow">LEGAL & SAFETY</div>
      <h1>AgentResolver operating terms.</h1>
      <p className="lead">
        Last updated September 16, 2026. These terms describe the current
        non-custodial AgentResolver service and its machine-readable x402
        verification utilities.
      </p>

      <section>
        <h2>What the service does</h2>
        <p>
          AgentResolver provides technical observations about public endpoints
          and machine-readable payment challenges. Results describe what the
          service observed at a point in time. They are not a certification,
          endorsement, fraud determination, guarantee of future behavior,
          financial advice, or legal advice.
        </p>
      </section>

      <section>
        <h2>Trust model</h2>
        <p>
          AgentResolver distinguishes technical payment evidence from provider
          identity and fulfillment. A result may show that an endpoint presented
          a valid x402 challenge, a specific payTo wallet, price, network, asset,
          and resource binding. That observation does not prove that the wallet
          is legally owned by a named business, that the business is legitimate,
          or that a provider will deliver a promised service. Evidence receipts
          use stable fingerprints to help buyers detect changes across
          observations without making those stronger identity or fulfillment
          claims.
        </p>
      </section>

      <section>
        <h2>Payments and custody</h2>
        <p>
          Payments to AgentResolver purchase AgentResolver&apos;s own digital
          services. AgentResolver does not hold customer balances, operate an
          escrow account, custody customer assets, or accept a third
          party&apos;s principal payment for later transmission to another
          seller. The caller controls its wallet and payment authorization.
          Blockchain transactions may be irreversible.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not use AgentResolver to violate law, access systems without
          authorization, bypass access controls, distribute malware, interfere
          with services, evade sanctions or compliance controls, misrepresent
          identity or affiliation, or probe private/internal network targets.
          Users remain responsible for the legality of the endpoints and
          workflows they choose to inspect or call.
        </p>
      </section>

      <section>
        <h2>Privacy and telemetry</h2>
        <p>
          AgentResolver uses limited operational telemetry to measure
          reliability, discovery traffic, paid attempts, and confirmed
          settlements. Application telemetry may include a one-way shortened
          hash derived from the caller IP, user-agent, referrer hostname,
          requested capability, whether a payment signature was present, and
          hashed settlement identifiers. AgentResolver does not intentionally
          persist paid request bodies in its application telemetry. Hosting and
          network providers may process standard request metadata needed to
          operate the service.
        </p>
      </section>

      <section>
        <h2>Third-party services and names</h2>
        <p>
          AgentResolver may inspect, reference, or interoperate with independent
          third-party protocols, directories, facilitators, endpoints, and
          developer tools. Those references identify interoperability targets
          only and do not imply sponsorship, partnership, endorsement, or
          affiliation unless expressly stated.
        </p>
      </section>

      <section>
        <h2>Availability and responsibility</h2>
        <p>
          The service is provided on an as-available basis. Buyers should
          independently decide whether an observation is sufficient for their
          use case and should apply their own spending, security, compliance,
          and authorization policies before signing or sending a payment.
        </p>
      </section>

      <p className="links">
        <a href="/">Home</a> ·{" "}
        <a href="/docs">Docs</a> ·{" "}
        <a href="/openapi.json">OpenAPI</a>
      </p>
    </main>
  );
}
