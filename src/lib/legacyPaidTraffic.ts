import type { PaidCapabilityId } from "@/lib/paidCapabilities";
import { logPaidCapabilityAttempt } from "@/lib/telemetry";
import {
  classifyTraffic,
  trafficLogFields
} from "@/lib/trafficClassification";

export function logLegacyPaidAttempt(
  req: Request,
  capabilityId: PaidCapabilityId,
  path: string
) {
  const traffic = classifyTraffic(req, { path });
  logPaidCapabilityAttempt(req, capabilityId, traffic);
  return traffic;
}

export function logLegacyPaidDiscovery(
  req: Request,
  capabilityId: PaidCapabilityId,
  path: string
) {
  const traffic = classifyTraffic(req, { path, isDiscovery: true });
  console.log(JSON.stringify({
    event: "paid_capability_discovery",
    at: new Date().toISOString(),
    capabilityId,
    ...trafficLogFields(req, traffic)
  }));
  return traffic;
}
