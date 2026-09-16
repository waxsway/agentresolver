import { NextRequest, NextResponse } from "next/server";

/**
 * Some MCP discovery clients send the generic HTTP default `Accept: */*`.
 * The streamable-HTTP MCP transport correctly requires JSON and/or SSE and
 * otherwise answers 406, which strands those clients before they can discover
 * or call any paid tools. Normalize only the generic/missing Accept case; keep
 * explicit client preferences untouched.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/mcp" || request.method !== "POST") {
    return NextResponse.next();
  }

  const accept = request.headers.get("accept")?.trim();
  if (accept && accept !== "*/*") {
    return NextResponse.next();
  }

  const headers = new Headers(request.headers);
  headers.set("accept", "application/json, text/event-stream");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/mcp"]
};
