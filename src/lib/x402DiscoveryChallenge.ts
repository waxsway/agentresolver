import { NextResponse } from "next/server";
import { X402_NETWORK, X402_PAY_TO } from "@/lib/x402Config";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const resources = {
  "http-inspect": {
    path: "/api/http-inspect",
    amount: "1000",
    description: "Inspect a public HTTPS resource for current status, latency, response metadata, cache validators and baseline security headers."
  },
  "tool-contract": {
    path: "/api/tool-contract",
    amount: "5000",
    description: "Deterministically check whether one tool's structured output can satisfy another tool's required input contract, with exact incompatibility reasons and safe normalized field mappings."
  },
  "mcp-probe": {
    path: "/api/mcp-probe",
    amount: "1000",
    description: "Verify a public MCP HTTP endpoint is live, compatible, responsive, and inspect its current tool inventory."
  },
  "agent-readiness": {
    path: "/api/agent-readiness",
    amount: "5000",
    description: "Audit a public website for machine-readable agent discovery and integration signals."
  },
  "verified-resolve": {
    path: "/api/verified-resolve",
    amount: "20000",
    description: "Resolve a missing capability and live-check top MCP candidates before choosing."
  },
  "batch-verified-resolve": {
    path: "/api/batch-verified-resolve",
    amount: "50000",
    description: "Resolve and live-check up to four missing capability decisions in one paid batch."
  }
} as const;

export type DiscoveryCapability = keyof typeof resources;

export function x402DiscoveryChallenge(capabilityId: DiscoveryCapability) {
  const config = resources[capabilityId];
  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
  const body = {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: `https://agentresolver.vercel.app${config.path}`,
      description: config.description,
      mimeType: "application/json",
      serviceName: "AgentResolver",
      tags: ["agents", "mcp", "x402"]
    },
    accepts: [
      {
        scheme: "exact",
        network: X402_NETWORK,
        amount: config.amount,
        asset: BASE_USDC,
        payTo,
        maxTimeoutSeconds: 60,
        extra: { name: "USDC", version: "2" }
      }
    ],
    extensions: {}
  };

  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64");
  return NextResponse.json(body, {
    status: 402,
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "payment-required",
      "payment-required": encoded
    }
  });
}
