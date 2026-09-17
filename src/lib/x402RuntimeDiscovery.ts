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
