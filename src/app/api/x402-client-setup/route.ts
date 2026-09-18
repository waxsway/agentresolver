import { NextResponse } from "next/server";
import { x402BuyerSetup } from "@/lib/x402BuyerSetup";
import { classifyTraffic, trafficLogFields } from "@/lib/trafficClassification";
import { PAID_CAPABILITIES } from "@/lib/paidCapabilities";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const traffic = classifyTraffic(req, {
    path: "/api/x402-client-setup",
    isDiscovery: true
  });

  const url = new URL(req.url);
  const source = url.searchParams.get("source") === "x402-challenge"
    ? "x402-challenge"
    : null;
  const requestedCapabilityId = url.searchParams.get("capabilityId");
  const capabilityId =
    source === "x402-challenge" &&
    requestedCapabilityId &&
    Object.prototype.hasOwnProperty.call(PAID_CAPABILITIES, requestedCapabilityId)
      ? requestedCapabilityId
      : null;

  console.log(JSON.stringify({
    event: "buyer_setup_viewed",
    at: new Date().toISOString(),
    surface: "http",
    source,
    capabilityId,
    ...trafficLogFields(req, traffic)
  }));

  const capability = capabilityId
    ? PAID_CAPABILITIES[capabilityId as keyof typeof PAID_CAPABILITIES]
    : null;

  return NextResponse.json(
    x402BuyerSetup({
      source,
      capabilityId,
      endpoint: capability?.endpoint ?? null,
      priceUsd: capability?.priceUsd ?? null,
      atomicAmount: capability?.atomicAmount ?? null
    }),
    {
    headers: {
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*"
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS"
    }
  });
}
