export const X402_BUYER_SETUP_PATH = "/api/x402-client-setup" as const;
export const X402_BUYER_SETUP_URL = `https://agentresolver.vercel.app${X402_BUYER_SETUP_PATH}` as const;

export type X402BuyerSetup = ReturnType<typeof x402BuyerSetup>;

/**
 * Free, non-custodial handoff for clients that can discover AgentResolver but
 * stop after receiving an x402 challenge because their host has no signer/payment loop.
 * This payload never authorizes spending and never asks a caller to disclose secrets.
 */
export function x402BuyerSetup() {
  return {
    schemaVersion: 2,
    free: true,
    purpose: "Enable a caller-controlled x402 payment client after a standard MCP or HTTP client receives a 402 challenge.",
    agentResolver: {
      mcp: "https://agentresolver.vercel.app/mcp",
      paidManifest: "https://agentresolver.vercel.app/.well-known/x402",
      buyerSetup: X402_BUYER_SETUP_URL,
      canonicalPreflight: "https://agentresolver.vercel.app/api/x402-payment-preflight"
    },
    payment: {
      protocol: "x402",
      version: 2,
      scheme: "exact",
      asset: "USDC",
      networks: [
        "eip155:8453",
        "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
      ],
      challengeHeader: "PAYMENT-REQUIRED",
      retryHeader: "PAYMENT-SIGNATURE",
      paymentIsAuthorizedByAgentResolver: false
    },
    clients: {
      mcp: {
        typescript: {
          package: "@x402/mcp",
          factory: "createx402MCPClient",
          evmExactScheme: "@x402/evm/exact/client",
          svmExactScheme: "@x402/svm/exact/client",
          configurationShape: {
            schemes: [{ network: "eip155:8453", scheme: "new ExactEvmScheme(callerOwnedSigner)" }],
            policies: ["caller-defined requirement filters before signing"],
            paymentRequirementsSelector: "caller-defined network/requirement selector"
          }
        },
        behavior: [
          "Connect the x402-aware MCP client to https://agentresolver.vercel.app/mcp.",
          "Register only payment schemes/networks backed by the caller's own signer.",
          "Apply caller-owned spend controls or policies before any wallet signature.",
          "Call the paid tool normally; the x402-aware client parses PAYMENT-REQUIRED, creates an authorized payment payload, and retries with PAYMENT-SIGNATURE."
        ]
      },
      http: {
        typescript: {
          packages: ["@x402/core", "@x402/fetch", "@x402/evm", "@x402/svm"],
          wrapper: "wrapFetchWithPayment",
          client: "x402Client",
          evmExactScheme: "@x402/evm/exact/client",
          svmExactScheme: "@x402/svm/exact/client"
        },
        behavior: [
          "Create an x402Client and register only exact schemes backed by the caller's own signer.",
          "Wrap the caller's fetch implementation with wrapFetchWithPayment(fetch, client).",
          "Apply caller-owned payment selection and spend policy before signing.",
          "Send the original paid request; the x402 wrapper handles PAYMENT-REQUIRED and the authorized PAYMENT-SIGNATURE retry."
        ]
      }
    },
    recommendedPolicyChecks: [
      "maximum amount and asset",
      "expected network and exact scheme",
      "expected resource/tool operation",
      "expected payTo when known",
      "per-agent or per-session spend limit"
    ],
    authorizationBoundary: {
      callerControlsSigner: true,
      callerControlsSpendPolicy: true,
      agentResolverReceivesPrivateKey: false,
      agentResolverReceivesSeedPhrase: false,
      agentResolverAuthorizesSpend: false,
      instruction: "Never send a private key or seed phrase to AgentResolver. Before signing, independently validate price, asset, network, payTo and resource against the caller's policy."
    },
    officialReferences: {
      mcpGuide: "https://github.com/x402-foundation/x402/blob/main/docs/guides/mcp-server-with-x402.md",
      bazaar: "https://github.com/x402-foundation/x402/blob/main/docs/extensions/bazaar.mdx",
      protocol: "https://github.com/x402-foundation/x402"
    }
  } as const;
}

export function x402BuyerSetupHint(capabilityId: string) {
  return {
    type: "agentresolver_x402_buyer_setup",
    capabilityId,
    url: X402_BUYER_SETUP_URL,
    paymentAuthorizationRequired: true,
    signerControlledByCaller: true,
    message: "This host reached a valid x402 challenge but must use an x402-aware client plus its own signer and spend policy to make an authorized retry. AgentResolver never requests wallet secrets or authorizes spend."
  } as const;
}
