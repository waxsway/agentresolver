export const CANONICAL_ORIGIN = "https://agentresolver.vercel.app" as const;

export const PAID_CAPABILITIES = {
  "x402-ping": {
    id: "x402-ping", name: "x402 Settlement Ping", operationId: "x402SettlementPing", endpoint: "/api/x402-ping",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Minimal paid canary that returns a timestamped pong after x402 settlement so an agent can verify wallet, facilitator, payment, and delivery end-to-end.",
    useWhen: "An x402 client needs the cheapest possible end-to-end settlement test before trusting a larger paid workflow.",
    costClass: "deterministic",
    tags: ["x402", "ping", "canary", "settlement", "wallet", "facilitator", "payment test", "health"],
    inputSchema: { type: "object", additionalProperties: false, properties: { echo: { type: "string", maxLength: 256 } } },
    example: { echo: "hello" },
    quoteTool: { name: "x402_ping", title: "x402 settlement ping — $0.001", description: "Paid $0.001 USDC/Base settlement canary. Returns a timestamped pong only after successful x402 payment so clients can verify their wallet/facilitator path." }
  },
  "sha256": {
    id: "sha256", name: "SHA-256 Hash", operationId: "sha256Hash", endpoint: "/api/sha256",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Compute a deterministic SHA-256 hex digest for bounded UTF-8 text.",
    useWhen: "An agent needs a SHA-256 digest for integrity, cache keys, signatures, deduplication, or workflow IDs.",
    costClass: "deterministic", tags: ["sha256", "sha-256", "hash", "digest", "integrity", "checksum"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 } } },
    example: { input: "agentresolver" },
    quoteTool: { name: "sha256", title: "SHA-256 hash — $0.001", description: "Paid $0.001 USDC/Base SHA-256 digest of bounded UTF-8 text." }
  },
  "sha512": {
    id: "sha512", name: "SHA-512 Hash", operationId: "sha512Hash", endpoint: "/api/sha512",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Compute a deterministic SHA-512 hex digest for bounded UTF-8 text.",
    useWhen: "An agent needs a SHA-512 digest for integrity, signing workflows, or deterministic identifiers.",
    costClass: "deterministic", tags: ["sha512", "sha-512", "hash", "digest", "integrity", "checksum"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 } } },
    example: { input: "agentresolver" },
    quoteTool: { name: "sha512", title: "SHA-512 hash — $0.001", description: "Paid $0.001 USDC/Base SHA-512 digest of bounded UTF-8 text." }
  },
  "hmac-sha256": {
    id: "hmac-sha256", name: "HMAC SHA-256", operationId: "hmacSha256", endpoint: "/api/hmac-sha256",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Compute a deterministic HMAC-SHA256 hex digest from bounded UTF-8 input and a caller-supplied secret.",
    useWhen: "An agent needs an HMAC-SHA256 signature for webhook verification, API signing, or integrity checks.",
    costClass: "deterministic", tags: ["hmac", "hmac-sha256", "sha256", "signature", "webhook", "integrity"],
    inputSchema: { type: "object", required: ["input", "secret"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 }, secret: { type: "string", minLength: 1, maxLength: 4096 } } },
    example: { input: "payload", secret: "secret" },
    quoteTool: { name: "hmac_sha256", title: "HMAC SHA-256 — $0.001", description: "Paid $0.001 USDC/Base HMAC-SHA256 hex digest." }
  },
  "base64-encode": {
    id: "base64-encode", name: "Base64 Encode", operationId: "base64Encode", endpoint: "/api/base64-encode",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Encode bounded UTF-8 text as Base64.",
    useWhen: "An agent needs text-to-Base64 conversion for payloads, headers, fixtures, or transport.",
    costClass: "deterministic", tags: ["base64", "encode", "encoder", "text", "utf8"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 } } },
    example: { input: "hello" },
    quoteTool: { name: "base64_encode", title: "Base64 encode — $0.001", description: "Paid $0.001 USDC/Base UTF-8 to Base64 encoding." }
  },
  "base64-decode": {
    id: "base64-decode", name: "Base64 Decode", operationId: "base64Decode", endpoint: "/api/base64-decode",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Decode bounded Base64 text to UTF-8.",
    useWhen: "An agent needs Base64-to-text decoding for payloads, tokens, fixtures, or transport.",
    costClass: "deterministic", tags: ["base64", "decode", "decoder", "text", "utf8"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 } } },
    example: { input: "aGVsbG8=" },
    quoteTool: { name: "base64_decode", title: "Base64 decode — $0.001", description: "Paid $0.001 USDC/Base Base64 to UTF-8 decoding." }
  },
  "jwt-decode": {
    id: "jwt-decode", name: "JWT Decode", operationId: "jwtDecode", endpoint: "/api/jwt-decode",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Decode a JWT header and payload without accepting secrets or claiming signature verification.",
    useWhen: "An agent needs to inspect JWT claims and metadata without verifying the token signature.",
    costClass: "deterministic", tags: ["jwt", "json web token", "decode", "claims", "token"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 } } },
    example: { input: "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjMifQ.signature" },
    quoteTool: { name: "jwt_decode", title: "JWT decode — $0.001", description: "Paid $0.001 USDC/Base non-verifying JWT header/payload decode." }
  },
  "json-normalize": {
    id: "json-normalize", name: "JSON Normalize", operationId: "jsonNormalize", endpoint: "/api/json-normalize",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Recursively sort JSON object keys and return canonical compact JSON plus a SHA-256 digest.",
    useWhen: "An agent needs stable JSON for hashing, deduplication, cache keys, signatures, diffs, or deterministic comparisons.",
    costClass: "deterministic", tags: ["json", "normalize", "canonical", "stable", "sort keys", "sha256"],
    inputSchema: { type: "object", required: ["value"], additionalProperties: false, properties: { value: {} } },
    example: { value: { b: 2, a: 1 } },
    quoteTool: { name: "json_normalize", title: "JSON normalize — $0.001", description: "Paid $0.001 USDC/Base canonical JSON normalization plus SHA-256 digest." }
  },
  "json-schema-validate": {
    id: "json-schema-validate", name: "JSON Schema Validate", operationId: "jsonSchemaValidate", endpoint: "/api/json-schema-validate",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Validate JSON data against a practical deterministic JSON Schema subset and return exact path-level errors.",
    useWhen: "An agent needs a cheap validation gate before passing structured data to another tool.",
    costClass: "deterministic", tags: ["json schema", "validate", "validation", "schema", "structured data"],
    inputSchema: { type: "object", required: ["data", "schema"], additionalProperties: false, properties: { data: {}, schema: { type: "object" } } },
    example: { data: { id: "123" }, schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
    quoteTool: { name: "json_schema_validate", title: "JSON Schema validate — $0.001", description: "Paid $0.001 USDC/Base deterministic JSON Schema subset validation." }
  },
  "url-parse": {
    id: "url-parse", name: "URL Parse", operationId: "urlParse", endpoint: "/api/url-parse",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Parse an absolute URL into normalized components and machine-readable query parameters.",
    useWhen: "An agent needs reliable URL components or query parameters without writing parser glue.",
    costClass: "deterministic", tags: ["url", "parse", "query parameters", "hostname", "pathname", "uri"],
    inputSchema: { type: "object", required: ["url"], additionalProperties: false, properties: { url: { type: "string", maxLength: 4096 } } },
    example: { url: "https://example.com/a?x=1&x=2#frag" },
    quoteTool: { name: "url_parse", title: "URL parse — $0.001", description: "Paid $0.001 USDC/Base absolute URL parser." }
  },
  "uuid-v4": {
    id: "uuid-v4", name: "UUID v4", operationId: "uuidV4", endpoint: "/api/uuid-v4",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Generate one or more cryptographically random UUID v4 values for IDs, traces, fixtures, and workflow keys.",
    useWhen: "An agent needs fresh UUID v4 identifiers without maintaining a utility dependency.",
    costClass: "deterministic", tags: ["uuid", "uuid v4", "id", "identifier", "trace id", "random"],
    inputSchema: { type: "object", additionalProperties: false, properties: { count: { type: "integer", minimum: 1, maximum: 20 } } },
    example: { count: 1 },
    quoteTool: { name: "uuid_v4", title: "UUID v4 — $0.001", description: "Paid $0.001 USDC/Base UUID v4 generation, up to 20 IDs." }
  },
  "slugify": {
    id: "slugify", name: "Slugify", operationId: "slugifyText", endpoint: "/api/slugify",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Convert bounded text into a stable lowercase URL slug with deterministic separator handling.",
    useWhen: "An agent needs a safe URL/path slug for titles, labels, routes, or filenames.",
    costClass: "deterministic", tags: ["slugify", "slug", "url slug", "filename", "route"],
    inputSchema: { type: "object", required: ["text"], additionalProperties: false, properties: { text: { type: "string", maxLength: 8192 }, separator: { type: "string", enum: ["-", "_"] } } },
    example: { text: "Hello Agent World", separator: "-" },
    quoteTool: { name: "slugify", title: "Slugify — $0.001", description: "Paid $0.001 USDC/Base deterministic slug generation." }
  },
  "hash-encode": {
    id: "hash-encode",
    name: "Hash & Encode",
    operationId: "hashAndEncode",
    endpoint: "/api/hash-encode",
    price: "$0.001",
    priceUsd: 0.001,
    atomicAmount: "1000",
    description: "Deterministic hashing and encoding primitive for SHA-256, SHA-512, HMAC-SHA256, Base64 encode/decode, and non-verifying JWT decode.",
    useWhen: "An agent needs a cheap deterministic hash, HMAC, Base64 transform, or JWT payload/header decode inside a workflow without creating an account or API key.",
    costClass: "deterministic",
    tags: ["hash", "hashing", "sha256", "sha512", "hmac", "base64", "encode", "decode", "jwt", "token", "deterministic", "x402"],
    inputSchema: {
      type: "object",
      required: ["operation", "input"],
      additionalProperties: false,
      properties: {
        operation: { type: "string", enum: ["sha256", "sha512", "hmac-sha256", "base64-encode", "base64-decode", "jwt-decode"] },
        input: { type: "string", maxLength: 131072 },
        secret: { type: "string", maxLength: 4096 }
      }
    },
    example: { operation: "sha256", input: "agentresolver" },
    quoteTool: {
      name: "hash_encode",
      title: "Hash & encode — $0.001",
      description: "Paid $0.001 USDC/Base deterministic SHA-256, SHA-512, HMAC-SHA256, Base64 encode/decode, or non-verifying JWT decode. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "http-inspect": {
    id: "http-inspect",
    name: "HTTP Inspect",
    operationId: "inspectHttpResource",
    endpoint: "/api/http-inspect",
    price: "$0.001",
    priceUsd: 0.001,
    atomicAmount: "1000",
    description: "Inspect a public HTTPS resource for current status, latency, response metadata, cache validators, TLS/certificate evidence and baseline security headers.",
    useWhen: "Current HTTP reachability, redirect, cache, latency, TLS/certificate or baseline security-header evidence is needed before an agent depends on a public HTTPS resource.",
    costClass: "bounded-network",
    tags: ["http", "https", "status", "latency", "headers", "cache", "tls", "certificate", "security", "x402"],
    inputSchema: { type: "object", required: ["url"], additionalProperties: false, properties: { url: { type: "string", format: "uri", maxLength: 500 } } },
    example: { url: "https://example.com" },
    quoteTool: {
      name: "http_inspect",
      title: "HTTP inspection — $0.001",
      description: "Paid $0.001 USDC/Base inspection of one public HTTPS resource for status, latency, response metadata, cache validators, TLS/certificate evidence and baseline security headers. x402-aware MCP clients can authorize and settle inside this tool call."
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
      title: "Tool contract fit — $0.005",
      description: "Paid $0.005 USDC/Base deterministic JSON-schema compatibility check between one tool output and the next tool input. Returns exact incompatibility reasons and conservative normalized mappings. x402-aware MCP clients can authorize and settle inside this tool call."
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
      title: "MCP live preflight — $0.001",
      description: "Paid $0.001 USDC/Base live MCP endpoint preflight for reachability, compatibility, latency, server metadata and tool inventory. x402-aware MCP clients can authorize and settle inside this tool call."
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
      title: "Agent-readiness audit — $0.005",
      description: "Paid $0.005 USDC/Base audit of a public website for agent discoverability and machine-readable integration signals. x402-aware MCP clients can authorize and settle inside this tool call."
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
    inputSchema: { type: "object", required: ["items"], additionalProperties: false, properties: { items: { type: "array", minItems: 2, maxItems: 4, items: { type: "object", required: ["goal"], additionalProperties: false, properties: { goal: { type: "string", minLength: 1, maxLength: 600 }, url: { type: "string", format: "uri", maxLength: 500 } } } } } },
    example: { items: [{ goal: "Find an MCP server for search" }, { goal: "Find an MCP server for browser automation" }] },
    quoteTool: {
      name: "batch_verified_resolve",
      title: "Batch verified resolve — $0.05",
      description: "Paid $0.05 USDC/Base batch live verification for 2–4 capability decisions using unpaid MCP and x402/HTTP evidence. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  }
} as const;

export type PaidCapabilityId = keyof typeof PAID_CAPABILITIES;
export type PaidCapability = (typeof PAID_CAPABILITIES)[PaidCapabilityId];

export const PAID_CAPABILITY_LIST = Object.values(PAID_CAPABILITIES);

export function getPaidCapability(id: PaidCapabilityId): PaidCapability {
  return PAID_CAPABILITIES[id];
}
