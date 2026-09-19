import {
  createHmac,
  timingSafeEqual
} from "node:crypto";
import { validatePublicHttpsUrl } from "@/lib/publicHttpsJson";
import { isAttributionId } from "@/lib/transactionAttribution";

export const ATTRIBUTION_RECEIPT_VERSION = 1;
export const ATTRIBUTION_RECEIPT_PREFIX = "ar1";
export const DEFAULT_ATTRIBUTION_RECEIPT_TTL_SECONDS = 900;
export const MAX_ATTRIBUTION_RECEIPT_LENGTH = 16_384;
const MAX_TTL_SECONDS = 3600;
const MAX_ENCODED_PAYLOAD_LENGTH = 12_000;
const HMAC_SHA256_BASE64URL_LENGTH = 43;

export type SignedAttributionReceiptPayload = Readonly<{
  schemaVersion: 1;
  attributionId: string;
  routeId: string;
  providerId: string;
  capabilityId: string;
  execute: Readonly<{
    method: "GET" | "POST";
    url: string;
    priceUsd: number;
    network: string | null;
    asset: string | null;
    payTo: string | null;
    amountAtomic: string | null;
  }>;
  inputFingerprint: string | null;
  issuedAt: string;
  expiresAt: string;
}>;

export type AttributionReceiptVerification =
  | {
      valid: true;
      payload: SignedAttributionReceiptPayload;
      reason: "verified";
    }
  | {
      valid: false;
      payload: SignedAttributionReceiptPayload | null;
      reason:
        | "malformed_receipt"
        | "unsupported_version"
        | "invalid_signature"
        | "invalid_payload"
        | "expired_receipt";
    };

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

function validHttps(value: unknown): string | null {
  const text = boundedText(value, 2048);
  if (!text) return null;
  try {
    return validatePublicHttpsUrl(text).toString();
  } catch {
    return null;
  }
}

function parseTimestamp(value: unknown): string | null {
  const text = boundedText(value, 64);
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function parsePayload(value: unknown): SignedAttributionReceiptPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  const execute =
    root.execute && typeof root.execute === "object" && !Array.isArray(root.execute)
      ? (root.execute as Record<string, unknown>)
      : null;

  const attributionId =
    typeof root.attributionId === "string" && isAttributionId(root.attributionId)
      ? root.attributionId
      : null;
  const routeId = boundedText(root.routeId, 100);
  const providerId = boundedText(root.providerId, 80);
  const capabilityId = boundedText(root.capabilityId, 120);
  const method =
    execute?.method === "GET" || execute?.method === "POST"
      ? execute.method
      : null;
  const url = execute ? validHttps(execute.url) : null;
  const priceUsd = Number(execute?.priceUsd);
  const network =
    execute?.network == null ? null : boundedText(execute.network, 120);
  const asset = execute?.asset == null ? null : boundedText(execute.asset, 128);
  const payTo = execute?.payTo == null ? null : boundedText(execute.payTo, 128);
  const amountAtomic =
    execute?.amountAtomic == null ? null : boundedText(execute.amountAtomic, 78);
  const inputFingerprint =
    root.inputFingerprint == null
      ? null
      : boundedText(root.inputFingerprint, 128);
  const issuedAt = parseTimestamp(root.issuedAt);
  const expiresAt = parseTimestamp(root.expiresAt);

  if (
    root.schemaVersion !== ATTRIBUTION_RECEIPT_VERSION ||
    !attributionId ||
    !routeId ||
    !providerId ||
    !capabilityId ||
    !method ||
    !url ||
    !Number.isFinite(priceUsd) ||
    priceUsd < 0 ||
    priceUsd > 1000 ||
    (execute?.network != null && !network) ||
    (execute?.asset != null && !asset) ||
    (execute?.payTo != null && !payTo) ||
    (execute?.amountAtomic != null &&
      (!amountAtomic || !/^[0-9]+$/.test(amountAtomic))) ||
    (root.inputFingerprint != null && !inputFingerprint) ||
    !issuedAt ||
    !expiresAt
  ) {
    return null;
  }

  const issuedMs = Date.parse(issuedAt);
  const expiresMs = Date.parse(expiresAt);
  if (
    expiresMs <= issuedMs ||
    expiresMs - issuedMs > MAX_TTL_SECONDS * 1000
  ) {
    return null;
  }

  return {
    schemaVersion: ATTRIBUTION_RECEIPT_VERSION,
    attributionId,
    routeId,
    providerId,
    capabilityId,
    execute: {
      method,
      url,
      priceUsd,
      network,
      asset,
      payTo,
      amountAtomic
    },
    inputFingerprint,
    issuedAt,
    expiresAt
  };
}

