import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/trust-surface-audit.yml", "utf8");

test("trust audit supplies valid Guard input before expecting a payment challenge", () => {
  assert.match(
    workflow,
    /api\/x402-payment-preflight\?url=https%3A%2F%2Fagentresolver\.vercel\.app%2Fapi%2Fx402-ping&method=GET&maxPriceUsd=0\.01&expectedNetwork=eip155%3A8453/
  );
  assert.doesNotMatch(
    workflow,
    /"\$BASE_URL\/api\/x402-payment-preflight"\)"/
  );
});

test("trust audit uses protocol-valid PayAI discovery page size", () => {
  assert.match(workflow, /--data-urlencode 'limit=100'/);
  assert.doesNotMatch(workflow, /limit=1000/);
});
