import { readFileSync } from "node:fs";

const REGISTRY = process.argv[2] || "config/provider-partners.json";
const RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const PAY_TO = "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8".toLowerCase();
const AMOUNT = 50000n;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function fail(message) { throw new Error(message); }
function topicAddress(value) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)
    ? "0x" + value.slice(-40).toLowerCase()
    : null;
}
async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) fail(`Base RPC ${method} returned HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) fail(`Base RPC ${method} returned an error`);
  return body.result;
}

const entries = JSON.parse(readFileSync(REGISTRY, "utf8"));
if (!Array.isArray(entries)) fail("provider-partners registry must be a JSON array");

const routeIds = new Set();
const paymentTxs = new Set();

for (const [index, entry] of entries.entries()) {
  const at = `provider-partners[${index}]`;
  for (const field of ["routeId","providerId","providerName","capabilityId","name","description","endpoint","method"]) {
    if (typeof entry?.[field] !== "string" || !entry[field].trim()) fail(`${at} missing ${field}`);
  }
  if (entry.routeId.startsWith("agentresolver:") || entry.providerId === "agentresolver") {
    fail(`${at} cannot impersonate an AgentResolver first-party route`);
  }
  if (routeIds.has(entry.routeId)) fail(`${at} duplicates routeId ${entry.routeId}`);
  routeIds.add(entry.routeId);

  const endpoint = new URL(entry.endpoint);
  if (endpoint.protocol !== "https:") fail(`${at} endpoint must use HTTPS`);
  if (!["GET","POST"].includes(entry.method)) fail(`${at} method must be GET or POST`);
  if (!Number.isFinite(Number(entry.priceUsd)) || Number(entry.priceUsd) < 0 || Number(entry.priceUsd) > 1000) {
    fail(`${at} has invalid priceUsd`);
  }
  if (Number(entry.commissionUsd) !== 0.001) fail(`${at} commissionUsd must be 0.001`);

  const proof = entry.launchProof;
  if (
    proof?.network !== "eip155:8453" ||
    proof?.amountAtomic !== "50000" ||
    String(proof?.payTo || "").toLowerCase() !== PAY_TO ||
    typeof proof?.txHash !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(proof.txHash)
  ) {
    fail(`${at} must include the Base $0.05 Provider Launch Check payment proof`);
  }

  const txHash = proof.txHash.toLowerCase();
  if (paymentTxs.has(txHash)) fail(`${at} reuses a launch-payment transaction`);
  paymentTxs.add(txHash);

  const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
  if (!receipt || receipt.status !== "0x1") fail(`${at} launch-payment transaction is not successful`);

  const exactTransfer = (receipt.logs || []).some((log) => {
    if (String(log.address || "").toLowerCase() !== BASE_USDC) return false;
    if (String(log.topics?.[0] || "").toLowerCase() !== TRANSFER_TOPIC) return false;
    if (topicAddress(log.topics?.[2]) !== PAY_TO) return false;
    try { return BigInt(log.data) === AMOUNT; } catch { return false; }
  });
  if (!exactTransfer) fail(`${at} launch proof does not show exactly 50000 atomic USDC paid to AgentResolver`);
}

process.stdout.write(JSON.stringify({
  ok: true,
  providerPartnerCount: entries.length,
  independentlyVerifiedLaunchPayments: entries.length
}) + "\n");
