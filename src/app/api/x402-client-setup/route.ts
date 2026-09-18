import { NextResponse } from "next/server";
import { x402BuyerSetup } from "@/lib/x402BuyerSetup";
import { classifyTraffic, trafficLogFields } from "@/lib/trafficClassification";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const traffic = classifyTraffic(req, {
    path: "/api/x402-client-setup",
    isDiscovery: true
  });

  console.log(JSON.stringify({
    event: "buyer_setup_viewed",
    at: new Date().toISOString(),
    surface: "http",
    ...trafficLogFields(req, traffic)
  }));

  return NextResponse.json(x402BuyerSetup(), {
    headers: {
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*"
    }
  });
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
