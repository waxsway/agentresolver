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
