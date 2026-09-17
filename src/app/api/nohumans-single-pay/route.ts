import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VERIFY_URL =
  "https://api.nohumans.directory/v1/listings/28e33786-f07/verify-now?plan=single";
const EXPECTED_NETWORK = "eip155:8453";
const EXPECTED_AMOUNT = "3000000";
const EXPECTED_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const EXPECTED_PAYTO = "0xA733875f2F7E8A2817040B5c60B63Ae07D58a1d6";

function decodePaymentSignature(value: string) {
  const decoded = Buffer.from(value, "base64").toString("utf8");
  return JSON.parse(decoded);
}

export async function POST(request: Request) {
  const ownerToken = process.env.NOHUMANS_OWNER_TOKEN?.trim();
  if (!ownerToken) {
    return NextResponse.json(
      { ok: false, error: "nohumans_owner_token_not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  const paymentSignature = request.headers.get("payment-signature");
  if (!paymentSignature) {
    return NextResponse.json(
      { ok: false, error: "payment_signature_required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  let payload: any;
  try {
    payload = decodePaymentSignature(paymentSignature);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_payment_signature_encoding" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const accepted = payload?.accepted;
  const authorization = payload?.payload?.authorization;

  const termsMatch =
    payload?.x402Version === 2 &&
    accepted?.scheme === "exact" &&
    accepted?.network === EXPECTED_NETWORK &&
    String(accepted?.amount) === EXPECTED_AMOUNT &&
    String(accepted?.asset).toLowerCase() === EXPECTED_ASSET.toLowerCase() &&
    String(accepted?.payTo).toLowerCase() === EXPECTED_PAYTO.toLowerCase() &&
    String(authorization?.to).toLowerCase() === EXPECTED_PAYTO.toLowerCase() &&
    String(authorization?.value) === EXPECTED_AMOUNT;

  if (!termsMatch) {
    return NextResponse.json(
      { ok: false, error: "payment_terms_mismatch" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const upstream = await fetch(VERIFY_URL, {
    method: "POST",
    headers: {
      "x-claim-token": ownerToken,
      "payment-signature": paymentSignature,
    },
    cache: "no-store",
  });

  const upstreamText = await upstream.text();
  let upstreamBody: unknown = upstreamText;
  try {
    upstreamBody = JSON.parse(upstreamText);
  } catch {
    // Preserve non-JSON upstream output without exposing private server state.
  }

  const paymentResponse = upstream.headers.get("payment-response");

  return NextResponse.json(
    {
      ok: upstream.ok,
      upstreamStatus: upstream.status,
      paymentResponse,
      result: upstreamBody,
    },
    {
      status: upstream.status,
      headers: { "cache-control": "no-store" },
    }
  );
}
