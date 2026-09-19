import {
  createSignedAttributionReceipt,
  verifySignedAttributionReceipt,
  verifySignedAttributionReceiptHistorically,
  type SignedAttributionReceiptPayload
} from "@/lib/attributionReceipt";

export const ATTRIBUTION_RECEIPT_HEADER =
  "x-agentresolver-attribution-receipt" as const;
export const ATTRIBUTION_SIGNING_SECRET_ENV =
  "AGENTRESOLVER_ATTRIBUTION_SIGNING_SECRET" as const;

type Env = Readonly<Record<string, string | undefined>>;

type ReceiptInput = Omit<
  SignedAttributionReceiptPayload,
  "schemaVersion" | "issuedAt" | "expiresAt"
>;

type ReceiptExpectation = Omit<ReceiptInput, "inputFingerprint"> & {
  inputFingerprint?: string | null;
};

function secretFromEnv(env: Env) {
  const value = env[ATTRIBUTION_SIGNING_SECRET_ENV]?.trim();
  return value && Buffer.byteLength(value, "utf8") >= 32 ? value : null;
}

export function attributionSigningConfigured(
  env: Env = process.env
) {
  return Boolean(secretFromEnv(env));
}

export function issueAttributionReceipt(
  input: ReceiptInput,
  env: Env = process.env
) {
  const secret = secretFromEnv(env);
  if (!secret) return null;
  return createSignedAttributionReceipt(input, secret);
}

export function verifyAttributionReceipt(
  receipt: string,
  expected: ReceiptExpectation,
  env: Env = process.env
) {
  const secret = secretFromEnv(env);
  if (!secret) {
    return {
      configured: false,
      valid: false,
      reason: "signing_not_configured",
      payload: null
    } as const;
  }

  const verified = verifySignedAttributionReceipt(receipt, secret);
  if (!verified.valid) {
    return {
      configured: true,
      valid: false,
      reason: verified.reason,
      payload: verified.payload
    } as const;
  }

  const actual = verified.payload;
  const exact =
    actual.attributionId === expected.attributionId &&
    actual.routeId === expected.routeId &&
    actual.providerId === expected.providerId &&
    actual.capabilityId === expected.capabilityId &&
    actual.execute.method === expected.execute.method &&
    actual.execute.url === expected.execute.url &&
    actual.execute.priceUsd === expected.execute.priceUsd &&
    actual.execute.network === expected.execute.network &&
    actual.execute.asset === expected.execute.asset &&
    actual.execute.payTo?.toLowerCase() ===
      expected.execute.payTo?.toLowerCase() &&
    actual.execute.amountAtomic === expected.execute.amountAtomic &&
    (expected.inputFingerprint === undefined ||
      actual.inputFingerprint === expected.inputFingerprint);

  return exact
    ? {
        configured: true,
        valid: true,
        reason: "verified",
        payload: actual
      } as const
    : {
        configured: true,
        valid: false,
        reason: "handoff_mismatch",
        payload: actual
      } as const;
}


export function verifyHistoricalAttributionReceipt(
  receipt: string,
  expected: ReceiptExpectation,
  env: Env = process.env
) {
  const secret = secretFromEnv(env);
  if (!secret) {
    return {
      configured: false,
      valid: false,
      reason: "signing_not_configured",
      payload: null
    } as const;
  }

  const verified = verifySignedAttributionReceiptHistorically(receipt, secret);
  if (!verified.valid) {
    return {
      configured: true,
      valid: false,
      reason: verified.reason,
      payload: verified.payload
    } as const;
  }

  const actual = verified.payload;
  const exact =
    actual.attributionId === expected.attributionId &&
    actual.routeId === expected.routeId &&
    actual.providerId === expected.providerId &&
    actual.capabilityId === expected.capabilityId &&
    actual.execute.method === expected.execute.method &&
    actual.execute.url === expected.execute.url &&
    actual.execute.priceUsd === expected.execute.priceUsd &&
    actual.execute.network === expected.execute.network &&
    actual.execute.asset === expected.execute.asset &&
    actual.execute.payTo?.toLowerCase() ===
      expected.execute.payTo?.toLowerCase() &&
    actual.execute.amountAtomic === expected.execute.amountAtomic &&
    (expected.inputFingerprint === undefined ||
      actual.inputFingerprint === expected.inputFingerprint);

  return exact
    ? {
        configured: true,
        valid: true,
        reason: "verified",
        payload: actual
      } as const
    : {
        configured: true,
        valid: false,
        reason: "handoff_mismatch",
        payload: actual
      } as const;
}
