import type { PaidCapabilityId } from "@/lib/paidCapabilities";

/**
 * Runtime payment challenges need enough Bazaar metadata for discovery without
 * turning PAYMENT-REQUIRED into a transport-sized copy of our public catalog.
 * Rich output contracts remain available in OpenAPI and /.well-known/x402.
 */
export function x402RuntimeDiscoveryOutput(capabilityId: PaidCapabilityId) {
  if (capabilityId === "x402-ping") {
    return {
      example: {
        pong: true,
        settledDelivery: true
      },
      schema: {
        type: "object",
        required: ["pong", "settledDelivery"],
        additionalProperties: true,
        properties: {
          pong: { type: "boolean", const: true },
          settledDelivery: { type: "boolean", const: true }
        }
      }
    } as const;
  }

  if (capabilityId === "x402-settlement-verify") {
    return {
      example: {
        settled: true,
        verdict: "verified",
        paymentShape: "eip3009-exact",
        transferCount: 1
      },
      schema: {
        type: "object",
        required: ["settled", "verdict", "paymentShape", "transferCount"],
        additionalProperties: true,
        properties: {
          settled: { type: "boolean" },
          verdict: {
            type: "string",
            enum: ["verified", "reverted", "not_usdc_eip3009", "expectation_mismatch", "not_found"]
          },
          paymentShape: { type: "string", enum: ["eip3009-exact", "other", "unknown"] },
          transferCount: { type: "integer", minimum: 0 }
        }
      }
    } as const;
  }

  if (capabilityId === "x402-payment-preflight") {
    return {
      example: {
        prepaymentDecision: {
          decision: "eligible",
          eligibleForCallerAuthorization: true
        }
      },
      schema: {
        type: "object",
        required: ["prepaymentDecision"],
        additionalProperties: true,
        properties: {
          prepaymentDecision: {
            type: "object",
            required: ["decision", "eligibleForCallerAuthorization"],
            additionalProperties: true,
            properties: {
              decision: { type: "string", enum: ["eligible", "blocked"] },
              eligibleForCallerAuthorization: { type: "boolean" }
            }
          }
        }
      }
    } as const;
  }

  return {
    example: {},
    schema: {
      type: "object",
      additionalProperties: true
    }
  } as const;
}


export function x402RuntimeDiscoveryInput(capabilityId: PaidCapabilityId) {
  if (capabilityId === "x402-ping") {
    return {
      example: { echo: "hello" },
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          echo: {
            type: "string",
            maxLength: 256,
            description: "Optional text echoed by the paid settlement response."
          }
        }
      }
    } as const;
  }

  if (capabilityId === "x402-settlement-verify") {
    return {
      example: {
        txHash: "0x7729766d8615c6bd052340bddc95019be20afd78c2cd39faa4812775e3227b72",
        expectedPayTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8",
        expectedAmountAtomic: "1000"
      },
      schema: {
        type: "object",
        required: ["txHash"],
        additionalProperties: false,
        properties: {
          txHash: {
            type: "string",
            pattern: "^0x[0-9a-fA-F]{64}$",
            description: "Base mainnet transaction hash returned by an x402 settlement."
          },
          expectedPayTo: {
            type: "string",
            pattern: "^0x[0-9a-fA-F]{40}$",
            description: "Optional expected USDC recipient; mismatch fails closed."
          },
          expectedAmountAtomic: {
            type: "string",
            pattern: "^[0-9]{1,78}$",
            description: "Optional expected six-decimal USDC atomic amount; mismatch fails closed."
          }
        }
      }
    } as const;
  }

  if (capabilityId === "verified-resolve") {
    return {
      example: {
        goal: "Find and verify a paid web search service",
        maxPriceUsd: 0.05,
        protocol: "x402",
        requireHttps: true
      },
      schema: {
        type: "object",
        required: ["goal"],
        additionalProperties: false,
        properties: {
          goal: { type: "string", minLength: 1, maxLength: 600, description: "Natural-language capability to procure and live-verify." },
          url: { type: "string", pattern: "^https://", maxLength: 500, description: "Optional known candidate URL to include in verification." },
          maxPriceUsd: { type: "number", minimum: 0, maximum: 1000, description: "Optional maximum candidate price in USD." },
          protocol: { type: "string", enum: ["x402", "l402", "mpp", "mcp", "any"], description: "Optional procurement protocol constraint." },
          preferredNetwork: { type: "string", maxLength: 128, description: "Optional single preferred network for GET compatibility." },
          requireHttps: { type: "boolean", default: true, description: "Require HTTPS candidates; defaults true." },
          sideEffect: { type: "string", enum: ["read-only", "state-changing", "any"] },
          auth: { type: "string", enum: ["none", "wallet", "api-key", "any"] },
          providerOrigin: { type: "string", pattern: "^https://[^/]+/?$", maxLength: 500, description: "Optional known provider origin to seed the same procurement universe." }
        }
      }
    } as const;
  }

  if (capabilityId === "hash-encode") {
    return {
      example: {
        operation: "sha256",
        input: "agentresolver"
      },
      schema: {
        type: "object",
        required: ["operation", "input"],
        additionalProperties: false,
        properties: {
          operation: {
            type: "string",
            enum: ["sha256", "sha512", "base64-encode", "base64-decode", "jwt-decode"],
            description: "GET-safe operation. hmac-sha256 stays POST-only so secrets never appear in URLs."
          },
          input: {
            type: "string",
            maxLength: 4096,
            description: "Bounded query input for the selected deterministic transform."
          }
        }
      }
    } as const;
  }

  if (capabilityId !== "x402-payment-preflight") return null;

  return {
    example: {
      url: "https://example.com/api",
      method: "GET",
      maxPriceUsd: 0.01
    },
    schema: {
      type: "object",
      required: ["url"],
      additionalProperties: false,
      properties: {
        url: {
          type: "string",
          pattern: "^https://",
          maxLength: 500,
          description: "Public HTTPS x402 endpoint to inspect before payment."
        },
        maxPriceUsd: {
          type: "number",
          minimum: 0,
          maximum: 1000,
          description: "Optional caller maximum acceptable target price in USD."
        },
        expectedPayTo: {
          type: "string",
          minLength: 1,
          maxLength: 128,
          description: "Optional expected target payment recipient; mismatch fails closed."
        },
        expectedNetwork: {
          type: "string",
          maxLength: 128,
          description: "Optional expected CAIP-2 target network, for example eip155:8453."
        },
        method: {
          type: "string",
          enum: ["GET", "HEAD", "POST"],
          default: "GET",
          description: "Bounded target probe method."
        },
        allowUnpaidPostProbe: {
          type: "boolean",
          default: false,
          description: "Explicit opt-in for an unpaid POST probe; false by default."
        }
      }
    }
  } as const;
}
