import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — AgentResolver",
  description: "Terms of service for the AgentResolver website, API, and hosted MCP service."
};

export default function TermsPage() {
  return (
    <main>
      <div className="eyebrow">TERMS OF SERVICE</div>
      <h1>AgentResolver terms of service.</h1>
      <p className="lead">
        Last updated September 23, 2026. These terms apply to the AgentResolver
        website, API, hosted MCP service, and paid verification tools.
      </p>

      <section>
        <h2>Service</h2>
        <p>
          AgentResolver provides technical observations about public endpoints,
          machine-readable capabilities, and x402 payment challenges. Results
          describe evidence observed at a point in time and are not a
          certification, endorsement, fraud determination, guarantee of future
          behavior, financial advice, or legal advice.
        </p>
      </section>

      <section>
        <h2>Payments and authorization</h2>
        <p>
          Paid AgentResolver tools disclose their payment requirements before
          execution. The caller decides whether to authorize payment and keeps
          control of its wallet. AgentResolver does not custody customer funds,
          operate escrow, receive private keys, or authorize a third-party
          merchant payment on the caller&apos;s behalf.
        </p>
      </section>

      <section>
        <h2>User responsibility</h2>
        <p>
          You are responsible for deciding whether an AgentResolver observation
          is sufficient for your use case and for applying your own security,
          spending, compliance, and authorization policies before signing or
          sending a payment.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not use AgentResolver to violate law, access systems without
          authorization, bypass access controls, distribute malware, interfere
          with services, evade sanctions or compliance controls, misrepresent
          identity or affiliation, or probe private or internal network targets.
        </p>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          AgentResolver may inspect or interoperate with independent protocols,
          endpoints, wallets, facilitators, directories, and developer tools.
          Those references do not imply sponsorship, partnership, endorsement,
          or affiliation unless expressly stated.
        </p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>
          The service is provided on an as-available basis. Public endpoints and
          payment challenges can change after they are observed, and blockchain
          transactions may be irreversible.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
          <a href="mailto:waxsway@gmail.com">waxsway@gmail.com</a>.
        </p>
      </section>

      <p className="links">
        <a href="/">Home</a> · <a href="/connector">Connector info</a> ·{" "}
        <a href="/privacy">Privacy</a> · <a href="/support">Support</a>
      </p>
    </main>
  );
}
