export const X402_PREFLIGHT_OUTPUT_SCHEMA = {
  type: "object",
  required: ["url", "status", "ok", "latencyMs", "x402", "trust"],
  additionalProperties: true,
  properties: {
    url: { type: "string" },
    status: { type: "integer", minimum: 100, maximum: 599 },
    ok: { type: "boolean" },
    latencyMs: { type: "number", minimum: 0 },
    x402: {
      type: "object",
      required: [
        "detected",
        "challengeHeaderPresent",
        "parseable",
        "version",
        "acceptCount",
        "scheme",
        "network",
        "asset",
        "payTo",
        "resource",
        "amountAtomic",
        "amountUsd",
        "score",
        "verdict",
        "checks"
      ],
      additionalProperties: true,
      properties: {
        detected: { type: "boolean" },
        challengeHeaderPresent: { type: "boolean" },
        parseable: { type: "boolean" },
        version: { anyOf: [{ type: "integer" }, { type: "null" }] },
        acceptCount: { type: "integer", minimum: 0 },
        scheme: { anyOf: [{ type: "string" }, { type: "null" }] },
        network: { anyOf: [{ type: "string" }, { type: "null" }] },
        asset: { anyOf: [{ type: "string" }, { type: "null" }] },
        payTo: { anyOf: [{ type: "string" }, { type: "null" }] },
        resource: { anyOf: [{ type: "string" }, { type: "null" }] },
        amountAtomic: { anyOf: [{ type: "string" }, { type: "null" }] },
        amountUsd: { anyOf: [{ type: "number" }, { type: "null" }] },
        score: { anyOf: [{ type: "number" }, { type: "null" }] },
        verdict: { type: "string", enum: ["strong", "mixed", "weak", "not-detected"] },
        checks: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "label", "passed", "weight", "evidence"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              passed: { type: "boolean" },
              weight: { type: "number" },
              evidence: { type: "string" }
            }
          }
        }
      }
    },
    trust: {
      type: "object",
      required: ["score", "infrastructureScore", "x402Score", "grade", "verdict", "checks"],
      additionalProperties: true,
      properties: {
        score: { type: "number" },
        infrastructureScore: { type: "number" },
        x402Score: { anyOf: [{ type: "number" }, { type: "null" }] },
        grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        verdict: { type: "string", enum: ["strong", "mixed", "weak"] },
        checks: { type: "array" }
      }
    }
  }
};

export const X402_PREFLIGHT_OUTPUT_EXAMPLE = {
  url: "https://merchant.example/api/paid-resource",
  status: 402,
  ok: false,
  latencyMs: 118,
  x402: {
    detected: true,
    challengeHeaderPresent: true,
    parseable: true,
    version: 2,
    acceptCount: 2,
    scheme: "exact",
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x1111111111111111111111111111111111111111",
    resource: "https://merchant.example/api/paid-resource",
    amountAtomic: "5000",
    amountUsd: 0.005,
    score: 100,
    verdict: "strong",
    checks: []
  },
  trust: {
    score: 100,
    infrastructureScore: 100,
    x402Score: 100,
    grade: "A",
    verdict: "strong",
    checks: []
  }
};
