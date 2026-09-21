import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ORIGIN = "https://agentresolver.vercel.app";
const GUARD_ENDPOINT = ORIGIN + "/api/x402-payment-preflight";
const VERIFIED_RESOLVE_ENDPOINT = ORIGIN + "/api/verified-resolve";
const MCP_ENDPOINT = ORIGIN + "/mcp";
const BUYER_SETUP = ORIGIN + "/api/x402-client-setup";

type JsonRpcId = string | number | null;

function rpcError(id: JsonRpcId, code: number, message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status: code === -32600 || code === -32700 ? 400 : 200 },
  );
}

function textFromMessage(body: any): string {
  const parts = body?.params?.message?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part: any) => part?.kind === "text" && typeof part?.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

function handoffFor(text: string) {
  const lower = text.toLowerCase();
  const wantsProcurement =
    /\b(procure|procurement|find|discover|resolve|capability|service)\b/.test(lower) &&
    !/\b(payment|pay|sign|wallet|preflight|payto)\b/.test(lower);

  if (wantsProcurement) {
    return {
      skill: "procure_verified_capability",
      summary:
        "Use AgentResolver Verified Resolve for paid capability procurement and live verification.",
      paidEndpoint: VERIFIED_RESOLVE_ENDPOINT,
      method: "GET or POST",
      priceUsd: 0.02,
      networks: ["eip155:8453", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
      example:
        VERIFIED_RESOLVE_ENDPOINT +
        "?goal=Find%20and%20verify%20a%20paid%20web%20search%20service&maxPriceUsd=0.05&protocol=x402&requireHttps=true",
      authorizationBoundary:
        "The caller owns its wallet and separately authorizes payment. AgentResolver never receives a private key and never signs the caller's target payment.",
    };
  }

  return {
    skill: "verify_x402_before_paying",
    summary:
      "Use AgentResolver Guard immediately before signing a target x402 payment.",
    paidEndpoint: GUARD_ENDPOINT,
    method: "GET or POST",
    priceUsd: 0.001,
    networks: ["eip155:8453", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
    example:
      GUARD_ENDPOINT +
      "?url=https%3A%2F%2Fexample.com%2Fpaid&method=GET&maxPriceUsd=0.01&expectedNetwork=eip155%3A8453",
    mcp: MCP_ENDPOINT,
    buyerSetup: BUYER_SETUP,
    authorizationBoundary:
      "Guard is a separate paid verification step. The caller retains wallet custody and separately authorizes any target payment after an eligible decision.",
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    protocolVersion: "0.3.0",
    transport: "JSONRPC",
    method: "message/send",
    agentCard: ORIGIN + "/.well-known/agent-card.json",
  });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const id: JsonRpcId =
    typeof body?.id === "string" || typeof body?.id === "number" || body?.id === null
      ? body.id
      : null;

  if (body?.jsonrpc !== "2.0" || !body?.method) {
    return rpcError(id, -32600, "Invalid Request");
  }
  if (body.method !== "message/send") {
    return rpcError(id, -32601, "Method not found");
  }

  const incoming = body?.params?.message;
  if (!incoming || incoming.role !== "user" || !Array.isArray(incoming.parts)) {
    return rpcError(id, -32602, "Invalid params");
  }

  const handoff = handoffFor(textFromMessage(body));
  const contextId =
    typeof incoming.contextId === "string"
      ? incoming.contextId
      : typeof body?.params?.contextId === "string"
        ? body.params.contextId
        : randomUUID();

  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    result: {
      kind: "message",
      role: "agent",
      messageId: randomUUID(),
      contextId,
      parts: [
        {
          kind: "text",
          text: JSON.stringify(handoff),
        },
      ],
      metadata: {
        agent: "AgentResolver",
        nonCustodial: true,
        signsPayments: false,
      },
    },
  });
}
