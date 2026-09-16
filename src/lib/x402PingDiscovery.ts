export const X402_PING_OUTPUT_EXAMPLE = {
  pong: true,
  settledDelivery: true,
  at: "2026-09-16T21:40:00.000Z",
  unixMs: 1789594800000,
  requestId: "00000000-0000-4000-8000-000000000000",
  echo: null
} as const;

export const X402_PING_OUTPUT_SCHEMA = {
  type: "object",
  required: ["pong", "settledDelivery", "at", "unixMs", "requestId", "echo"],
  additionalProperties: false,
  properties: {
    pong: { type: "boolean", const: true },
    settledDelivery: { type: "boolean", const: true },
    at: { type: "string", format: "date-time" },
    unixMs: { type: "integer", minimum: 0 },
    requestId: { type: "string", format: "uuid" },
    echo: {
      anyOf: [
        { type: "string", maxLength: 256 },
        { type: "null" }
      ]
    }
  }
} as const;
