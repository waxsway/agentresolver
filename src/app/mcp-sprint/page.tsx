import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "First-party MCP Implementation Sprint — AgentResolver",
  description:
    "A fixed $1,000 implementation sprint to turn up to five existing API operations into a first-party MCP surface with discovery metadata, validation, and handoff."
};

const commercialTerms = [
  "Fixed fee: $1,000",
  "Start payment: $500",
  "Handoff payment: $500",
  "Scope: up to 5 existing API operations",
  "Ownership: your company owns the delivered code",
  "Deployment: your team / your environment",
  "Revision: 1 pass",
  "Recurring AgentResolver fee: none for this sprint"
].join("\n");

function sprintDepositUrl() {
  const raw = process.env.XPAY_SPRINT_DEPOSIT_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function McpSprintPage() {
  const depositUrl = sprintDepositUrl();

  return (
    <main>
      <div className="eyebrow">FIRST-PARTY MCP IMPLEMENTATION</div>
      <h1>Ship the official agent interface for the API you already have.</h1>
      <p className="lead">
        AgentResolver turns up to five existing API operations into a focused,
        first-party MCP surface with canonical discovery metadata, validation,
        and a clean handoff to your team. Fixed scope. No new API business
        logic. No hosting lock-in.
      </p>

      <p className="actions">
        {depositUrl ? (
          <a
            className="button"
            href={depositUrl}
            target="_blank"
            rel="noreferrer"
          >
            Pay the $500 start deposit
          </a>
        ) : (
          <a
            className="button"
            href="mailto:wade@credscore.us?subject=AgentResolver%20MCP%20Sprint"
          >
            Start the $1,000 sprint
          </a>
        )}{" "}
        <a className="button secondary" href="/">
          See AgentResolver infrastructure
        </a>
      </p>

      {depositUrl ? (
        <p>
          The $500 start deposit is credited toward the fixed $1,000 sprint.
          Implementation begins only after written scope acceptance and payment
          confirmation.
        </p>
      ) : null}

      <div className="grid">
        <section>
          <h2>Focused MCP surface</h2>
          <p>
            Wrap up to five operations your API already supports. Existing
            behavior and authentication stay authoritative.
          </p>
        </section>
        <section>
          <h2>Canonical discovery</h2>
          <p>
            Add the machine-readable contracts and metadata agents need to
            discover the official interface instead of relying on community
            wrappers.
          </p>
        </section>
        <section>
          <h2>Validation + handoff</h2>
          <p>
            Validate the selected operations, document the integration, and
            hand the implementation back to your team with one revision pass.
          </p>
        </section>
      </div>

      <h2>Commercial terms</h2>
      <pre><code>{commercialTerms}</code></pre>

      <h2>What we need to start</h2>
      <p>
        A written choice of the API operations to expose, the repository or
        deployment target, and whatever test credentials are necessary to
        validate the existing API. Implementation begins after scope acceptance
        and the $500 start payment.
      </p>

      <h2>What this does not include</h2>
      <p>
        This sprint does not invent new product features, redesign your
        authentication model, replace your core API, guarantee directory
        placement, or guarantee agent traffic or revenue. Risky write
        operations are excluded unless they are explicitly scoped with
        appropriate safety controls.
      </p>

      <h2>Why first-party matters</h2>
      <p>
        When third-party wrappers become the easiest way for agents to call an
        API, those wrappers start defining tool names, schemas, safety
        boundaries, and discovery behavior. A first-party MCP surface lets the
        API owner define that contract directly.
      </p>

      <p className="links">
        <a href="mailto:wade@credscore.us?subject=AgentResolver%20MCP%20Sprint">
          wade@credscore.us
        </a>{" "}
        · <a href="/openapi.json">AgentResolver OpenAPI</a> ·{" "}
        <a href="/mcp/server-card">MCP Server Card</a> ·{" "}
        <a href="/legal">Legal & Safety</a>
      </p>
    </main>
  );
}
