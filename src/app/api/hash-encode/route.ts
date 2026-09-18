import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { runHashEncode, type HashEncodeOperation } from "@/lib/hashEncode";

export const dynamic = "force-dynamic";

const OPERATIONS = new Set<HashEncodeOperation>([
  "sha256",
  "sha512",
  "hmac-sha256",
  "base64-encode",
  "base64-decode",
  "jwt-decode"
]);

const GET_OPERATIONS = new Set<HashEncodeOperation>([
  "sha256",
  "sha512",
  "base64-encode",
  "base64-decode",
  "jwt-decode"
]);

const route = createDeterministicPaidRoute("hash-encode", async (req) => {
  let operation = "";
  let input: string | null = null;
  let secret: string | undefined;

  if (req.method === "GET") {
    operation = req.nextUrl.searchParams.get("operation") ?? "";
    input = req.nextUrl.searchParams.get("input");
    if (!GET_OPERATIONS.has(operation as HashEncodeOperation)) {
      if (operation === "hmac-sha256") {
        throw new Error("hmac-sha256 requires POST so secrets never appear in URLs.");
      }
      throw new Error("GET supports sha256, sha512, base64-encode, base64-decode, and jwt-decode.");
    }
    if (input !== null && input.length > 4096) {
      throw new Error("GET input exceeds the 4096-character URL-safe limit; use POST for larger inputs.");
    }
  } else {
    const body = (await req.json().catch(() => null)) as {
      operation?: unknown;
      input?: unknown;
      secret?: unknown;
    } | null;
    operation = typeof body?.operation === "string" ? body.operation : "";
    input = typeof body?.input === "string" ? body.input : null;
    secret = typeof body?.secret === "string" ? body.secret : undefined;
  }

  if (!OPERATIONS.has(operation as HashEncodeOperation) || input === null) {
    throw new Error(
      "Provide operation and input. Supported operations: sha256, sha512, hmac-sha256, base64-encode, base64-decode, jwt-decode."
    );
  }

  return runHashEncode({
    operation: operation as HashEncodeOperation,
    input,
    ...(secret !== undefined ? { secret } : {})
  });
}, { paidGet: true });

export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
