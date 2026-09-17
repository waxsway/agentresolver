import { postSettlementCanaryNextActions } from "@/lib/paidRecommendationPolicy";

export const X402_PING_NEXT_ACTIONS = postSettlementCanaryNextActions();

export const X402_PING_OUTPUT_EXAMPLE = {
  pong: true,
  settledDelivery: true,
  at: "2026-09-16T21:40:00.000Z",
  unixMs: 1789594800000,
  requestId: "00000000-0000-4000-8000-000000000000",
  echo: null,
  next: X402_PING_NEXT_ACTIONS
} as const;

function nextActionSchema(action: typeof X402_PING_NEXT_ACTIONS.single | typeof X402_PING_NEXT_ACTIONS.batch) {
  return {
    type: "object",
    required: ["capabilityId", "endpoint", "method", "priceUsd", "useWhen", "inputExample"],
    additionalProperties: false,
    properties: {
      capabilityId: { type: "string", const: action.capabilityId },
      endpoint: { type: "string", const: action.endpoint },
      method: { type: "string", const: action.method },
      priceUsd: { type: "number", const: action.priceUsd },
      useWhen: { type: "string", const: action.useWhen },
      inputExample: { type: "object", const: action.inputExample }
    }
  } as const;
}

export const X402_PING_OUTPUT_SCHEMA = {
  type: "object",
  required: ["pong", "settledDelivery", "at", "unixMs", "requestId", "echo", "next"],
  additionalProperties: false,
  properties: {
    pong: { type: "boolean", const: true },
    settledDelivery: { type: "boolean", const: true },
    at: { type: "string", minLength: 20, maxLength: 35, pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$" },
    unixMs: { type: "integer", minimum: 0 },
    requestId: { type: "string", minLength: 36, maxLength: 36, pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$" },
    echo: {
      anyOf: [
        { type: "string", maxLength: 256 },
        { type: "null" }
      ]
    },
    next: {
      type: "object",
      required: ["catalogUrl", "single", "batch"],
      additionalProperties: false,
      properties: {
        catalogUrl: { type: "string", const: X402_PING_NEXT_ACTIONS.catalogUrl },
        single: nextActionSchema(X402_PING_NEXT_ACTIONS.single),
        batch: nextActionSchema(X402_PING_NEXT_ACTIONS.batch)
      }
    }
  }
} as const;
