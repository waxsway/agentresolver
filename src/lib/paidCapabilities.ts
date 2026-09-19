export const CANONICAL_ORIGIN = "https://agentresolver.vercel.app" as const;

export const PAID_CAPABILITIES = {
  "abi-encode": {
    id: "abi-encode",
    name: "Ethereum ABI Encode",
    operationId: "ethereumAbiEncode",
    endpoint: "/api/abi-encode",
    price: "$0.005",
    priceUsd: 0.005,
    atomicAmount: "5000",
    description: "ABI-encode Solidity typed values and function arguments into exact EVM calldata-ready hex for smart-contract calls, hashing, fixtures, and signing workflows.",
    useWhen: "An agent needs exact ABI bytes for contract calls, hashing, fixtures, or signing and cannot safely approximate binary encoding.",
    costClass: "deterministic",
    tags: ["ethereum", "evm", "abi", "encode", "calldata", "solidity", "contract"],
    inputSchema: { type: "object", required: ["types", "values"], additionalProperties: false, properties: { types: { type: "array", minItems: 1, maxItems: 32, items: { type: "string", minLength: 1, maxLength: 512 } }, values: { type: "array", maxItems: 32 } } },
    example: { types: ["address", "uint256"], values: ["0x000000000000000000000000000000000000dEaD", "42"] },
    quoteTool: { name: "abi_encode", title: "Ethereum ABI encode — $0.005", description: "Paid $0.005 USDC on Base or Solana exact Ethereum ABI encoding from Solidity typed JSON values to calldata-ready hex." }
  },
  "abi-decode": {
    id: "abi-decode",
    name: "Ethereum ABI Decode",
    operationId: "ethereumAbiDecode",
    endpoint: "/api/abi-decode",
    price: "$0.005",
    priceUsd: 0.005,
    atomicAmount: "5000",
    description: "ABI-decode EVM calldata or return-data hex against Solidity parameter types into exact JSON-safe typed values for smart-contract workflows.",
    useWhen: "An agent has ABI-encoded return data or parameters and needs exact typed values without hand-decoding 32-byte words.",
    costClass: "deterministic",
    tags: ["ethereum", "evm", "abi", "decode", "calldata", "solidity", "contract"],
    inputSchema: { type: "object", required: ["types", "data"], additionalProperties: false, properties: { types: { type: "array", minItems: 1, maxItems: 32, items: { type: "string", minLength: 1, maxLength: 512 } }, data: { type: "string", pattern: "^0x(?:[0-9a-fA-F]{2})*$", maxLength: 262146 } } },
    example: { types: ["uint256", "bool"], data: "0x000000000000000000000000000000000000000000000000000000000000002a0000000000000000000000000000000000000000000000000000000000000001" },
    quoteTool: { name: "abi_decode", title: "Ethereum ABI decode — $0.005", description: "Paid $0.005 USDC on Base or Solana exact Ethereum ABI decoding into JSON-safe typed values." }
  },
  "eip712-hash": {
    id: "eip712-hash",
    name: "EIP-712 Typed Data Hash",
    operationId: "eip712TypedDataHash",
    endpoint: "/api/eip712-hash",
    price: "$0.005",
    priceUsd: 0.005,
    atomicAmount: "5000",
    description: "Compute the exact EIP-712 typed-structured-data digest used for Ethereum signing and signature recovery.",
    useWhen: "An agent needs the exact EIP-712 digest for typed signing, verification, permits, orders, or wallet workflows.",
    costClass: "deterministic",
    tags: ["ethereum", "evm", "eip-712", "typed data", "hash", "signing", "signature"],
    inputSchema: { type: "object", required: ["domain", "types", "primaryType", "message"], additionalProperties: false, properties: { domain: { type: "object" }, types: { type: "object" }, primaryType: { type: "string", minLength: 1, maxLength: 128 }, message: { type: "object" } } },
    example: { domain: { name: "Ether Mail", version: "1", chainId: 1, verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC" }, types: { Person: [{ name: "name", type: "string" }, { name: "wallet", type: "address" }], Mail: [{ name: "from", type: "Person" }, { name: "to", type: "Person" }, { name: "contents", type: "string" }] }, primaryType: "Mail", message: { from: { name: "Cow", wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826" }, to: { name: "Bob", wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB" }, contents: "Hello, Bob!" } },
    quoteTool: { name: "eip712_hash", title: "EIP-712 typed-data hash — $0.005", description: "Paid $0.005 USDC on Base or Solana exact EIP-712 typed-data digest for signing and verification workflows." }
  },
  "ens-namehash": {
    id: "ens-namehash",
    name: "ENS Namehash",
    operationId: "ensNamehash",
    endpoint: "/api/ens-namehash",
    price: "$0.01",
    priceUsd: 0.01,
    atomicAmount: "10000",
    description: "ENSIP-15 normalize an ENS name, compute its exact ENS namehash, and return each normalized label hash.",
    useWhen: "An agent needs an exact ENS node or label hash for registry/resolver calls, token IDs, or contract interactions.",
    costClass: "deterministic",
    tags: ["ens", "ethereum", "namehash", "labelhash", "ensip-15", "evm", "name"],
    inputSchema: { type: "object", required: ["name"], additionalProperties: false, properties: { name: { type: "string", minLength: 1, maxLength: 255 } } },
    example: { name: "wevm.eth" },
    quoteTool: { name: "ens_namehash", title: "ENS namehash — $0.01", description: "Paid $0.01 USDC on Base or Solana ENSIP-15 normalization, exact ENS namehash and label hashes." }
  },
  "evm-address-checksum": {
    id: "evm-address-checksum",
    name: "EVM Address Checksum",
    operationId: "evmAddressChecksum",
    endpoint: "/api/evm-address-checksum",
    price: "$0.003",
    priceUsd: 0.003,
    atomicAmount: "3000",
    description: "Validate and normalize one EVM address to the exact EIP-55 mixed-case checksum form.",
    useWhen: "An agent must safely normalize or validate an Ethereum/EVM address before signing, storing, displaying, or sending funds.",
    costClass: "deterministic",
    tags: ["evm", "ethereum", "address", "checksum", "eip-55", "wallet", "validation"],
    inputSchema: { type: "object", required: ["address"], additionalProperties: false, properties: { address: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" } } },
    example: { address: "0x52908400098527886e0f7030069857d2e4169ee7" },
    quoteTool: { name: "evm_address_checksum", title: "EVM address checksum — $0.003", description: "Paid $0.003 USDC on Base or Solana exact EIP-55 address validation and checksum normalization." }
  },
  "keccak256": {
    id: "keccak256",
    name: "Keccak-256",
    operationId: "keccak256Digest",
    endpoint: "/api/keccak256",
    price: "$0.004",
    priceUsd: 0.004,
    atomicAmount: "4000",
    description: "Compute the exact Ethereum keccak256 digest of bounded UTF-8 text or hex bytes.",
    useWhen: "An agent needs Ethereum-compatible keccak256 for selectors, topics, commitments, IDs, or signature workflows.",
    costClass: "deterministic",
    tags: ["keccak", "keccak256", "ethereum", "evm", "hash", "digest", "crypto"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 }, encoding: { type: "string", enum: ["utf8", "hex"] } } },
    example: { input: "transfer(address,uint256)", encoding: "utf8" },
    quoteTool: { name: "keccak256", title: "Keccak-256 — $0.004", description: "Paid $0.004 USDC on Base or Solana exact Ethereum keccak256 digest for UTF-8 text or hex bytes." }
  },
  "solidity-selector": {
    id: "solidity-selector",
    name: "Solidity Function Selector",
    operationId: "solidityFunctionSelector",
    endpoint: "/api/solidity-selector",
    price: "$0.01",
    priceUsd: 0.01,
    atomicAmount: "10000",
    description: "Compute the exact 4-byte Solidity function/error selector and full keccak256 hash from a canonical signature.",
    useWhen: "An agent needs calldata selectors or exact ABI signature hashes and cannot safely approximate cryptographic output.",
    costClass: "deterministic",
    tags: ["solidity", "selector", "abi", "calldata", "keccak", "ethereum", "evm"],
    inputSchema: { type: "object", required: ["signature"], additionalProperties: false, properties: { signature: { type: "string", minLength: 3, maxLength: 1024 } } },
    example: { signature: "transfer(address,uint256)" },
    quoteTool: { name: "solidity_selector", title: "Solidity selector — $0.01", description: "Paid $0.01 USDC on Base or Solana exact 4-byte Solidity selector and full keccak256 signature hash." }
  },
  "evm-units": {
    id: "evm-units",
    name: "EVM Units Convert",
    operationId: "convertEvmUnits",
    endpoint: "/api/evm-units",
    price: "$0.005",
    priceUsd: 0.005,
    atomicAmount: "5000",
    description: "Precisely parse decimal token amounts into integer base units or format integer base units using arbitrary token decimals.",
    useWhen: "An agent must convert wei/gwei/ether or arbitrary ERC-20 decimal units without floating-point rounding errors.",
    costClass: "deterministic",
    tags: ["evm", "wei", "ether", "units", "decimals", "erc20", "token", "conversion"],
    inputSchema: { type: "object", required: ["mode", "value", "decimals"], additionalProperties: false, properties: { mode: { type: "string", enum: ["parse", "format"] }, value: { type: "string", maxLength: 256 }, decimals: { type: "integer", minimum: 0, maximum: 255 } } },
    example: { mode: "parse", value: "1.5", decimals: 18 },
    quoteTool: { name: "evm_units", title: "EVM units convert — $0.005", description: "Paid $0.005 USDC on Base or Solana exact decimal/base-unit conversion with arbitrary token decimals." }
  },
  "x402-ping": {
    id: "x402-ping", name: "x402 Settlement Test — Wallet Facilitator Payment Test Canary", operationId: "x402SettlementPing", endpoint: "/api/x402-ping",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "No-body $0.001 x402 settlement test for funded agents. Verifies the buyer wallet, facilitator, USDC payment path, and paid delivery end-to-end by returning a timestamped pong only after successful settlement.",
    useWhen: "A funded x402 agent wants the cheapest possible wallet/facilitator/payment/delivery test before a larger paid workflow.",
    costClass: "deterministic",
    tags: ["x402", "x402 settlement test", "payment canary", "wallet payment test", "facilitator payment test", "paid delivery verification", "usdc", "base", "solana"],
    inputSchema: { type: "object", additionalProperties: false, properties: { echo: { type: "string", maxLength: 256 } } },
    example: { echo: "hello" },
    quoteTool: { name: "x402_ping", title: "x402 settlement test — wallet facilitator payment test — $0.001", description: "Paid $0.001 USDC on Base or Solana no-body settlement canary for funded agents. Returns a timestamped pong only after successful x402 payment to verify wallet, facilitator, payment, and delivery end-to-end." }
  },
  "x402-settlement-verify": {
    id: "x402-settlement-verify",
    name: "x402 Settlement Verify — Base USDC Receipt",
    operationId: "x402SettlementVerify",
    endpoint: "/api/x402-settlement-verify",
    price: "$0.001",
    priceUsd: 0.001,
    atomicAmount: "1000",
    description: "Verify a completed Base USDC x402 exact-scheme settlement from its transaction hash. Reads the public Base receipt and transaction, confirms EIP-3009 payment shape, decodes USDC Transfer events, reports confirmation depth, and optionally fails closed against an expected payTo recipient and atomic amount. No wallet key, custody, signing, or arbitrary RPC URL.",
    useWhen: "After an x402 payment returns a Base transaction hash and an agent needs independent on-chain evidence that the expected USDC transfer actually settled before trusting downstream workflow state.",
    costClass: "bounded-network",
    tags: ["x402 settlement verify", "x402 receipt", "payment receipt", "settlement", "base", "usdc", "eip-3009", "transaction verification", "payto verification", "payment evidence"],
    inputSchema: {
      type: "object",
      required: ["txHash"],
      additionalProperties: false,
      properties: {
        txHash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
        expectedPayTo: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        expectedAmountAtomic: { type: "string", pattern: "^[0-9]{1,78}$" }
      }
    },
    example: {
      txHash: "0x7729766d8615c6bd052340bddc95019be20afd78c2cd39faa4812775e3227b72",
      expectedPayTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8",
      expectedAmountAtomic: "1000"
    },
    quoteTool: {
      name: "x402_settlement_verify",
      title: "x402 settlement verify — Base USDC receipt — $0.001",
      description: "Paid $0.001 USDC on Base or Solana to independently verify a Base x402 exact-scheme settlement from its transaction hash, including EIP-3009 shape, USDC transfer, confirmations, and optional expected recipient/amount assertions."
    }
  },
  "sha256": {
    id: "sha256", name: "SHA-256 Hash", operationId: "sha256Hash", endpoint: "/api/sha256",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Compute a deterministic SHA-256 hex digest for bounded UTF-8 text.",
    useWhen: "An agent needs a SHA-256 digest for integrity, cache keys, signatures, deduplication, or workflow IDs.",
    costClass: "deterministic", tags: ["sha256", "sha-256", "hash", "digest", "integrity", "checksum"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 } } },
    example: { input: "agentresolver" },
    quoteTool: { name: "sha256", title: "SHA-256 hash — $0.001", description: "Paid $0.001 USDC on Base or Solana SHA-256 digest of bounded UTF-8 text." }
  },
  "sha512": {
    id: "sha512", name: "SHA-512 Hash", operationId: "sha512Hash", endpoint: "/api/sha512",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Compute a deterministic SHA-512 hex digest for bounded UTF-8 text.",
    useWhen: "An agent needs a SHA-512 digest for integrity, signing workflows, or deterministic identifiers.",
    costClass: "deterministic", tags: ["sha512", "sha-512", "hash", "digest", "integrity", "checksum"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 } } },
    example: { input: "agentresolver" },
    quoteTool: { name: "sha512", title: "SHA-512 hash — $0.001", description: "Paid $0.001 USDC on Base or Solana SHA-512 digest of bounded UTF-8 text." }
  },
  "hmac-sha256": {
    id: "hmac-sha256", name: "HMAC SHA-256", operationId: "hmacSha256", endpoint: "/api/hmac-sha256",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Compute a deterministic HMAC-SHA256 hex digest from bounded UTF-8 input and a caller-supplied secret.",
    useWhen: "An agent needs an HMAC-SHA256 signature for webhook verification, API signing, or integrity checks.",
    costClass: "deterministic", tags: ["hmac", "hmac-sha256", "sha256", "signature", "webhook", "integrity"],
    inputSchema: { type: "object", required: ["input", "secret"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 }, secret: { type: "string", minLength: 1, maxLength: 4096 } } },
    example: { input: "payload", secret: "secret" },
    quoteTool: { name: "hmac_sha256", title: "HMAC SHA-256 — $0.001", description: "Paid $0.001 USDC on Base or Solana HMAC-SHA256 hex digest." }
  },
  "base64-encode": {
    id: "base64-encode", name: "Base64 Encode", operationId: "base64Encode", endpoint: "/api/base64-encode",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Encode bounded UTF-8 text as Base64.",
    useWhen: "An agent needs text-to-Base64 conversion for payloads, headers, fixtures, or transport.",
    costClass: "deterministic", tags: ["base64", "encode", "encoder", "text", "utf8"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 } } },
    example: { input: "hello" },
    quoteTool: { name: "base64_encode", title: "Base64 encode — $0.001", description: "Paid $0.001 USDC on Base or Solana UTF-8 to Base64 encoding." }
  },
  "base64-decode": {
    id: "base64-decode", name: "Base64 Decode", operationId: "base64Decode", endpoint: "/api/base64-decode",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Decode bounded Base64 text to UTF-8.",
    useWhen: "An agent needs Base64-to-text decoding for payloads, tokens, fixtures, or transport.",
    costClass: "deterministic", tags: ["base64", "decode", "decoder", "text", "utf8"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 } } },
    example: { input: "aGVsbG8=" },
    quoteTool: { name: "base64_decode", title: "Base64 decode — $0.001", description: "Paid $0.001 USDC on Base or Solana Base64 to UTF-8 decoding." }
  },
  "jwt-decode": {
    id: "jwt-decode", name: "JWT Decode", operationId: "jwtDecode", endpoint: "/api/jwt-decode",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Decode a JWT header and payload without accepting secrets or claiming signature verification.",
    useWhen: "An agent needs to inspect JWT claims and metadata without verifying the token signature.",
    costClass: "deterministic", tags: ["jwt", "json web token", "decode", "claims", "token"],
    inputSchema: { type: "object", required: ["input"], additionalProperties: false, properties: { input: { type: "string", maxLength: 131072 } } },
    example: { input: "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjMifQ.signature" },
    quoteTool: { name: "jwt_decode", title: "JWT decode — $0.001", description: "Paid $0.001 USDC on Base or Solana non-verifying JWT header/payload decode." }
  },
  "json-normalize": {
    id: "json-normalize", name: "JSON Normalize", operationId: "jsonNormalize", endpoint: "/api/json-normalize",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Recursively sort JSON object keys and return canonical compact JSON plus a SHA-256 digest.",
    useWhen: "An agent needs stable JSON for hashing, deduplication, cache keys, signatures, diffs, or deterministic comparisons.",
    costClass: "deterministic", tags: ["json", "normalize", "canonical", "stable", "sort keys", "sha256"],
    inputSchema: { type: "object", required: ["value"], additionalProperties: false, properties: { value: {} } },
    example: { value: { b: 2, a: 1 } },
    quoteTool: { name: "json_normalize", title: "JSON normalize — $0.001", description: "Paid $0.001 USDC on Base or Solana canonical JSON normalization plus SHA-256 digest." }
  },
  "json-schema-validate": {
    id: "json-schema-validate", name: "JSON Schema Validate", operationId: "jsonSchemaValidate", endpoint: "/api/json-schema-validate",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Validate JSON data against a practical deterministic JSON Schema subset and return exact path-level errors.",
    useWhen: "An agent needs a cheap validation gate before passing structured data to another tool.",
    costClass: "deterministic", tags: ["json schema", "validate", "validation", "schema", "structured data"],
    inputSchema: { type: "object", required: ["data", "schema"], additionalProperties: false, properties: { data: {}, schema: { type: "object" } } },
    example: { data: { id: "123" }, schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
    quoteTool: { name: "json_schema_validate", title: "JSON Schema validate — $0.001", description: "Paid $0.001 USDC on Base or Solana deterministic JSON Schema subset validation." }
  },
  "url-parse": {
    id: "url-parse", name: "URL Parse", operationId: "urlParse", endpoint: "/api/url-parse",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Parse an absolute URL into normalized components and machine-readable query parameters.",
    useWhen: "An agent needs reliable URL components or query parameters without writing parser glue.",
    costClass: "deterministic", tags: ["url", "parse", "query parameters", "hostname", "pathname", "uri"],
    inputSchema: { type: "object", required: ["url"], additionalProperties: false, properties: { url: { type: "string", maxLength: 4096 } } },
    example: { url: "https://example.com/a?x=1&x=2#frag" },
    quoteTool: { name: "url_parse", title: "URL parse — $0.001", description: "Paid $0.001 USDC on Base or Solana absolute URL parser." }
  },
  "uuid-v4": {
    id: "uuid-v4", name: "UUID v4", operationId: "uuidV4", endpoint: "/api/uuid-v4",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Generate one or more cryptographically random UUID v4 values for IDs, traces, fixtures, and workflow keys.",
    useWhen: "An agent needs fresh UUID v4 identifiers without maintaining a utility dependency.",
    costClass: "deterministic", tags: ["uuid", "uuid v4", "id", "identifier", "trace id", "random"],
    inputSchema: { type: "object", additionalProperties: false, properties: { count: { type: "integer", minimum: 1, maximum: 20 } } },
    example: { count: 1 },
    quoteTool: { name: "uuid_v4", title: "UUID v4 — $0.001", description: "Paid $0.001 USDC on Base or Solana UUID v4 generation, up to 20 IDs." }
  },
  "slugify": {
    id: "slugify", name: "Slugify", operationId: "slugifyText", endpoint: "/api/slugify",
    price: "$0.001", priceUsd: 0.001, atomicAmount: "1000",
    description: "Convert bounded text into a stable lowercase URL slug with deterministic separator handling.",
    useWhen: "An agent needs a safe URL/path slug for titles, labels, routes, or filenames.",
    costClass: "deterministic", tags: ["slugify", "slug", "url slug", "filename", "route"],
    inputSchema: { type: "object", required: ["text"], additionalProperties: false, properties: { text: { type: "string", maxLength: 8192 }, separator: { type: "string", enum: ["-", "_"] } } },
    example: { text: "Hello Agent World", separator: "-" },
    quoteTool: { name: "slugify", title: "Slugify — $0.001", description: "Paid $0.001 USDC on Base or Solana deterministic slug generation." }
  },
  "hash-encode": {
    id: "hash-encode",
    name: "Hash & Encode",
    operationId: "hashAndEncode",
    endpoint: "/api/hash-encode",
    price: "$0.001",
    priceUsd: 0.001,
    atomicAmount: "1000",
    description: "Deterministic hashing and encoding primitive for SHA-256, SHA-512, HMAC-SHA256, Base64 encode/decode, and non-verifying JWT decode.",
    useWhen: "An agent needs a cheap deterministic hash, HMAC, Base64 transform, or JWT payload/header decode inside a workflow without creating an account or API key.",
    costClass: "deterministic",
    tags: ["hash", "hashing", "sha256", "sha512", "hmac", "base64", "encode", "decode", "jwt", "token", "deterministic", "x402"],
    inputSchema: {
      type: "object",
      required: ["operation", "input"],
      additionalProperties: false,
      properties: {
        operation: { type: "string", enum: ["sha256", "sha512", "hmac-sha256", "base64-encode", "base64-decode", "jwt-decode"] },
        input: { type: "string", maxLength: 131072 },
        secret: { type: "string", maxLength: 4096 }
      }
    },
    example: { operation: "sha256", input: "agentresolver" },
    quoteTool: {
      name: "hash_encode",
      title: "Hash & encode — $0.001",
      description: "Paid $0.001 USDC on Base or Solana deterministic SHA-256, SHA-512, HMAC-SHA256, Base64 encode/decode, or non-verifying JWT decode. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "http-inspect": {
    id: "http-inspect",
    name: "HTTP Endpoint Inspect (Legacy Alias)",
    operationId: "inspectHttpEndpointLegacy",
    endpoint: "/api/http-inspect",
    price: "$0.001",
    priceUsd: 0.001,
    atomicAmount: "1000",
    description: "Legacy compatibility endpoint for bounded HTTP, TLS, reachability and payment-challenge inspection. New x402 verify-before-pay buyers should use /api/x402-payment-preflight.",
    useWhen: "An existing integration still calls the legacy HTTP inspection route. New payment-preflight workflows should use /api/x402-payment-preflight.",
    costClass: "bounded-network",
    tags: ["http inspect", "https", "status", "latency", "headers", "security", "tls", "legacy"],
    inputSchema: {
      type: "object",
      required: ["url"],
      additionalProperties: false,
      properties: {
        url: { type: "string", pattern: "^https://", maxLength: 500 },
        maxPriceUsd: { type: "number", minimum: 0, maximum: 1000 },
        expectedPayTo: { type: "string", minLength: 1, maxLength: 128 },
        expectedNetwork: { type: "string", maxLength: 128 },
        method: { type: "string", enum: ["GET", "HEAD", "POST"] },
        body: {},
        allowUnpaidPostProbe: { type: "boolean" }
      }
    },
    example: { url: "https://example.com/api", method: "GET", maxPriceUsd: 0.01, expectedNetwork: "eip155:8453" },
    quoteTool: {
      name: "http_inspect",
      title: "x402 payment preflight + PayTo verification — $0.001",
      description: "Paid $0.001 USDC on Base or Solana verify-before-pay endpoint safety check: payTo verification, quote price, network, asset, resource binding and x402 challenge compliance before an agent authorizes spend. POST probes require explicit caller opt-in because an unprotected endpoint could have side effects."
    }
  },
  "x402-payment-preflight": {
    id: "x402-payment-preflight",
    name: "X402 Preflight — Verify Endpoint Before Paying | Endpoint Safety | USDC Payment Check",
    operationId: "x402PaymentPreflightPayToVerification",
    endpoint: "/api/x402-payment-preflight",
    price: "$0.001",
    priceUsd: 0.001,
    atomicAmount: "1000",
    description: "Verify a public x402 endpoint before paying it. AgentResolver performs one bounded HTTPS preflight and returns a fail-closed router decision plus the exact observed target payment terms: payTo recipient, USDC amount, network, asset, resource binding, x402 version and scheme, together with machine-readable evidence for reachability and PAYMENT-REQUIRED structure before an autonomous agent authorizes spend. The probe does not request private keys or a target payment, does not follow redirects, blocks private/reserved network targets, stops after headers/TLS/payment evidence, and times out at 4.5 seconds. Optional max-price, expected-payee and expected-network assertions fail closed on mismatches. Response headers include a request ID, contract version and exact deployed source SHA. The paid result also returns a reusable evidence receipt with stable fingerprints for the observed payment identity and terms so agents can detect changes across observations without treating a wallet as a verified legal identity. Point-in-time evidence, not a guarantee of future uptime, provider legitimacy, or fulfillment. Works on Base and Solana.",
    useWhen: "Immediately before every autonomous x402 spend. Treat AgentResolver Guard as the fail-closed transaction-path gate for API trust/security preflight, endpoint safety, payTo verification and USDC payment checks: it returns eligible/blocked, exact validated target payment terms, reason codes, evidence fingerprints and caller-only authorization boundaries before the wallet signs.",
    costClass: "bounded-network",
    tags: ["x402 preflight", "verify endpoint before paying", "payTo verification", "USDC payment check", "api trust security preflight", "endpoint safety", "payment verification", "x402 endpoint safety", "bounded preflight", "no private keys", "deployment provenance", "request correlation", "resource binding", "Base mainnet", "Solana", "payment-required", "agent payment safety", "agentresolver guard", "payment guard", "agent wallet firewall", "payment authorization gate", "before every payment"],
    inputSchema: {
      type: "object",
      required: ["url"],
      additionalProperties: false,
      properties: {
        url: { type: "string", pattern: "^https://", maxLength: 500 },
        maxPriceUsd: { type: "number", minimum: 0, maximum: 1000 },
        expectedPayTo: { type: "string", minLength: 1, maxLength: 128 },
        expectedNetwork: { type: "string", maxLength: 128 },
        method: { type: "string", enum: ["GET", "HEAD", "POST"] },
        body: {},
        allowUnpaidPostProbe: { type: "boolean" }
      }
    },
    example: { url: "https://example.com/api", method: "GET", maxPriceUsd: 0.01 },
    quoteTool: {
      name: "x402_payment_preflight",
      title: "X402 preflight — verify endpoint before paying — endpoint safety — USDC payment check — $0.001",
      description: "Paid $0.001 USDC on Base or Solana transaction-path gate for autonomous buyers. Returns eligible/blocked, exact target payment terms, fail-closed reason codes and verifiable evidence before caller authorization. AgentResolver never requests a private key, signs the target payment, or custodies/forwards target funds."
    }
  },
  "tool-contract": {
    id: "tool-contract",
    name: "Tool Contract Fit",
    operationId: "evaluateToolContract",
    endpoint: "/api/tool-contract",
    price: "$0.005",
    priceUsd: 0.005,
    atomicAmount: "5000",
    description: "Deterministically check whether one tool's structured output can satisfy another tool's required JSON-schema input contract, with exact incompatibility reasons and safe normalized field mappings.",
    useWhen: "An agent is about to connect two structured tools and needs a deterministic compatibility check before attempting the workflow.",
    costClass: "deterministic",
    tags: ["json-schema", "tool-contract", "compatibility", "workflow", "mapping", "x402"],
    inputSchema: { type: "object", required: ["producerOutputSchema", "consumerInputSchema"], additionalProperties: false, properties: { producerOutputSchema: { type: "object" }, consumerInputSchema: { type: "object" } } },
    example: { producerOutputSchema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] }, consumerInputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
    quoteTool: {
      name: "tool_contract",
      title: "Tool contract fit — $0.005",
      description: "Paid $0.005 USDC on Base or Solana deterministic JSON-schema compatibility check between one tool output and the next tool input. Returns exact incompatibility reasons and conservative normalized mappings. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "mcp-probe": {
    id: "mcp-probe",
    name: "MCP Live Preflight",
    operationId: "probeMcpEndpoint",
    endpoint: "/api/mcp-probe",
    price: "$0.001",
    priceUsd: 0.001,
    atomicAmount: "1000",
    description: "Live-preflight one public MCP endpoint for reachability, protocol compatibility, latency, server metadata, and tool inventory.",
    useWhen: "A concrete public MCP endpoint is known and current reachability, compatibility, latency or tool inventory matters before depending on it.",
    costClass: "bounded-network",
    tags: ["mcp", "preflight", "tools", "latency", "compatibility", "x402"],
    inputSchema: { type: "object", required: ["endpoint"], additionalProperties: false, properties: { endpoint: { type: "string", pattern: "^https://", maxLength: 500 } } },
    example: { endpoint: "https://example.com/mcp" },
    quoteTool: {
      name: "mcp_preflight",
      title: "MCP live preflight — $0.001",
      description: "Paid $0.001 USDC on Base or Solana live MCP endpoint preflight for reachability, compatibility, latency, server metadata and tool inventory. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "agent-readiness": {
    id: "agent-readiness",
    name: "Agent Readiness Audit",
    operationId: "auditAgentReadiness",
    endpoint: "/api/agent-readiness",
    price: "$0.005",
    priceUsd: 0.005,
    atomicAmount: "5000",
    description: "Audit a public website for machine-readable agent discoverability and integration signals.",
    useWhen: "An agent or operator needs current evidence that a public site exposes usable agent discovery and integration metadata.",
    costClass: "bounded-network",
    tags: ["agent-readiness", "llms.txt", "openapi", "mcp", "robots", "sitemap", "x402"],
    inputSchema: { type: "object", required: ["url"], additionalProperties: false, properties: { url: { type: "string", pattern: "^https://", maxLength: 500 } } },
    example: { url: "https://example.com" },
    quoteTool: {
      name: "agent_readiness",
      title: "Agent-readiness audit — $0.005",
      description: "Paid $0.005 USDC on Base or Solana audit of a public website for agent discoverability and machine-readable integration signals. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "openapi-select": {
    id: "openapi-select",
    name: "OpenAPI Operation Select",
    operationId: "selectOpenApiOperation",
    endpoint: "/api/openapi-select",
    price: "$0.005",
    priceUsd: 0.005,
    atomicAmount: "5000",
    description: "Fetch a public JSON OpenAPI spec, rank its operations against a natural-language goal, and return one compact execution-ready operation contract with request parameters, body schema, auth requirements, alternatives, and confidence.",
    useWhen: "An agent has a public OpenAPI spec but needs to choose the right operation without loading the entire API surface into model context.",
    costClass: "bounded-network",
    tags: ["openapi", "api operation", "operation selection", "operationid", "endpoint selection", "request schema", "agent tool", "x402"],
    inputSchema: { type: "object", required: ["specUrl", "goal"], additionalProperties: false, properties: { specUrl: { type: "string", pattern: "^https://", maxLength: 500 }, goal: { type: "string", minLength: 1, maxLength: 600 } } },
    example: { specUrl: "https://example.com/openapi.json", goal: "find a customer order by id" },
    quoteTool: {
      name: "openapi_select",
      title: "OpenAPI operation selection — $0.005",
      description: "Paid $0.005 USDC on Base or Solana selection of the best operation from one public JSON OpenAPI spec for a stated goal. Returns a compact execution-ready contract. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "verified-resolve": {
    id: "verified-resolve",
    name: "Verified Resolve",
    operationId: "verifiedResolve",
    endpoint: "/api/verified-resolve",
    price: "$0.02",
    priceUsd: 0.02,
    atomicAmount: "20000",
    description: "Procure one missing capability across AgentResolver, domain-enrolled providers, 402 Index, PayAI, Circle and MCP, then perform up to two unpaid live verification probes against supported MCP/x402 candidates before returning evidence-backed selection data. L402 and MPP remain discovery-only until protocol-specific live verifiers exist.",
    useWhen: "Free procurement returns external candidates but stale, dead, MCP-incompatible, payment-contract-drifted, or otherwise unverified endpoints would make a blind selection costly.",
    costClass: "bounded-network",
    tags: ["capability", "procurement", "mcp", "x402", "l402", "mpp", "verification", "selection"],
    inputSchema: {
      type: "object",
      required: ["goal"],
      additionalProperties: false,
      properties: {
        goal: { type: "string", minLength: 1, maxLength: 600 },
        url: { type: "string", pattern: "^https://", maxLength: 500 },
        constraints: {
          type: "object",
          additionalProperties: true,
          description: "Optional procurement constraints carried through from free /api/procure, including maxPriceUsd, preferredNetworks, protocol, JSON-schema requirements, sideEffect, auth and requireHttps."
        }
      }
    },
    example: { goal: "Find and verify a paid web search service", constraints: { maxPriceUsd: 0.05, protocol: "x402", preferredNetworks: ["eip155:8453"] } },
    quoteTool: {
      name: "verified_resolve",
      title: "Live verified resolve — $0.02",
      description: "Paid $0.02 USDC on Base or Solana procurement plus up to two unpaid live verification probes across the same open-world candidate universe used by free procurement. Live verification currently covers MCP and x402; L402/MPP are labeled discovery-only. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "batch-verified-resolve": {
    id: "batch-verified-resolve",
    name: "Batch Verified Resolve",
    operationId: "batchVerifiedResolve",
    endpoint: "/api/batch-verified-resolve",
    price: "$0.05",
    priceUsd: 0.05,
    atomicAmount: "50000",
    description: "Resolve and live-verify up to four missing capability decisions in one bounded call, using unpaid MCP and x402/HTTP evidence.",
    useWhen: "An agent has multiple missing capability decisions and wants one bounded purchase with live external-candidate evidence.",
    costClass: "bounded-network",
    tags: ["batch", "capability", "discovery", "mcp", "verification", "x402"],
    inputSchema: { type: "object", required: ["items"], additionalProperties: false, properties: { items: { type: "array", minItems: 2, maxItems: 4, items: { type: "object", required: ["goal"], additionalProperties: false, properties: { goal: { type: "string", minLength: 1, maxLength: 600 }, url: { type: "string", pattern: "^https://", maxLength: 500 } } } } } },
    example: { items: [{ goal: "Find an MCP server for search" }, { goal: "Find an MCP server for browser automation" }] },
    quoteTool: {
      name: "batch_verified_resolve",
      title: "Batch verified resolve — $0.05",
      description: "Paid $0.05 USDC on Base or Solana batch live verification for 2–4 capability decisions using unpaid MCP and x402/HTTP evidence. x402-aware MCP clients can authorize and settle inside this tool call."
    }
  },
  "provider-launch-check": {
    id: "provider-launch-check",
    name: "Provider Launch Check",
    operationId: "providerLaunchCheck",
    endpoint: "/api/provider-launch-check",
    price: "$0.05",
    priceUsd: 0.05,
    atomicAmount: "50000",
    description: "Paid seller-side readiness and x402 contract verification for providers that want AgentResolver distribution. Produces a bounded registryEntry only after settlement and technical checks.",
    useWhen: "A machine-service provider wants to join the AgentResolver provider network and needs a paid readiness/payment-contract check before submitting its registry entry.",
    costClass: "bounded-network",
    tags: ["provider onboarding", "seller verification", "agent distribution", "x402", "provider network", "launch check"],
    inputSchema: {
      type: "object",
      required: ["providerId", "providerName", "capabilityId", "name", "description", "origin", "endpoint", "priceUsd"],
      additionalProperties: false,
      properties: {
        providerId: { type: "string", minLength: 1, maxLength: 80 },
        providerName: { type: "string", minLength: 1, maxLength: 120 },
        capabilityId: { type: "string", minLength: 1, maxLength: 120 },
        name: { type: "string", minLength: 1, maxLength: 160 },
        description: { type: "string", minLength: 1, maxLength: 500 },
        origin: { type: "string", pattern: "^https://" },
        endpoint: { type: "string", pattern: "^https://" },
        method: { type: "string", enum: ["GET", "POST"], default: "GET" },
        probeUrl: { type: "string", pattern: "^https://" },
        priceUsd: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
        network: { type: "string", default: "eip155:8453" },
        tags: { type: "array", maxItems: 20, items: { type: "string", maxLength: 80 } }
      }
    },
    example: {
      providerId: "example-provider",
      providerName: "Example Provider",
      capabilityId: "web-search",
      name: "Web Search",
      description: "Search public web data.",
      origin: "https://provider.example",
      endpoint: "https://provider.example/api/search",
      method: "GET",
      priceUsd: 0.01,
      network: "eip155:8453",
      tags: ["search", "web"]
    },
    quoteTool: {
      name: "provider_launch_check",
      title: "Provider launch check — $0.05",
      description: "Paid $0.05 USDC seller-side readiness and x402 contract verification before AgentResolver provider-network review."
    }
  },
  "provider-attribution-settle": {
    id: "provider-attribution-settle",
    name: "Provider Attribution Settlement",
    operationId: "providerAttributionSettlement",
    endpoint: "/api/provider-attribution-settle",
    price: "$0.001",
    priceUsd: 0.001,
    atomicAmount: "1000",
    description: "Provider-funded $0.001 USDC success-fee settlement. Fulfilled conversions require a Base transaction hash that AgentResolver independently verifies against the registered provider USDC payment identity before returning the paid fee receipt. Qualified leads remain explicitly separate and do not claim a buyer settlement.",
    useWhen: "After /api/provider-attribution-verify confirms a routed buyer's Base USDC payment to the registered provider route, the provider settles the fixed success fee. Qualified-lead fees can be recorded separately without claiming a completed buyer transaction.",
    costClass: "deterministic",
    tags: ["provider attribution", "provider funded", "success fee", "agent routing", "x402", "settlement", "referral"],
    inputSchema: {
      type: "object",
      required: ["attributionId", "providerId", "outcome"],
      additionalProperties: false,
      properties: {
        attributionId: { type: "string", pattern: "^atr_[0-9a-fA-F-]{36}$" },
        providerId: { type: "string", minLength: 1, maxLength: 80 },
        routeId: { type: "string", minLength: 1, maxLength: 100 },
        outcome: { type: "string", enum: ["fulfilled", "qualified-lead"] },
        buyerTxHash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
        externalTransactionRef: { type: "string", maxLength: 256 }
      }
    },
    example: {
      attributionId: "atr_123e4567-e89b-42d3-a456-426614174000",
      providerId: "example-provider",
      routeId: "example-provider:web-search",
      outcome: "fulfilled",
      buyerTxHash: "0x7729766d8615c6bd052340bddc95019be20afd78c2cd39faa4812775e3227b72"
    },
    quoteTool: {
      name: "provider_attribution_settle",
      title: "Provider attribution settlement — $0.001",
      description: "Paid $0.001 USDC on Base or Solana provider-funded success-fee receipt. For fulfilled conversions, use the free provider-attribution-verify endpoint first; the paid receipt independently rechecks the registered Base USDC buyer settlement."
    }
  }
} as const;

export type PaidCapabilityId = keyof typeof PAID_CAPABILITIES;
export type PaidCapability = (typeof PAID_CAPABILITIES)[PaidCapabilityId];

export const PAID_CAPABILITY_LIST = Object.values(PAID_CAPABILITIES);

export function getPaidCapability(id: PaidCapabilityId): PaidCapability {
  return PAID_CAPABILITIES[id];
}
