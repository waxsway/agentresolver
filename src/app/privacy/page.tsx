import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — AgentResolver",
  description: "Privacy policy for the AgentResolver website, API, and hosted MCP service."
};

export default function PrivacyPage() {
  return (
    <main>
      <div className="eyebrow">PRIVACY</div>
      <h1>AgentResolver privacy policy.</h1>
      <p className="lead">
        Last updated September 23, 2026. This policy describes data processed
        when you use the AgentResolver website, API, and hosted MCP service.
      </p>

      <section>
        <h2>Data processed to operate the service</h2>
        <p>
          AgentResolver processes request information needed to answer API and
          MCP calls. Limited operational telemetry may include a one-way
          shortened hash derived from caller IP, user-agent, referrer hostname,
          requested capability, whether a payment signature was present, status
          and timing information, and hashed settlement identifiers.
        </p>
      </section>

      <section>
        <h2>Tool inputs and payment data</h2>
        <p>
          Inputs are processed to perform the requested operation. AgentResolver
          does not intentionally persist paid request bodies in its application
          telemetry. For paid tools, public blockchain transaction references
          and settlement evidence may be processed or published to verify that a
          payment occurred. AgentResolver never asks for or stores wallet private
          keys or seed phrases.
        </p>
      </section>

      <section>
        <h2>Service providers</h2>
        <p>
          Hosting, networking, source-control, and payment infrastructure may
          process standard technical metadata needed to operate the service.
          Their handling of that information is governed by their own policies.
        </p>
      </section>

      <section>
        <h2>How data is used</h2>
        <p>
          Operational data is used to provide responses, protect the service,
          diagnose failures, measure reliability and abuse, distinguish
          discovery traffic from paid activity, and verify settlements.
          AgentResolver does not sell personal data to advertisers.
        </p>
      </section>

      <section>
        <h2>Retention and security</h2>
        <p>
          Operational records are retained only as needed to operate, secure,
          troubleshoot, and document the service. Infrastructure providers may
          maintain their own technical logs. Do not send secrets, credentials,
          private keys, seed phrases, or unnecessary personal information to
          AgentResolver.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Privacy questions can be sent to{" "}
          <a href="mailto:waxsway@gmail.com">waxsway@gmail.com</a>.
        </p>
      </section>

      <p className="links">
        <a href="/">Home</a> · <a href="/connector">Connector info</a> ·{" "}
        <a href="/terms">Terms</a> · <a href="/support">Support</a>
      </p>
    </main>
  );
}
