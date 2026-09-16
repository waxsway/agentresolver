import { callerHash, safeUserAgent } from "@/lib/telemetry";
import { classifyTraffic } from "@/lib/trafficClassification";

export function logPaidCapabilityAttempt(req: Request, capabilityId: string) {
  const hasPaymentSignature = Boolean(req.headers.get("payment-signature"));
  const traffic = classifyTraffic(req, { hasUserIntent: true, hasPayment: hasPaymentSignature });
  console.log(JSON.stringify({
    event: "paid_capability_attempt",
    capabilityId,
    at: new Date().toISOString(),
    callerHash: callerHash(req),
    userAgent: safeUserAgent(req),
    hasPaymentSignature,
    phase: hasPaymentSignature ? "paid_retry" : "challenge_request",
    trafficClass: traffic.trafficClass,
    external: traffic.external,
    sponsorEligible: traffic.sponsorEligible,
    trafficClassReason: traffic.reason
  }));
}