function encodePayload(payload: SignedAttributionReceiptPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signatureFor(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret)
    .update(`${ATTRIBUTION_RECEIPT_PREFIX}.${encodedPayload}`)
    .digest();
}

function safeSecret(secret: string): string {
  const value = secret.trim();
  if (Buffer.byteLength(value, "utf8") < 32) {
    throw new Error(
      "Attribution receipt signing secret must contain at least 32 bytes."
    );
  }
  return value;
}

export function createSignedAttributionReceipt(
  input: Omit<
    SignedAttributionReceiptPayload,
    "schemaVersion" | "issuedAt" | "expiresAt"
  >,
  secret: string,
  options: {
    now?: Date;
    ttlSeconds?: number;
  } = {}
) {
  const now = options.now ?? new Date();
  const ttlSeconds = Math.max(
    60,
    Math.min(
      Math.floor(
        options.ttlSeconds ?? DEFAULT_ATTRIBUTION_RECEIPT_TTL_SECONDS
      ),
      MAX_TTL_SECONDS
    )
  );

  const payload = parsePayload({
    ...input,
    schemaVersion: ATTRIBUTION_RECEIPT_VERSION,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString()
  });

  if (!payload) {
    throw new Error("Attribution receipt payload is invalid.");
  }

  const encodedPayload = encodePayload(payload);
  const signature = signatureFor(encodedPayload, safeSecret(secret));

  return {
    receipt: [
      ATTRIBUTION_RECEIPT_PREFIX,
      encodedPayload,
      signature.toString("base64url")
    ].join("."),
    payload
  } as const;
}

function verifySignedAttributionReceiptInternal(
  receipt: string,
  secret: string,
  options: { now?: Date; allowExpired?: boolean } = {}
): AttributionReceiptVerification {
  if (
    typeof receipt !== "string" ||
    receipt.length === 0 ||
    receipt.length > MAX_ATTRIBUTION_RECEIPT_LENGTH
  ) {
    return { valid: false, payload: null, reason: "malformed_receipt" };
  }

  const parts = receipt.trim().split(".");
  if (parts.length !== 3) {
    return { valid: false, payload: null, reason: "malformed_receipt" };
  }

  const [prefix, encodedPayload, encodedSignature] = parts;
  if (prefix !== ATTRIBUTION_RECEIPT_PREFIX) {
    return { valid: false, payload: null, reason: "unsupported_version" };
  }

  if (
    encodedPayload.length === 0 ||
    encodedPayload.length > MAX_ENCODED_PAYLOAD_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(encodedPayload) ||
    encodedSignature.length !== HMAC_SHA256_BASE64URL_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(encodedSignature)
  ) {
    return { valid: false, payload: null, reason: "malformed_receipt" };
  }

  let providedSignature: Buffer;
  let decoded: unknown;
  try {
    providedSignature = Buffer.from(encodedSignature, "base64url");
    decoded = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );
  } catch {
    return { valid: false, payload: null, reason: "malformed_receipt" };
  }

  if (providedSignature.length !== 32) {
    return { valid: false, payload: null, reason: "malformed_receipt" };
  }

  const expectedSignature = signatureFor(
    encodedPayload,
    safeSecret(secret)
  );

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return { valid: false, payload: null, reason: "invalid_signature" };
  }

  const payload = parsePayload(decoded);
  if (!payload) {
    return { valid: false, payload: null, reason: "invalid_payload" };
  }

  const now = options.now ?? new Date();
  if (!options.allowExpired && Date.parse(payload.expiresAt) <= now.getTime()) {
    return { valid: false, payload, reason: "expired_receipt" };
  }

  return { valid: true, payload, reason: "verified" };
}


export function verifySignedAttributionReceipt(
  receipt: string,
  secret: string,
  options: { now?: Date } = {}
): AttributionReceiptVerification {
  return verifySignedAttributionReceiptInternal(receipt, secret, options);
}

export function verifySignedAttributionReceiptHistorically(
  receipt: string,
  secret: string
): AttributionReceiptVerification {
  return verifySignedAttributionReceiptInternal(receipt, secret, {
    allowExpired: true
  });
}
