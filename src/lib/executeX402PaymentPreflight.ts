import { NextRequest } from "next/server";
import { inspectHttpResource } from "@/lib/httpInspect";
import { buildX402PaymentGuardResult } from "@/lib/x402PaymentGuard";

type PreflightInput = {
  url?: unknown;
  maxPriceUsd?: unknown;
  expectedPayTo?: unknown;
  expectedNetwork?: unknown;
  method?: unknown;
  body?: unknown;
  allowUnpaidPostProbe?: unknown;
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

  const report = await inspectHttpResource(url, {
    ...constraints,
    method,
    body: req.method === "GET" ? undefined : body?.body,
    allowUnpaidPostProbe: body?.allowUnpaidPostProbe === true
  });
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

  return result;
}
