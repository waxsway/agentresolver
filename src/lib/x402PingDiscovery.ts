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
    at: { type: "string", minLength: 20, maxLength: 35, pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$" },
    unixMs: { type: "integer", minimum: 0 },
    requestId: { type: "string", minLength: 36, maxLength: 36, pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$" },
    echo: {
      anyOf: [
        { type: "string", maxLength: 256 },
        { type: "null" }
      ]
    }
  }
} as const;
