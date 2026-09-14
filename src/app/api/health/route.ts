import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, service: "agentresolver", version: "0.1.0" });
}
