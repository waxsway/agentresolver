import { NextResponse } from "next/server";
import { x402BuyerSetup } from "@/lib/x402BuyerSetup";

export const dynamic = "force-dynamic";

export async function GET() {
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
