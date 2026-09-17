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

function responseFromUpstream(upstream: Response, body: string) {
  const headers = new Headers({
    "cache-control": "no-store",
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

async function fetchCurrentChallenge() {
  const response = await fetch(NOHUMANS_SINGLE_ENDPOINT, {
    method: "POST",
    cache: "no-store",
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
  let challenge: Awaited<ReturnType<typeof fetchCurrentChallenge>>;
  try {
    challenge = await fetchCurrentChallenge();
  } catch (error) {
    return NextResponse.json(
      {
        error: "nohumans_invoice_validation_failed",
        message: error instanceof Error ? error.message : "Unknown invoice validation error",
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const paymentSignature =
    request.headers.get("payment-signature") ?? request.headers.get("x-payment");

  if (!paymentSignature) {
    return responseFromUpstream(challenge.response, challenge.body);
  }

  const ownerToken = process.env.NOHUMANS_OWNER_TOKEN?.trim();
  if (!ownerToken) {
    return NextResponse.json(
      {
        error: "nohumans_owner_token_unavailable",
        message: "The private NoHumans owner credential is not configured.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const upstream = await fetch(NOHUMANS_SINGLE_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "x-claim-token": ownerToken,
      "payment-signature": paymentSignature,
    },
  });
  const body = await upstream.text();

  return responseFromUpstream(upstream, body);
}
