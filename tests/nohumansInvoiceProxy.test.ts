import assert from "node:assert/strict";
import test from "node:test";

test("NoHumans invoice proxy source never exposes the owner token", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile("src/app/api/nohumans-single-invoice/route.ts", "utf8")
  );
  assert.match(source, /NOHUMANS_OWNER_TOKEN/);
  assert.doesNotMatch(source, /ownerToken\s*[,}]/);
  assert.doesNotMatch(source, /x-claim-token["']?\s*:\s*["']?[A-Za-z0-9_-]{20,}/);
  assert.match(source, /cache:\s*"no-store"/);
  assert.match(source, /upstreamStatus/);
  assert.match(source, /paymentRequired/);
});
