import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_SOLANA_NETWORK } from "@/lib/x402Config";
import { shortHash } from "@/lib/telemetry";

type JsonObject = Record<string, unknown>;

const MAX_BODY_BYTES = 96 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;
const ALLOWED_NETWORKS = new Set([
  X402_NETWORK,
  X402_SOLANA_NETWORK,
  "base",
  "solana"
]);

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

export function facilitatorRouterConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const primary = (
    env.AGENTRESOLVER_ROUTER_PRIMARY_URL ||
    env.AGENTRESOLVER_X402_FACILITATOR_URL ||
    X402_FACILITATOR_URL
  ).trim();
  const verifySecondary = (env.AGENTRESOLVER_ROUTER_VERIFY_SECONDARY_URL || "").trim();

  for (const [name, value] of [["primary", primary], ["verify secondary", verifySecondary]] as const) {
    if (!value) continue;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`AgentResolver facilitator router ${name} URL is invalid.`);
    }
    if (url.protocol !== "https:") {
      throw new Error(`AgentResolver facilitator router ${name} URL must use HTTPS.`);
    }
    if (url.hostname === "agentresolver.vercel.app") {
      throw new Error(`AgentResolver facilitator router ${name} URL cannot point back to AgentResolver.`);
    }
  }

  return {
    primary: primary.replace(/\/$/, ""),
    verifySecondary: verifySecondary ? verifySecondary.replace(/\/$/, "") : null
  } as const;
}

export function requestFingerprint(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex").slice(0, 20);
}

function networkFromEnvelope(value: unknown): string | null {
  const envelope = object(value);
  if (!envelope) return null;
  const requirements = object(envelope.paymentRequirements);
  const direct = requirements?.network;
  if (typeof direct === "string") return direct;
  const payload = object(envelope.paymentPayload);
  const accepted = object(payload?.accepted);
  return typeof accepted?.network === "string" ? accepted.network : null;
}

export function validateFacilitatorEnvelope(value: unknown) {
  const envelope = object(value);
  if (!envelope) throw new Error("Request body must be a JSON object.");

  const version = envelope.x402Version;
  if (version !== 1 && version !== 2) {
    throw new Error("x402Version must be 1 or 2.");
  }
  if (!object(envelope.paymentPayload)) {
    throw new Error("paymentPayload is required.");
  }
  if (!object(envelope.paymentRequirements)) {
    throw new Error("paymentRequirements is required.");
  }

  const network = networkFromEnvelope(envelope);
  if (!network || !ALLOWED_NETWORKS.has(network)) {
    throw new Error("AgentResolver router currently supports Base and Solana x402 payments only.");
  }

  return { network, x402Version: version } as const;
}

function proxyHeaders(response: Response, extra: Record<string, string> = {}) {
  const headers = new Headers({
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-expose-headers":
      "extension-responses, x-agentresolver-router, x-agentresolver-upstream, x-agentresolver-request-id, x-agentresolver-settlement-retry-safe",
    "x-agentresolver-router": "x402-reliability-router",
    ...extra
  });
  const contentType = response.headers.get("content-type");
  const extensionResponses = response.headers.get("extension-responses");
  if (contentType) headers.set("content-type", contentType);
  if (extensionResponses) headers.set("extension-responses", extensionResponses);
  return headers;
}

async function readBoundedJson(req: NextRequest) {
  const raw = await req.text();
  if (!raw) throw new Error("Request body is required.");
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new Error("Request body exceeds the 96 KiB router limit.");
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
  const parsed = validateFacilitatorEnvelope(value);
  return { raw, value, ...parsed };
}

async function fetchUpstream(baseUrl: string, path: "/verify" | "/settle", raw: string) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "AgentResolver-Reliability-Router/1.0"
    },
    body: raw,
    redirect: "error",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
  });
}

async function proxyBody(response: Response, requestId: string, upstreamLabel: string, retrySafe: boolean) {
  const body = await response.arrayBuffer();
  return new NextResponse(body, {
    status: response.status,
    statusText: response.statusText,
    headers: proxyHeaders(response, {
      "x-agentresolver-upstream": upstreamLabel,
      "x-agentresolver-request-id": requestId,
      "x-agentresolver-settlement-retry-safe": retrySafe ? "true" : "false"
    })
  });
}

function settlementOutcome(value: unknown) {
  const body = object(value);
  if (!body) return { success: null, transaction: null, payer: null, network: null, reason: null };
  return {
    success: typeof body.success === "boolean" ? body.success : null,
    transaction: typeof body.transaction === "string" && body.transaction ? body.transaction : null,
    payer: typeof body.payer === "string" && body.payer ? body.payer : null,
    network: typeof body.network === "string" ? body.network.slice(0, 80) : null,
    reason: typeof body.errorReason === "string"
      ? body.errorReason.slice(0, 160)
      : typeof body.invalidReason === "string"
        ? body.invalidReason.slice(0, 160)
        : null
  };
}

