import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LISTING_ID = "28e33786-f07";
const NOHUMANS_VERIFY_URL =
  `https://api.nohumans.directory/v1/listings/${LISTING_ID}/verify-now?plan=single`;

export async function POST() {
  const ownerToken = process.env.NOHUMANS_OWNER_TOKEN?.trim();

  if (!ownerToken) {
    return NextResponse.json(
      { ok: false, error: "nohumans_owner_token_not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  const upstream = await fetch(NOHUMANS_VERIFY_URL, {
    method: "POST",
    headers: {
      "x-claim-token": ownerToken,
    },
    cache: "no-store",
  });

  const bodyText = await upstream.text();
  let body: unknown = bodyText;
  try {
    body = JSON.parse(bodyText);
  } catch {
    // Preserve non-JSON upstream responses without exposing local secrets.
  }

  const paymentRequired = upstream.headers.get("payment-required");

  return NextResponse.json(
    {
      ok: upstream.status === 402,
      upstreamStatus: upstream.status,
      paymentRequired,
      body,
    },
    {
      status: upstream.status,
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
