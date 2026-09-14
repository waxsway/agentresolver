import { NextResponse } from "next/server";
import { CAPABILITIES } from "@/lib/catalog";

export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    service: "AgentResolver",
    version: "0.1.0",
    resolver: {
      method: "POST",
      url: origin + "/api/resolve",
      priceUsd: 0
    },
    capabilities: CAPABILITIES
  });
}
