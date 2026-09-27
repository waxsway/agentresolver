import type { Metadata } from "next";
import Link from "next/link";
import { parseServiceMonitorInput, runServiceMonitor } from "@/lib/serviceMonitor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agent Commerce Health Result | AgentResolver",
  description:
    "Live AgentResolver compatibility result for a public API, MCP, x402, or agent service.",
  robots: { index: false, follow: false }
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MonitorResultPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  try {
    const input = parseServiceMonitorInput({
      origin: first(params.origin),
      mcpEndpoint: first(params.mcpEndpoint),
      x402Endpoint: first(params.x402Endpoint)
    });
    const report = await runServiceMonitor(input);

    console.log(JSON.stringify({
      event: "self_serve_monitor_report_viewed",
      at: report.checkedAt,
      monitorId: report.monitorId,
      health: report.health.status,
      readinessScore: report.snapshot.readiness.score,
      mcpConfigured: Boolean(report.target.mcpEndpoint),
      x402Configured: Boolean(report.target.x402Endpoint)
    }));

    const missing = report.snapshot.readiness.checks.filter((item) => !item.ok);
    const managedBody = JSON.stringify({
      label: report.target.label || new URL(report.target.origin).hostname,
      origin: report.target.origin,
      ...(report.target.mcpEndpoint ? { mcpEndpoint: report.target.mcpEndpoint } : {}),
      ...(report.target.x402Endpoint ? { x402Endpoint: report.target.x402Endpoint } : {})
    }, null, 2);

    return (
      <main>
        <div className="eyebrow">LIVE AGENT COMMERCE HEALTH RESULT</div>
        <h1>{report.health.status === "healthy" ? "Healthy." : report.health.status === "down" ? "Down." : "Needs work."}</h1>
        <p className="lead">
          <code>{report.target.origin}</code> scored{" "}
          <strong>{report.snapshot.readiness.score}/100</strong> for its current
          machine-readable surface. This result was measured live, not inferred
          from a directory listing.
        </p>

        <div className="score-grid">
          <section>
            <div className="eyebrow">OVERALL</div>
            <h2>{report.health.status.toUpperCase()}</h2>
            <p>{report.health.reasons.length ? report.health.reasons.join(", ") : "No blocking health reason detected."}</p>
          </section>
          <section>
            <div className="eyebrow">DISCOVERY</div>
            <h2>{report.snapshot.readiness.grade} · {report.snapshot.readiness.score}/100</h2>
            <p>{missing.length ? `${missing.length} discovery/readiness gap(s) detected.` : "Current discovery checks passed."}</p>
          </section>
          <section>
            <div className="eyebrow">MCP</div>
            <h2>{report.snapshot.mcp ? (report.snapshot.mcp.compatible ? "COMPATIBLE" : "CHECK FAILED") : "NOT SUPPLIED"}</h2>
            <p>
              {report.snapshot.mcp
                ? `${report.snapshot.mcp.toolCount ?? 0} tool(s) observed.`
                : "Add your MCP endpoint for a real initialize + tools/list check."}
            </p>
          </section>
          <section>
            <div className="eyebrow">X402</div>
            <h2>{report.snapshot.x402 ? (report.snapshot.x402.parseable ? "PAYMENT READY" : "CHECK FAILED") : "NOT SUPPLIED"}</h2>
            <p>
              {report.snapshot.x402
                ? `HTTP ${report.snapshot.x402.status}; ${report.snapshot.x402.network ?? "network unknown"}.`
                : "Add a GET-safe paid endpoint to verify the live payment challenge."}
            </p>
          </section>
        </div>

        {missing.length > 0 ? (
          <section>
            <h2>Highest-priority gaps</h2>
            <ul>
              {missing.slice(0, 5).map((item) => (
                <li key={item.id}><strong>{item.id}</strong>: {item.note}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <div className="eyebrow">KEEP THIS FROM BREAKING</div>
          <h2>Turn this snapshot into hourly monitoring.</h2>
          <p>
            The $19 managed monitor reruns this contract hourly for 30 days,
            records drift, and keeps a durable status record. It stores no
            wallet keys or customer credentials.
          </p>
          <pre><code>{`POST /api/managed-monitor-30d\nContent-Type: application/json\n\n${managedBody}`}</code></pre>
          <p className="actions">
            <a className="button" href="/api/managed-monitor-30d">
              See the $19 x402 quote
            </a>{" "}
            <Link className="button secondary" href="/monitor">
              Check another service
            </Link>
          </p>
          <p className="fine-print">
            Current paid activation is machine-paid through x402. A normal
            card checkout requires merchant onboarding and is not live yet.
          </p>
        </section>

        <section>
          <h2>Share this check</h2>
          <p>
            This page URL contains only the public endpoints you supplied, so
            you can send it to a teammate or keep it with a launch checklist.
            Reopening it reruns the checks against the current service.
          </p>
          <p><code>Monitor ID: {report.monitorId}</code></p>
        </section>
      </main>
    );
  } catch (error) {
    return (
      <main>
        <div className="eyebrow">MONITOR REQUEST COULD NOT RUN</div>
        <h1>That target could not be checked.</h1>
        <p className="lead">
          {error instanceof Error ? error.message : "Invalid monitor request."}
        </p>
        <p className="actions">
          <Link className="button" href="/monitor">Try another public URL</Link>
        </p>
      </main>
    );
  }
}
