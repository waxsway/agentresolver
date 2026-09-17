import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VERIFY_URL =
  "https://api.nohumans.directory/v1/listings/28e33786-f07/verify-now?plan=single";
const EXPECTED_NETWORK = "eip155:8453";
const EXPECTED_AMOUNT = "3000000";
const EXPECTED_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const EXPECTED_PAYTO = "0xA733875f2F7E8A2817040B5c60B63Ae07D58a1d6";

export async function POST() {
  const upstream = await fetch(VERIFY_URL, {
    method: "POST",
    cache: "no-store",
  });

  const text = await upstream.text();

  if (upstream.status !== 402) {
    return NextResponse.json(
      {
        ok: false,
        error: "unexpected_nohumans_quote_status",
        upstreamStatus: upstream.status,
        upstreamBody: text.slice(0, 2000),
      },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }

  let paymentRequired: any;
  try {
    paymentRequired = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_nohumans_quote_json" },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }

  const accepted = Array.isArray(paymentRequired?.accepts)
    ? paymentRequired.accepts.find(
        (item: any) =>
          item?.scheme === "exact" &&
          item?.network === EXPECTED_NETWORK &&
          String(item?.amount) === EXPECTED_AMOUNT &&
          String(item?.asset).toLowerCase() === EXPECTED_ASSET.toLowerCase() &&
          String(item?.payTo).toLowerCase() === EXPECTED_PAYTO.toLowerCase()
      )
    : undefined;

  if (!accepted || paymentRequired?.x402Version !== 2) {
    return NextResponse.json(
      {
        ok: false,
        error: "nohumans_quote_terms_changed",
        observed: {
          x402Version: paymentRequired?.x402Version ?? null,
          accepts: paymentRequired?.accepts ?? null,
        },
      },
      { status: 409, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      paymentRequired,
      selected: accepted,
      authorizedSpendUsd: 3,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
