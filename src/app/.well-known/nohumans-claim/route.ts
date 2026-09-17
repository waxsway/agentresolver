export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.NOHUMANS_CLAIM_TOKEN?.trim();

  if (!token) {
    return new Response("Not configured\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(token, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