async function parsedClone(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

export async function routeSupported() {
  const requestId = randomUUID();
  const config = facilitatorRouterConfig();

  try {
    const response = await fetch(`${config.primary}/supported`, {
      method: "GET",
      headers: { "user-agent": "AgentResolver-Reliability-Router/1.0" },
      redirect: "error",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });

    console.log(JSON.stringify({
      event: "facilitator_router_supported",
      at: new Date().toISOString(),
      requestId,
      upstream: "primary",
      responseStatus: response.status
    }));
    return proxyBody(response, requestId, "primary", true);
  } catch (error) {
    console.error(JSON.stringify({
      event: "facilitator_router_supported_failed",
      at: new Date().toISOString(),
      requestId,
      upstream: "primary",
      message: error instanceof Error ? error.message.slice(0, 180) : "unknown"
    }));
    return NextResponse.json({
      error: "UPSTREAM_UNAVAILABLE",
      message: "The configured x402 facilitator did not answer /supported."
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function routeVerify(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const { raw, network, x402Version } = await readBoundedJson(req);
    const fingerprint = requestFingerprint(raw);
    const config = facilitatorRouterConfig();

    let response: Response | null = null;
    let upstream: "primary" | "verify-secondary" = "primary";
    let primaryFailure: string | null = null;

    try {
      response = await fetchUpstream(config.primary, "/verify", raw);
      if (response.status >= 500 && config.verifySecondary) {
        primaryFailure = `http_${response.status}`;
        upstream = "verify-secondary";
        response = await fetchUpstream(config.verifySecondary, "/verify", raw);
      }
    } catch (error) {
      primaryFailure = error instanceof Error ? error.name : "fetch_error";
      if (!config.verifySecondary) throw error;
      upstream = "verify-secondary";
      response = await fetchUpstream(config.verifySecondary, "/verify", raw);
    }

    const parsed = await parsedClone(response);
    const body = object(parsed);
    console.log(JSON.stringify({
      event: upstream === "primary"
        ? "facilitator_router_verify"
        : "facilitator_router_verify_failover",
      at: new Date().toISOString(),
      requestId,
      requestFingerprint: fingerprint,
      x402Version,
      network,
      upstream,
      primaryFailure,
      responseStatus: response.status,
      isValid: typeof body?.isValid === "boolean" ? body.isValid : null
    }));

    return proxyBody(response, requestId, upstream, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid verify request.";
    const status = /required|JSON|x402Version|supports|limit/i.test(message) ? 400 : 502;
    console.error(JSON.stringify({
      event: "facilitator_router_verify_failed",
      at: new Date().toISOString(),
      requestId,
      message: message.slice(0, 180)
    }));
    return NextResponse.json({
      error: status === 400 ? "INVALID_X402_REQUEST" : "VERIFY_UPSTREAM_UNAVAILABLE",
      message
    }, { status, headers: { "cache-control": "no-store" } });
  }
}

export async function routeSettle(req: NextRequest) {
  const requestId = randomUUID();

  try {
    const { raw, network, x402Version } = await readBoundedJson(req);
    const fingerprint = requestFingerprint(raw);
    const config = facilitatorRouterConfig();

    console.log(JSON.stringify({
      event: "facilitator_router_settle_attempt",
      at: new Date().toISOString(),
      requestId,
      requestFingerprint: fingerprint,
      x402Version,
      network,
      upstream: "primary"
    }));

    let response: Response;
    try {
      response = await fetchUpstream(config.primary, "/settle", raw);
    } catch (error) {
      console.error(JSON.stringify({
        event: "facilitator_router_settlement_indeterminate",
        at: new Date().toISOString(),
        requestId,
        requestFingerprint: fingerprint,
        network,
        upstream: "primary",
        retrySafe: false,
        reason: error instanceof Error ? error.name : "fetch_error"
      }));
      return NextResponse.json({
        success: false,
        errorReason: "settlement_state_indeterminate",
        retrySafe: false,
        message:
          "AgentResolver cannot prove whether the upstream facilitator committed this settlement. Do not automatically retry this payment."
      }, {
        status: 502,
        headers: {
          "cache-control": "no-store",
          "x-agentresolver-router": "x402-reliability-router",
          "x-agentresolver-request-id": requestId,
          "x-agentresolver-settlement-retry-safe": "false"
        }
      });
    }

    const parsed = await parsedClone(response);
    const outcome = settlementOutcome(parsed);

    if (response.status >= 500) {
      console.error(JSON.stringify({
        event: "facilitator_router_settlement_indeterminate",
        at: new Date().toISOString(),
        requestId,
        requestFingerprint: fingerprint,
        network,
        upstream: "primary",
        responseStatus: response.status,
        retrySafe: false
      }));
      return NextResponse.json({
        success: false,
        errorReason: "settlement_state_indeterminate",
        retrySafe: false,
        upstreamStatus: response.status,
        message:
          "The upstream facilitator returned a server error after settlement submission. AgentResolver did not fail over because settlement state may be committed."
      }, {
        status: 502,
        headers: {
          "cache-control": "no-store",
          "x-agentresolver-router": "x402-reliability-router",
          "x-agentresolver-request-id": requestId,
          "x-agentresolver-settlement-retry-safe": "false"
        }
      });
    }

    const settled = outcome.success === true && Boolean(outcome.transaction);
    console.log(JSON.stringify({
      event: settled
        ? "facilitator_router_settled"
        : "facilitator_router_settlement_rejected",
      at: new Date().toISOString(),
      requestId,
      requestFingerprint: fingerprint,
      x402Version,
      network: outcome.network || network,
      upstream: "primary",
      responseStatus: response.status,
      success: outcome.success,
      transactionFingerprint: outcome.transaction ? shortHash(outcome.transaction) : null,
      payerHash: outcome.payer ? shortHash(outcome.payer) : null,
      errorReason: outcome.reason,
      businessQualifiedCandidate: settled
    }));

    return proxyBody(response, requestId, "primary", outcome.success === false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid settlement request.";
    console.error(JSON.stringify({
      event: "facilitator_router_settle_rejected_before_upstream",
      at: new Date().toISOString(),
      requestId,
      message: message.slice(0, 180),
      retrySafe: true
    }));
    return NextResponse.json({
      error: "INVALID_X402_REQUEST",
      message,
      retrySafe: true
    }, {
      status: 400,
      headers: {
        "cache-control": "no-store",
        "x-agentresolver-settlement-retry-safe": "true"
      }
    });
  }
}

export function facilitatorCors() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-api-key",
      "access-control-max-age": "86400"
    }
  });
}
