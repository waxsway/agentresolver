import { createHash, createHmac } from "node:crypto";

export type HashEncodeOperation =
  | "sha256"
  | "sha512"
  | "hmac-sha256"
  | "base64-encode"
  | "base64-decode"
  | "jwt-decode";

const MAX_INPUT_BYTES = 128 * 1024;
const MAX_SECRET_BYTES = 4 * 1024;

function assertBounded(value: string, maxBytes: number, label: string) {
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes.`);
  return bytes;
}

function decodeBase64Url(part: string) {
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function runHashEncode(input: {
  operation: HashEncodeOperation;
  input: string;
  secret?: string;
}) {
  const inputBytes = assertBounded(input.input, MAX_INPUT_BYTES, "input");

  switch (input.operation) {
    case "sha256":
      return { operation: input.operation, inputBytes, encoding: "hex", result: createHash("sha256").update(input.input, "utf8").digest("hex") };
    case "sha512":
      return { operation: input.operation, inputBytes, encoding: "hex", result: createHash("sha512").update(input.input, "utf8").digest("hex") };
    case "hmac-sha256": {
      const secret = input.secret ?? "";
      if (!secret) throw new Error("secret is required for hmac-sha256.");
      assertBounded(secret, MAX_SECRET_BYTES, "secret");
      return { operation: input.operation, inputBytes, encoding: "hex", result: createHmac("sha256", secret).update(input.input, "utf8").digest("hex") };
    }
    case "base64-encode":
      return { operation: input.operation, inputBytes, encoding: "base64", result: Buffer.from(input.input, "utf8").toString("base64") };
    case "base64-decode":
      return { operation: input.operation, inputBytes, encoding: "utf8", result: Buffer.from(input.input, "base64").toString("utf8") };
    case "jwt-decode": {
      const parts = input.input.split(".");
      if (parts.length !== 3) throw new Error("JWT must contain header, payload, and signature segments.");
      let header: unknown;
      let payload: unknown;
      try {
        header = JSON.parse(decodeBase64Url(parts[0]));
        payload = JSON.parse(decodeBase64Url(parts[1]));
      } catch {
        throw new Error("JWT header or payload is not valid base64url JSON.");
      }
      return { operation: input.operation, inputBytes, verified: false, note: "Decoded only; signature was not verified.", header, payload, signature: parts[2] };
    }
    default:
      throw new Error("Unsupported operation.");
  }
}
