export const dynamic = "force-dynamic";

const LISTING_ID = "28e33786-f07";
const NOHUMANS_VERIFY_URL =
  `https://api.nohumans.directory/v1/listings/${LISTING_ID}/verify-now?plan=single`;

const FORWARDED_RESPONSE_HEADERS = [
  "payment-required",
  "payment-response",
  "x-payment-response",
  "content-type",
] as const;

export async function POST(request: Request) {
  const ownerToken = process.env.NOHUMANS_OWNER_TOKEN?.trim();

  if (!ownerToken) {
    return Response.json(
      { error: "nohumans_owner_token_not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const headers = new Headers({
    accept: "application/json",
    "x-claim-token": ownerToken,
  });

  const paymentSignature =
    request.headers.get("payment-signature") ??
    request.headers.get("x-payment");

  if (paymentSignature) {
    headers.set("payment-signature", paymentSignature);
    headers.set("x-payment", paymentSignature);
  }

  const upstream = await fetch(NOHUMANS_VERIFY_URL, {
    method: "POST",
    headers,
    cache: "no-store",
  });

  const responseHeaders = new Headers({
    "cache-control": "no-store",
  });

  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}
