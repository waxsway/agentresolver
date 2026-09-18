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

  if (capabilityId === "base-usdc-settlement-verify") {
    return {
      example: {
        settlementVerified: true,
        network: "eip155:8453",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        confirmations: 1,
        observedAmountAtomic: "1000"
      },
      schema: {
        type: "object",
        required: ["settlementVerified", "network", "asset", "confirmations", "reasonCodes"],
        additionalProperties: true,
        properties: {
          settlementVerified: { type: "boolean" },
          network: { type: "string", const: "eip155:8453" },
          asset: { type: "string" },
          confirmations: { type: "integer", minimum: 0 },
          observedAmountAtomic: { type: "string" },
          reasonCodes: { type: "array", items: { type: "string" } }
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

  if (capabilityId === "base-usdc-settlement-verify") {
    return {
      example: {
        transactionHash: `0x${"00".repeat(32)}`,
        expectedAmountAtomic: "1000",
        minimumConfirmations: 1
      },
      schema: {
        type: "object",
        required: ["transactionHash"],
        additionalProperties: false,
        properties: {
          transactionHash: {
            type: "string",
            pattern: "^0x[0-9a-fA-F]{64}$",
            description: "Base transaction hash to inspect."
          },
          expectedPayTo: {
            type: "string",
            pattern: "^0x[0-9a-fA-F]{40}$",
            description: "Optional expected USDC recipient; mismatch fails closed."
          },
          expectedAmountAtomic: {
            type: "string",
            pattern: "^[0-9]+$",
            description: "Optional expected USDC amount in 6-decimal atomic units."
          },
          minimumConfirmations: {
            type: "integer",
            minimum: 1,
            maximum: 10000,
            default: 1
          }
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
