import { callerHash, safeUserAgent } from "@/lib/telemetry";

export function logPaidCapabilityAttempt(req: Request, capabilityId: string) {
  const hasPaymentSignature = Boolean(req.headers.get("payment-signature"));
  console.log(JSON.stringify({
    event: "paid_capability_attempt",
    capabilityId,
    at: new Date().toISOString(),
    callerHash: callerHash(req),
    userAgent: safeUserAgent(req),
    hasPaymentSignature
  }));
}
