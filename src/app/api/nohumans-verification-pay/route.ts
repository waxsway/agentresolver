import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  assertNoHumansSingleInvoice,
  NOHUMANS_SINGLE_ENDPOINT,
} from "@/lib/nohumansVerification";

export const dynamic = "force-dynamic";

const FORWARDED_HEADERS = [
  "payment-required",
  "payment-response",
  "x-payment-response",
  "content-type",
] as const;

const NOHUMANS_TIMEOUT_MS = 15_000;

function responseFromUpstream(upstream: Response, body: string, attemptId: string) {
  const headers = new Headers({
    "cache-control": "no-store",
    "x-agentresolver-verification-attempt": attemptId,
  });

  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(body, {
    status: upstream.status,
    headers,
  });
}

function publicOutcome(body: string) {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const keys = [
      "listing_id",
      "status",
      "promise",
      "request_id",
      "fee_tx",
      "record",
      "rule",
      "error",
      "message",
    ] as const;

    return Object.fromEntries(
      keys.filter(key => key in parsed).map(key => [key, parsed[key]]),
    );
  } catch {
    return { bodyKind: body ? "non_json" : "empty" };
  }
}

function logAttempt(
  attemptId: string,
  phase: string,
  details: Record<string, unknown> = {},
) {
  console.log(
    JSON.stringify({
      event: "nohumans_verification_checkout",
      at: new Date().toISOString(),
      attemptId,
      phase,
      ...details,
    }),
  );
}

async function fetchCurrentChallenge() {
  const response = await fetch(NOHUMANS_SINGLE_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(NOHUMANS_TIMEOUT_MS),
  });
  const body = await response.text();

  if (response.status !== 402) {
    throw new Error(`NoHumans invoice endpoint returned HTTP ${response.status}`);
  }

  let invoice: unknown;
  try {
    invoice = JSON.parse(body);
  } catch {
    throw new Error("NoHumans invoice endpoint returned invalid JSON");
  }

  assertNoHumansSingleInvoice(invoice);
  return { response, body };
}

export async function POST(request: Request) {
  const attemptId = randomUUID();
  const paymentSignature =
    request.headers.get("payment-signature") ?? request.headers.get("x-payment");
  const hasPaymentSignature = Boolean(paymentSignature);

  logAttempt(attemptId, "request_received", { hasPaymentSignature });

  let challenge: Awaited<ReturnType<typeof fetchCurrentChallenge>>;
  try {
    challenge = await fetchCurrentChallenge();
  } catch (error) {
    logAttempt(attemptId, "invoice_validation_failed", {
      hasPaymentSignature,
      message: error instanceof Error ? error.message : "Unknown invoice validation error",
    });

    return NextResponse.json(
      {
        error: "nohumans_invoice_validation_failed",
        message: error instanceof Error ? error.message : "Unknown invoice validation error",
        attempt_id: attemptId,
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
          "x-agentresolver-verification-attempt": attemptId,
        },
      },
    );
  }

  if (!paymentSignature) {
    logAttempt(attemptId, "challenge_returned", {
      hasPaymentSignature: false,
      upstreamStatus: challenge.response.status,
    });
    return responseFromUpstream(challenge.response, challenge.body, attemptId);
  }

  const ownerToken = process.env.NOHUMANS_OWNER_TOKEN_CDP_CANARY?.trim();
  if (!ownerToken) {
    logAttempt(attemptId, "owner_token_unavailable", { hasPaymentSignature: true });

    return NextResponse.json(
      {
        error: "nohumans_owner_token_unavailable",
        message: "The private NoHumans owner credential is not configured.",
        attempt_id: attemptId,
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "x-agentresolver-verification-attempt": attemptId,
        },
      },
    );
  }

  let upstream: Response;
  let body: string;
  try {
    upstream = await fetch(NOHUMANS_SINGLE_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(NOHUMANS_TIMEOUT_MS),
      headers: {
        "x-claim-token": ownerToken,
        "payment-signature": paymentSignature,
      },
    });
    body = await upstream.text();
  } catch (error) {
    logAttempt(attemptId, "signed_forward_failed", {
      hasPaymentSignature: true,
      message: error instanceof Error ? error.message : "Unknown upstream error",
    });

    return NextResponse.json(
      {
        error: "nohumans_payment_forward_failed",
        message: error instanceof Error ? error.message : "Unknown upstream error",
        attempt_id: attemptId,
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
          "x-agentresolver-verification-attempt": attemptId,
        },
      },
    );
  }

  logAttempt(attemptId, "signed_forward_completed", {
    hasPaymentSignature: true,
    upstreamStatus: upstream.status,
    outcome: publicOutcome(body),
  });

  return responseFromUpstream(upstream, body, attemptId);
}
