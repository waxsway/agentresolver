import { readFileSync, writeFileSync } from "node:fs";

const ALLOWED_RAILS = new Set([
  "payai",
  "coinbase-cdp",
  "payai+circle-gateway",
  "coinbase-cdp+circle-gateway"
]);

function safeRail(value) {
  return typeof value === "string" && ALLOWED_RAILS.has(value) ? value : null;
}

function eventKey(value) {
  if (!value || typeof value !== "object") return null;
  const network = typeof value.network === "string" ? value.network : null;
  const transactionReference =
    typeof value.transactionReference === "string" ? value.transactionReference : null;
  const capabilityId = typeof value.capabilityId === "string" ? value.capabilityId : null;
  return network && transactionReference && capabilityId
    ? `${network}\n${transactionReference}\n${capabilityId}`
    : null;
}

export function parseRailEvidence(logText) {
  const bySettlement = new Map();
  for (const line of String(logText || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (event?.event !== "paid_capability_settled" || event?.success !== true) continue;
    const key = eventKey(event);
    const rail = safeRail(event.configuredPaymentRail);
    if (key && rail) bySettlement.set(key, rail);
  }
  return bySettlement;
}

export function annotateSettlementHistory(history, logText) {
  const evidence = parseRailEvidence(logText);
  const settlements = Array.isArray(history?.settlements) ? history.settlements : [];
  let railAnnotationAdded = false;

  const annotatedSettlements = settlements.map((settlement) => {
    const key = eventKey(settlement);
    const rail = key ? evidence.get(key) : null;
    if (!rail || settlement.reportedPaymentRail === rail) return settlement;
    railAnnotationAdded = true;
    return {
      ...settlement,
      reportedPaymentRail: rail
    };
  });

  if (!railAnnotationAdded) {
    return { history, changed: false };
  }

  const provenance = {
    field: "reportedPaymentRail",
    source: "AgentResolver runtime configuration telemetry attached to the settled request",
    independentlyVerified: false,
    interpretation:
      "reportedPaymentRail identifies the facilitator configuration AgentResolver reports as active for that request. Public-chain verification independently proves the USDC transfer and delivery evidence, but does not prove facilitator identity."
  };

  return {
    history: {
      ...history,
      settlements: annotatedSettlements,
      paymentRailProvenance: provenance
    },
    changed: true
  };
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function selfTest() {
  const tx = `0x${"ab".repeat(32)}`;
  const base = {
    schemaVersion: 2,
    settlements: [{
      capabilityId: "x402-ping",
      network: "eip155:8453",
      transactionReference: tx,
      onchainVerification: { verified: true }
    }]
  };
  const logs = JSON.stringify({
    event: "paid_capability_settled",
    success: true,
    capabilityId: "x402-ping",
    network: "eip155:8453",
    transactionReference: tx,
    configuredPaymentRail: "coinbase-cdp"
  });
  const first = annotateSettlementHistory(base, logs);
  if (!first.changed || first.history.settlements[0].reportedPaymentRail !== "coinbase-cdp") {
    throw new Error("self-test failed: CDP rail was not preserved");
  }
  if (first.history.paymentRailProvenance.independentlyVerified !== false) {
    throw new Error("self-test failed: facilitator provenance was overstated");
  }
  const second = annotateSettlementHistory(first.history, logs);
  if (second.changed) throw new Error("self-test failed: annotator is not idempotent");
  const invalid = annotateSettlementHistory(base, logs.replace("coinbase-cdp", "invented-rail"));
  if (invalid.changed || invalid.history !== base) {
    throw new Error("self-test failed: unknown rail changed public history");
  }
  const absent = annotateSettlementHistory(base, "");
  if (absent.changed || absent.history !== base) {
    throw new Error("self-test failed: absent rail evidence changed public history");
  }
  process.stdout.write("settlement payment rail annotator self-test PASSED\n");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const historyPath = arg("--history");
  const logsPath = arg("--logs");
  if (!historyPath || !logsPath) {
    throw new Error(
      "Usage: node scripts/annotate-settlement-payment-rail.mjs --history <file> --logs <file>"
    );
  }
  const history = JSON.parse(readFileSync(historyPath, "utf8"));
  const logs = readFileSync(logsPath, "utf8");
  const result = annotateSettlementHistory(history, logs);
  if (result.changed) {
    writeFileSync(historyPath, JSON.stringify(result.history, null, 2) + "\n");
  }
  process.stdout.write(JSON.stringify({ changed: result.changed }) + "\n");
}

if (process.argv[1] && process.argv[1].endsWith("annotate-settlement-payment-rail.mjs")) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
