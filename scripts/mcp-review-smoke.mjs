const endpoint = process.argv[2] || "http://127.0.0.1:3001/mcp";

const LEGACY = "2025-06-18";
const MODERN = "2026-07-28";
const CLIENT = { name: "muse-review-smoke", version: "1.0.0" };
const CLIENT_CAPABILITIES = {};

function fail(message, detail) {
  if (detail !== undefined) {
    console.error(message, detail);
  } else {
    console.error(message);
  }
  process.exit(1);
}

function decodeRpc(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {}

  const messages = [];
  for (const line of trimmed.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      messages.push(JSON.parse(data));
    } catch {}
  }
  return messages.at(-1) || null;
}

async function post(body, headers = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const rpc = decodeRpc(text);
  if (!response.ok) {
    fail(`MCP request failed: HTTP ${response.status}`, { body, text: text.slice(0, 2000) });
  }
  if (!rpc) {
    fail("MCP response had no JSON-RPC payload", { body, text: text.slice(0, 2000) });
  }
  if (rpc.error) {
    fail("MCP JSON-RPC error", rpc.error);
  }
  return { response, rpc };
}

function modernMeta() {
  return {
    "io.modelcontextprotocol/protocolVersion": MODERN,
    "io.modelcontextprotocol/clientInfo": CLIENT,
    "io.modelcontextprotocol/clientCapabilities": CLIENT_CAPABILITIES
  };
}

function modernHeaders(method, name) {
  return {
    "mcp-protocol-version": MODERN,
    "mcp-method": method,
    ...(name ? { "mcp-name": name } : {})
  };
}

async function main() {
  // Legacy clients remain supported through the SDK's stateless fallback.
  const legacyInit = await post(
    {
      jsonrpc: "2.0",
      id: "legacy-init",
      method: "initialize",
      params: {
        protocolVersion: LEGACY,
        capabilities: CLIENT_CAPABILITIES,
        clientInfo: CLIENT
      }
    },
    { "mcp-protocol-version": LEGACY }
  );

  if (legacyInit.rpc.result?.serverInfo?.name !== "agentresolver") {
    fail("Legacy initialize returned the wrong server name", legacyInit.rpc);
  }
  if (legacyInit.rpc.result?.serverInfo?.version !== "0.1.4") {
    fail("Legacy initialize returned a stale server version", legacyInit.rpc);
  }

  // The advertised 2026-07-28 transport must work without a legacy initialize.
  const discover = await post(
    {
      jsonrpc: "2.0",
      id: "modern-discover",
      method: "server/discover",
      params: { _meta: modernMeta() }
    },
    modernHeaders("server/discover")
  );

  if (!discover.rpc.result?.supportedVersions?.includes(MODERN)) {
    fail("Modern server/discover does not advertise 2026-07-28", discover.rpc);
  }
  const modernServerInfo =
    discover.rpc.result?._meta?.["io.modelcontextprotocol/serverInfo"];
  if (modernServerInfo?.name !== "agentresolver" || modernServerInfo?.version !== "0.1.4") {
    fail("Modern server/discover returned stale or incorrect server identity", discover.rpc);
  }

  const list = await post(
    {
      jsonrpc: "2.0",
      id: "modern-tools",
      method: "tools/list",
      params: { _meta: modernMeta() }
    },
    modernHeaders("tools/list")
  );
  const tools = list.rpc.result?.tools;
  if (!Array.isArray(tools)) fail("tools/list did not return tools", list.rpc);
  const names = new Set(tools.map(tool => tool?.name));
  for (const required of ["resolve", "payment_guard", "x402_payment_preflight"]) {
    if (!names.has(required)) fail(`Missing required MCP tool: ${required}`, [...names]);
  }

  // Exercise a free tool without credentials or payment.
  const free = await post(
    {
      jsonrpc: "2.0",
      id: "modern-free-call",
      method: "tools/call",
      params: {
        name: "resolve",
        arguments: { goal: "verify an x402 payment before spending", limit: 3 },
        _meta: modernMeta()
      }
    },
    modernHeaders("tools/call", "resolve")
  );
  if (free.rpc.result?.isError === true) {
    fail("Free resolve tool returned an error", free.rpc);
  }

  // Exercise the Guard boundary without paying. This must return a challenge
  // and must not execute the paid inspection or produce a settlement receipt.
  const guard = await post(
    {
      jsonrpc: "2.0",
      id: "modern-guard-challenge",
      method: "tools/call",
      params: {
        name: "payment_guard",
        arguments: { url: "https://example.com" },
        _meta: modernMeta()
      }
    },
    modernHeaders("tools/call", "payment_guard")
  );

  const challenge = guard.rpc.result?.structuredContent;
  if (guard.rpc.result?.isError !== true || challenge?.x402Version !== 2) {
    fail("Unpaid Guard call did not fail closed with an x402 challenge", guard.rpc);
  }
  if (!Array.isArray(challenge?.accepts) || challenge.accepts.length !== 2) {
    fail("Unpaid Guard challenge did not advertise both payment options", guard.rpc);
  }
  const networks = new Set(challenge.accepts.map(item => item?.network));
  if (!networks.has("eip155:8453") || !networks.has("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")) {
    fail("Unpaid Guard challenge is missing Base or Solana", [...networks]);
  }
  if (guard.rpc.result?._meta?.["x402/payment-response"]) {
    fail("Unpaid Guard challenge unexpectedly contained a settlement receipt", guard.rpc);
  }

  console.log(JSON.stringify({
    ok: true,
    endpoint,
    legacyInitialize: true,
    modernDiscover: true,
    toolCount: tools.length,
    freeResolve: true,
    unpaidGuardChallenge: true,
    networks: [...networks]
  }));
}

await main();
