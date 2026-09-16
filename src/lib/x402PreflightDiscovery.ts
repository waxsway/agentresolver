export const X402_PREFLIGHT_OUTPUT_SCHEMA = {
  type: "object",
  required: ["url", "status", "ok", "latencyMs", "x402", "trust", "evidenceReceipt"],
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
    },
    evidenceReceipt: {
      type: "object",
      required: [
        "schemaVersion",
        "observedAt",
        "source",
        "endpoint",
        "observedPaymentIdentity",
        "observedPaymentTerms",
        "evidence",
        "limitations"
      ],
      additionalProperties: false,
      properties: {
        schemaVersion: { type: "integer", const: 1 },
        observedAt: { type: "string" },
        source: { type: "string", const: "live_endpoint_observation" },
        endpoint: {
          type: "object",
          required: ["url", "origin", "status", "tlsAuthorized", "tlsProtocol"],
          properties: {
            url: { type: "string" },
            origin: { type: "string" },
            status: { type: "integer" },
            tlsAuthorized: { type: "boolean" },
            tlsProtocol: { anyOf: [{ type: "string" }, { type: "null" }] }
          }
        },
        observedPaymentIdentity: {
          type: "object",
          required: [
            "network",
            "asset",
            "payTo",
            "paymentIdentityFingerprint",
            "endpointPaymentFingerprint",
            "basis",
            "ownershipVerified",
            "providerLegitimacyVerified"
          ],
          properties: {
            network: { anyOf: [{ type: "string" }, { type: "null" }] },
            asset: { anyOf: [{ type: "string" }, { type: "null" }] },
            payTo: { anyOf: [{ type: "string" }, { type: "null" }] },
            paymentIdentityFingerprint: { anyOf: [{ type: "string" }, { type: "null" }] },
            endpointPaymentFingerprint: { anyOf: [{ type: "string" }, { type: "null" }] },
            basis: { type: "string", const: "x402_challenge" },
            ownershipVerified: { type: "boolean", const: false },
            providerLegitimacyVerified: { type: "boolean", const: false }
          }
        },
        observedPaymentTerms: {
          type: "object",
          required: [
            "resource",
            "amountAtomic",
            "amountUsd",
            "scheme",
            "x402Version",
            "paymentTermsFingerprint"
          ],
          properties: {
            resource: { anyOf: [{ type: "string" }, { type: "null" }] },
            amountAtomic: { anyOf: [{ type: "string" }, { type: "null" }] },
            amountUsd: { anyOf: [{ type: "number" }, { type: "null" }] },
            scheme: { anyOf: [{ type: "string" }, { type: "null" }] },
            x402Version: { anyOf: [{ type: "integer" }, { type: "null" }] },
            paymentTermsFingerprint: { anyOf: [{ type: "string" }, { type: "null" }] }
          }
        },
        evidence: {
          type: "object",
          required: ["digestAlgorithm", "digest", "infrastructureScore", "x402Score", "checksObserved"],
          properties: {
            digestAlgorithm: { type: "string", const: "sha256" },
            digest: { type: "string" },
            infrastructureScore: { type: "number" },
            x402Score: { anyOf: [{ type: "number" }, { type: "null" }] },
            checksObserved: { type: "integer", minimum: 0 }
          }
        },
        limitations: { type: "array", items: { type: "string" } }
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
  },
  evidenceReceipt: {
    schemaVersion: 1,
    observedAt: "2026-09-16T18:20:00.000Z",
    source: "live_endpoint_observation",
    endpoint: {
      url: "https://merchant.example/api/paid-resource",
      origin: "https://merchant.example",
      status: 402,
      tlsAuthorized: true,
      tlsProtocol: "TLSv1.3"
    },
    observedPaymentIdentity: {
      network: "eip155:8453",
      asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      payTo: "0x1111111111111111111111111111111111111111",
      paymentIdentityFingerprint: "4a53d5d273a8242d7ae6ea031f8c931a6cc9606578066540806726aa370474de",
      endpointPaymentFingerprint: "a0f453d0ebf0aee5ed27e772682d6bbd6a4d15e846f9476ac8d79249dd5a9970",
      basis: "x402_challenge",
      ownershipVerified: false,
      providerLegitimacyVerified: false
    },
    observedPaymentTerms: {
      resource: "https://merchant.example/api/paid-resource",
      amountAtomic: "5000",
      amountUsd: 0.005,
      scheme: "exact",
      x402Version: 2,
      paymentTermsFingerprint: "c6bcf30b9c0c88ddb660149d84363095a171c243129c5570b1b3e89ef919977d"
    },
    evidence: {
      digestAlgorithm: "sha256",
      digest: "8a2dbaf381ba6fd3ce4b3137cf49b69ee05a597d364d0e969bcf67f0848fdbd9",
      infrastructureScore: 100,
      x402Score: 100,
      checksObserved: 11
    },
    limitations: [
      "This receipt records what AgentResolver observed at one point in time.",
      "It does not establish legal ownership of the payTo wallet.",
      "It does not certify provider legitimacy, future behavior, or fulfillment.",
      "A technically valid payment challenge can still belong to a malicious or misrepresented provider."
    ]
  }
};
