import { NextRequest } from "next/server";
import {
  applyObservedX402PaymentChallenge,
  inspectHttpResource,
  type HttpInspectReport
} from "@/lib/httpInspect";
import { buildX402PaymentGuardResult } from "@/lib/x402PaymentGuard";

type PreflightInput = {
  url?: unknown;
  maxPriceUsd?: unknown;
  expectedPayTo?: unknown;
  expectedNetwork?: unknown;
  method?: unknown;
  body?: unknown;
  allowUnpaidPostProbe?: unknown;
  observedStatus?: unknown;
  observedPaymentRequired?: unknown;
};

function queryInput(req: NextRequest): PreflightInput {
  const params = req.nextUrl.searchParams;
  const maxPriceRaw = params.get("maxPriceUsd");
  return {
    url: params.get("url") || undefined,
    maxPriceUsd: maxPriceRaw !== null && maxPriceRaw.trim() !== ""
      ? Number(maxPriceRaw)
      : undefined,
    expectedPayTo: params.get("expectedPayTo") || undefined,
    expectedNetwork: params.get("expectedNetwork") || undefined,
    method: params.get("method") || undefined,
    allowUnpaidPostProbe: params.get("allowUnpaidPostProbe") === "true"
  };
}

export async function executeX402PaymentPreflight(req: NextRequest) {
  const body = req.method === "GET"
    ? queryInput(req)
    : (await req.json().catch(() => null)) as PreflightInput | null;

  const url = String(body?.url || "").trim();
  if (!url) throw new Error("url is required.");

  const methodRaw = typeof body?.method === "string" ? body.method.toUpperCase() : "GET";
  const method = methodRaw === "GET" || methodRaw === "HEAD" || methodRaw === "POST" ? methodRaw : undefined;
  if (!method) throw new Error("method must be GET, HEAD, or POST.");

  const maxPriceUsd = typeof body?.maxPriceUsd === "number" && Number.isFinite(body.maxPriceUsd)
    ? body.maxPriceUsd
    : undefined;
  const constraints = {
    maxPriceUsd,
    expectedPayTo: typeof body?.expectedPayTo === "string" ? body.expectedPayTo.trim() : undefined,
    expectedNetwork: typeof body?.expectedNetwork === "string" ? body.expectedNetwork.trim() : undefined
  };

  let report: HttpInspectReport;
  let observation: {
    mode: "caller-observed-challenge";
    observedStatus: 402;
    originalMethod: "GET" | "HEAD" | "POST";
    safeProbeMethod: "HEAD";
    safeProbeStatus: number;
    targetRequestReplayed: false;
  } | null = null;

  if (body?.observedPaymentRequired !== undefined) {
    if (body.observedStatus !== undefined && body.observedStatus !== 402) {
      throw new Error("observedStatus must be 402 when observedPaymentRequired is supplied.");
    }

    const serializedObservedChallenge = JSON.stringify(body.observedPaymentRequired);
    if (Buffer.byteLength(serializedObservedChallenge, "utf8") > 32_768) {
      throw new Error("observedPaymentRequired must be 32 KB or smaller.");
    }

    const safeProbe = await inspectHttpResource(url, { method: "HEAD" });
    if (safeProbe.status < 200 || safeProbe.status >= 500) {
      throw new Error(
        `Target is not currently reachable for safe verification (HTTP ${safeProbe.status}).`
      );
    }

    report = applyObservedX402PaymentChallenge(
      safeProbe,
      body.observedPaymentRequired,
      constraints
    );
    observation = {
      mode: "caller-observed-challenge",
      observedStatus: 402,
      originalMethod: method,
      safeProbeMethod: "HEAD",
      safeProbeStatus: safeProbe.status,
      targetRequestReplayed: false
    };
  } else {
    report = await inspectHttpResource(url, {
      ...constraints,
      method,
      body: req.method === "GET" ? undefined : body?.body,
      allowUnpaidPostProbe: body?.allowUnpaidPostProbe === true
    });
  }

  const result = buildX402PaymentGuardResult(report, constraints);

  console.log(JSON.stringify({
    event: "provider_evidence_observed",
    at: result.evidenceReceipt.observedAt,
    capabilityId: "x402-payment-preflight",
    product: "AgentResolver Guard",
    endpointOrigin: result.evidenceReceipt.endpoint.origin,
    paymentIdentityFingerprint: result.evidenceReceipt.observedPaymentIdentity.paymentIdentityFingerprint,
    endpointPaymentFingerprint: result.evidenceReceipt.observedPaymentIdentity.endpointPaymentFingerprint,
    paymentTermsFingerprint: result.evidenceReceipt.observedPaymentTerms.paymentTermsFingerprint,
    evidenceDigest: result.evidenceReceipt.evidence.digest,
    network: result.evidenceReceipt.observedPaymentIdentity.network,
    ownershipVerified: false,
    providerLegitimacyVerified: false,
    prepaymentDecision: result.prepaymentDecision.decision,
    eligibleForCallerAuthorization: result.prepaymentDecision.eligibleForCallerAuthorization,
    prepaymentReasonCodes: result.prepaymentDecision.reasons
  }));

  return observation ? { ...result, observation } : result;
}
