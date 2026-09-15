export const CANONICAL_ORIGIN = "https://agentresolver.vercel.app" as const;

export const PAID_CAPABILITIES = {
  "http-inspect": {
    id: "http-inspect",
    name: "HTTP Inspect",
    operationId: "inspectHttpResource",
    endpoint: "/api/http-inspect",
    price: "$0.001",
    priceUsd: 0.001,
    atomicAmount: "1000",
    description: "Inspect a public HTTPS resource for current status, latency, response metadata, cache validators and baseline security headers.",
    useWhen: "Current HTTP reachability, redirect, cache, latency or baseline security-header evidence is needed before an agent depends on a public HTTPS resource.",
    costClass: "bounded-network",
    tags: ["http", "https", "status", "latency", "headers", "cache", "security", "x402"],
    inputSchema: { type: "object", required: ["url"], additionalProperties: false, properties: { url: { type: "string", format: "uri", maxLength: 500 } } },
    example: { url: "https://example.com" },
    quoteTool: {
      name: "http_inspect",
      title: "HTTP inspection — $0.001",
      description: "Paid $0.001 USDC/Base inspection of one public HTTPS resource for status, latency, response metadata, cache validators and baseline security headers. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "tool-contract": {
    id: "tool-contract",
    name: "Tool Contract Fit",
    operationId: "evaluateToolContract",
    endpoint: "/api/tool-contract",
    price: "$0.005",
    priceUsd: 0.005,
    atomicAmount: "5000",
    description: "Deterministically check whether one tool's structured output can satisfy another tool's required JSON-schema input contract, with exact incompatibility reasons and safe normalized field mappings.",
    useWhen: "An agent is about to connect two structured tools and needs a deterministic compatibility check before attempting the workflow.",
    costClass: "deterministic",
    tags: ["json-schema", "tool-contract", "compatibility", "workflow", "mapping", "x402"],
    inputSchema: { type: "object", required: ["producerOutputSchema", "consumerInputSchema"], additionalProperties: false, properties: { producerOutputSchema: { type: "object" }, consumerInputSchema: { type: "object" } } },
    example: { producerOutputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] }, consumerInputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
    quoteTool: {
      name: "tool_contract",
      title: "Quote tool-contract fit — $0.005",
      description: "Quote a $0.005 USDC/Base deterministic JSON-schema compatibility check between one tool output and the next tool input. Returns exact incompatibility reasons and conservative normalized mappings; never spends."
    }
  },
  "mcp-probe": {
    id: "mcp-probe",
    name: "MCP Live Preflight",
    operationId: "probeMcpEndpoint",
    endpoint: "/api/mcp-probe",
    price: "$0.001",
    priceUsd: 0.001,
    atomicAmount: "1000",
    description: "Live-preflight one public MCP endpoint for reachability, protocol compatibility, latency, server metadata, and tool inventory.",
    useWhen: "A concrete public MCP endpoint is known and current reachability, compatibility, latency or tool inventory matters before depending on it.",
    costClass: "bounded-network",
    tags: ["mcp", "preflight", "tools", "latency", "compatibility", "x402"],
    inputSchema: { type: "object", required: ["endpoint"], additionalProperties: false, properties: { endpoint: { type: "string", format: "uri", maxLength: 500 } } },
    example: { endpoint: "https://example.com/mcp" },
    quoteTool: {
      name: "mcp_preflight",
      title: "Quote MCP live preflight — $0.001",
      description: "Quote a $0.001 USDC/Base live MCP endpoint preflight for reachability, compatibility, latency, server metadata and tool inventory. Returns the exact x402 action; never spends."
    }
  },
  "agent-readiness": {
    id: "agent-readiness",
    name: "Agent Readiness Audit",
    operationId: "auditAgentReadiness",
    endpoint: "/api/agent-readiness",
    price: "$0.005",
    priceUsd: 0.005,
    atomicAmount: "5000",
    description: "Audit a public website for machine-readable agent discoverability and integration signals.",
    useWhen: "An agent or operator needs current evidence that a public site exposes usable agent discovery and integration metadata.",
    costClass: "bounded-network",
    tags: ["agent-readiness", "llms.txt", "openapi", "mcp", "robots", "sitemap", "x402"],
    inputSchema: { type: "object", required: ["url"], additionalProperties: false, properties: { url: { type: "string", format: "uri", maxLength: 500 } } },
    example: { url: "https://example.com" },
    quoteTool: {
      name: "agent_readiness",
      title: "Quote agent-readiness audit — $0.005",
      description: "Quote a $0.005 USDC/Base audit of a public website for agent discoverability and machine-readable integration signals. Returns the exact x402 action; never spends."
    }
  },
  "openapi-select": {
    id: "openapi-select",
    name: "OpenAPI Operation Select",
    operationId: "selectOpenApiOperation",
    endpoint: "/api/openapi-select",
    price: "$0.005",
    priceUsd: 0.005,
    atomicAmount: "5000",
    description: "Fetch a public JSON OpenAPI spec, rank its operations against a natural-language goal, and return one compact execution-ready operation contract with request parameters, body schema, auth requirements, alternatives, and confidence.",
    useWhen: "An agent has a public OpenAPI spec but needs to choose the right operation without loading the entire API surface into model context.",
    costClass: "bounded-network",
    tags: ["openapi", "api operation", "operation selection", "operationid", "endpoint selection", "request schema", "agent tool", "x402"],
    inputSchema: { type: "object", required: ["specUrl", "goal"], additionalProperties: false, properties: { specUrl: { type: "string", format: "uri", maxLength: 500 }, goal: { type: "string", minLength: 1, maxLength: 600 } } },
    example: { specUrl: "https://example.com/openapi.json", goal: "find a customer order by id" },
    quoteTool: {
      name: "openapi_select",
      title: "OpenAPI operation selection — $0.005",
      description: "Paid $0.005 USDC/Base selection of the best operation from one public JSON OpenAPI spec for a stated goal. Returns a compact execution-ready contract. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "verified-resolve": {
    id: "verified-resolve",
    name: "Verified Resolve",
    operationId: "verifiedResolve",
    endpoint: "/api/verified-resolve",
    price: "$0.02",
    priceUsd: 0.02,
    atomicAmount: "20000",
    description: "Resolve one missing capability and perform up to two unpaid live verification probes across top MCP and x402/HTTP marketplace candidates before returning evidence-backed selection data.",
    useWhen: "Discovery returns external candidates but stale, dead, MCP-incompatible, or non-payment-ready endpoints would make a blind selection costly.",
    costClass: "bounded-network",
    tags: ["capability", "discovery", "mcp", "http", "x402", "verification", "selection"],
    inputSchema: { type: "object", required: ["goal"], additionalProperties: false, properties: { goal: { type: "string", minLength: 1, maxLength: 600 }, url: { type: "string", format: "uri", maxLength: 500 } } },
    example: { goal: "Find and verify an MCP server for web search" },
    quoteTool: {
      name: "verified_resolve",
      title: "Live verified resolve — $0.02",
      description: "Paid $0.02 USDC/Base capability resolution plus up to two unpaid live verification probes across top MCP and x402/HTTP marketplace candidates. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "batch-verified-resolve": {
    id: "batch-verified-resolve",
    name: "Batch Verified Resolve",
    operationId: "batchVerifiedResolve",
    endpoint: "/api/batch-verified-resolve",
    price: "$0.05",
    priceUsd: 0.05,
    atomicAmount: "50000",
    description: "Resolve and live-verify up to four missing capability decisions in one bounded call, using unpaid MCP and x402/HTTP evidence.",
    useWhen: "An agent has multiple missing capability decisions and wants one bounded purchase with live external-candidate evidence.",
    costClass: "bounded-network",
    tags: ["batch", "capability", "discovery", "mcp", "verification", "x402"],
    inputSchema: { type: "object", required: ["items"], additionalProperties: false, properties: { items: { type: "array", minItems: 1, maxItems: 4, items: { type: "object", required: ["goal"], additionalProperties: false, properties: { goal: { type: "string", minLength: 1, maxLength: 600 }, url: { type: "string", format: "uri", maxLength: 500 } } } } } },
    example: { items: [{ goal: "Find an MCP server for search" }, { goal: "Find an MCP server for browser automation" }] },
    quoteTool: {
      name: "batch_verified_resolve",
      title: "Quote batch verified resolve — $0.05",
      description: "Quote a $0.05 USDC/Base batch live verification for up to four capability decisions using unpaid MCP and x402/HTTP evidence. Returns the exact x402 action; never spends."
    }
  }
} as const;

export type PaidCapabilityId = keyof typeof PAID_CAPABILITIES;
export type PaidCapability = (typeof PAID_CAPABILITIES)[PaidCapabilityId];

export const PAID_CAPABILITY_LIST = Object.values(PAID_CAPABILITIES);

export function getPaidCapability(id: PaidCapabilityId): PaidCapability {
  return PAID_CAPABILITIES[id];
}
