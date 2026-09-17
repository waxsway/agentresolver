export const X402_BUYER_SETUP_PATH = "/api/x402-client-setup" as const;
export const X402_BUYER_SETUP_URL = `https://agentresolver.vercel.app${X402_BUYER_SETUP_PATH}` as const;
export const AGENT_SKILLS_INDEX_URL = "https://agentresolver.vercel.app/.well-known/agent-skills/index.json" as const;
export const PAYMENT_GUARD_SKILL_URL = "https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md" as const;

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
      agentSkillsIndex: AGENT_SKILLS_INDEX_URL,
      paymentGuardSkill: PAYMENT_GUARD_SKILL_URL,
      canonicalPreflight: "https://agentresolver.vercel.app/api/x402-payment-preflight",
      paymentGuard: "https://agentresolver.vercel.app/api/payment-guard",
      paymentGuardRequest: {
        method: "GET",
        priceUsd: 0.001,
        requiredQuery: ["url"],
        optionalQuery: [
          "method",
          "maxPriceUsd",
          "expectedPayTo",
          "expectedNetwork",
          "allowUnpaidPostProbe"
        ],
        repeatUse: "before_each_autonomous_x402_spend"
      }
    },
    agentSkill: {
      name: "agentresolver-payment-guard",
      discoveryIndex: AGENT_SKILLS_INDEX_URL,
      url: PAYMENT_GUARD_SKILL_URL,
      installCommand:
        "npx skills add https://agentresolver.vercel.app --skill agentresolver-payment-guard",
      purpose:
        "Install the repeat-use Guard procedure into a compatible agent runtime so pre-payment verification becomes part of the buyer workflow."
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
          installCommand: "npm install @x402/mcp @x402/evm @x402/svm",
          factory: "createx402MCPClient",
          evmExactScheme: "@x402/evm/exact/client",
          svmExactScheme: "@x402/svm/exact/client",
          baseEvmQuickstart: [
            'import { createx402MCPClient } from "@x402/mcp";',
            'import { ExactEvmScheme } from "@x402/evm/exact/client";',
            "",
            "// callerOwnedSigner is supplied by the host wallet/runtime. Do not send it to AgentResolver.",
            "const client = createx402MCPClient({",
            '  name: "agentresolver-buyer",',
            '  version: "1.0.0",',
            '  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(callerOwnedSigner) }]',
            "});",
            "",
            "// Connect the client transport to https://agentresolver.vercel.app/mcp,",
            "// then call the paid tool normally. The x402 client handles the authorized retry."
          ],
          configurationShape: {
            schemes: [{ network: "eip155:8453", client: "new ExactEvmScheme(callerOwnedSigner)" }],
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
          package: "@x402/fetch",
          packages: ["@x402/core", "@x402/fetch", "@x402/evm", "@x402/svm"],
          installCommand: "npm install @x402/core @x402/evm @x402/svm @x402/fetch",
          wrapper: "wrapFetchWithPayment",
          client: "x402Client",
          evmExactScheme: "@x402/evm/exact/client",
          svmExactScheme: "@x402/svm/exact/client",
          baseEvmQuickstart: [
            'import { x402Client, wrapFetchWithPayment } from "@x402/fetch";',
            'import { registerExactEvmScheme } from "@x402/evm/exact/client";',
            "",
            "// callerOwnedSigner is supplied by the host wallet/runtime. Do not send it to AgentResolver.",
            "const client = new x402Client();",
            "registerExactEvmScheme(client, { signer: callerOwnedSigner });",
            "const fetchWithPayment = wrapFetchWithPayment(fetch, client);",
            "",
            'const response = await fetchWithPayment("https://agentresolver.vercel.app/api/x402-ping");'
          ]
        },
        behavior: [
          "Create an x402Client and register only exact schemes backed by the caller's own signer.",
          "Wrap the caller's fetch implementation with wrapFetchWithPayment(fetch, client).",
          "Apply caller-owned payment selection and spend policy before signing.",
          "Send the original paid request; the x402 wrapper handles PAYMENT-REQUIRED and the authorized PAYMENT-SIGNATURE retry."
        ]
      }
    },
    recommendedSpendLoop: [
      "Receive the target service x402 challenge without signing it.",
      "Run AgentResolver Guard against the exact target endpoint.",
      "Require guard.decision === eligible and validate the returned exact targetPayment terms against caller policy.",
      "Only then may the caller-owned wallet independently authorize and sign the target payment.",
      "Repeat the Guard check before each autonomous spend because payment terms can change."
    ],
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
    agentSkillsIndex: AGENT_SKILLS_INDEX_URL,
    paymentGuardSkill: PAYMENT_GUARD_SKILL_URL,
    paymentAuthorizationRequired: true,
    signerControlledByCaller: true,
    message: "This host reached a valid x402 challenge but must use an x402-aware client plus its own signer and spend policy to make an authorized retry. For target x402 purchases, run AgentResolver Guard before each autonomous spend. AgentResolver never requests wallet secrets or authorizes spend."
  } as const;
}
