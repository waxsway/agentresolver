import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "x402 Reliability Router | AgentResolver",
  description:
    "Drop-in x402 facilitator routing with verify observability and fail-closed settlement semantics."
};

const snippet = `import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitator = new HTTPFacilitatorClient({
  url: "https://agentresolver.vercel.app",
  timeoutMs: 10_000
});`;

export default function FacilitatorPage() {
  return (
    <main>
      <div className="eyebrow">X402 RELIABILITY ROUTER</div>
      <h1>Put AgentResolver in the settlement path with one facilitator URL.</h1>
      <p className="lead">
        Keep your existing payTo address and buyer signatures. AgentResolver
        proxies the standard x402 facilitator contract, records bounded
        reliability evidence, and refuses unsafe blind settlement failover.
      </p>

      <div className="grid">
        <section>
          <h2>Standard surface</h2>
          <p><code>GET /supported</code></p>
          <p><code>POST /verify</code></p>
          <p><code>POST /settle</code></p>
        </section>
        <section>
          <h2>Verify safely</h2>
          <p>
            Verification is read-only. An explicitly configured secondary can
            be used if the primary verifier is unavailable.
          </p>
        </section>
        <section>
          <h2>Settle once</h2>
          <p>
            Settlement gets one upstream submission. Ambiguous timeout/5xx
            outcomes return non-retry-safe instead of risking a double charge.
          </p>
        </section>
      </div>

      <h2>Drop-in JavaScript configuration</h2>
      <pre><code>{snippet}</code></pre>

      <section>
        <h2>Non-custodial by design</h2>
        <p>
          AgentResolver never asks for merchant or buyer private keys, never
          replaces the merchant payTo recipient, and does not custody or
          forward the principal payment.
        </p>
        <p className="actions">
          <a className="button" href="/supported">Check live supported schemes</a>{" "}
          <a className="button secondary" href="https://github.com/waxsway/agentresolver/blob/main/docs/x402-reliability-router.md">
            Integration guide
          </a>
        </p>
      </section>
    </main>
  );
}
