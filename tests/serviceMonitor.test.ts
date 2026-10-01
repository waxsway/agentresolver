import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compareMonitorSnapshots,
  fingerprintMonitorSnapshot,
  parseServiceMonitorInput,
  serviceMonitorId,
  type ServiceMonitorSnapshot
} from "../src/lib/serviceMonitor";

const snapshot: ServiceMonitorSnapshot = {
  schemaVersion: 1,
  readiness: {
    score: 90,
    grade: "A",
    checks: [
      { id: "homepage", ok: true, status: 200, note: "Homepage reachable." },
      { id: "openapi", ok: true, status: 200, note: "OpenAPI 3.1.0 found." }
    ]
  },
  mcp: {
    reachable: true,
    compatible: true,
    protocolVersion: "2025-06-18",
    serverName: "Example",
    serverVersion: "1.0.0",
    toolCount: 2,
    toolNames: ["search", "status"],
    toolContractHash: "a".repeat(64)
  },
  x402: {
    status: 402,
    tlsAuthorized: true,
    tlsProtocol: "TLSv1.3",
    detected: true,
    parseable: true,
    version: 2,
    scheme: "exact",
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8",
    resource: "https://api.example.com/paid",
    amountAtomic: "10000",
    amountUsd: 0.01
  }
};

test("service monitor accepts only same-origin public HTTPS surfaces", () => {
  const input = parseServiceMonitorInput({
    label: "Example",
    origin: "https://api.example.com/v1",
    mcpEndpoint: "https://api.example.com/mcp",
    x402Endpoint: "https://api.example.com/paid"
  });

  assert.equal(input.origin, "https://api.example.com/");
  assert.equal(input.mcpEndpoint, "https://api.example.com/mcp");
  assert.equal(input.x402Endpoint, "https://api.example.com/paid");
  assert.match(serviceMonitorId(input), /^mon_[0-9a-f]{20}$/);

  assert.throws(
    () =>
      parseServiceMonitorInput({
        origin: "https://api.example.com",
        mcpEndpoint: "https://evil.example/mcp"
      }),
    /must share the monitored origin/
  );

  assert.throws(
    () => parseServiceMonitorInput({ origin: "http://api.example.com" }),
    /public HTTPS/
  );
});

test("monitor fingerprint is stable and field-level drift is explicit", () => {
  const first = fingerprintMonitorSnapshot(snapshot);
  const second = fingerprintMonitorSnapshot(JSON.parse(JSON.stringify(snapshot)));
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);

  const changed: ServiceMonitorSnapshot = JSON.parse(JSON.stringify(snapshot));
  changed.mcp!.toolCount = 3;
  changed.mcp!.toolNames = ["search", "status", "weather"];
  changed.x402!.payTo = "0x1111111111111111111111111111111111111111";

  const drift = compareMonitorSnapshots(snapshot, changed);
  assert.ok(drift.some((item) => item.path === "mcp.toolCount"));
  assert.ok(drift.some((item) => item.path === "mcp.toolNames"));
  assert.ok(drift.some((item) => item.path === "x402.payTo"));
});

test("managed monitoring stays state-branch based and does not require customer secrets", () => {
  const workflow = readFileSync(".github/workflows/managed-service-monitor.yml", "utf8");
  const runner = readFileSync("scripts/run-managed-monitors.mjs", "utf8");
  const statusRoute = readFileSync("src/app/api/managed-monitor-status/route.ts", "utf8");
  const paidRoute = readFileSync("src/app/api/managed-monitor-30d/route.ts", "utf8");

  assert.match(workflow, /cron: "17 \* \* \* \*"/);
  assert.match(workflow, /ref: monitoring-state/);
  assert.match(workflow, /git push origin HEAD:monitoring-state/);
  assert.match(workflow, /managed_monitor_activation_settled/);
  assert.match(workflow, /VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  assert.doesNotMatch(workflow, /PRIVATE_KEY|SEED_PHRASE|WALLET_PRIVATE_KEY/);

  assert.match(runner, /api\/service-monitor/);
  assert.match(runner, /baselineSnapshot/);
  assert.match(statusRoute, /raw\.githubusercontent\.com\/waxsway\/agentresolver\/monitoring-state/);

  assert.doesNotMatch(paidRoute, /managed_monitor_activation_requested/);
  assert.match(paidRoute, /managed_monitor_activation_settled/);
  assert.match(paidRoute, /onConfirmedSettlement/);
  assert.match(paidRoute, /cadence: "scheduled"/);
  assert.match(paidRoute, /targetIntervalMinutes: 60/);
  assert.match(paidRoute, /scheduleGuaranteed: false/);
  assert.doesNotMatch(paidRoute, /cadence: "hourly"/);
  assert.match(paidRoute, /storesCredentials: false/);
  assert.match(paidRoute, /storesWalletKeys: false/);
  assert.match(paidRoute, /storesCustomerContactInfo: false/);
});

test("monitoring is the primary homepage product while distribution stays available", () => {
  const home = readFileSync("src/app/page.tsx", "utf8");
  assert.match(home, /MANAGED API \+ MCP MONITORING/);
  assert.match(home, /Run a free monitoring snapshot/);
  assert.match(home, /\$19 \/ 30-day managed monitoring/);
  assert.match(home, /Agent Distribution/);
});
