export const X402_BUYER_SETUP_PATH = "/api/x402-client-setup" as const;
export const X402_BUYER_SETUP_URL = `https://agentresolver.vercel.app${X402_BUYER_SETUP_PATH}` as const;
export const X402_BUYER_SETUP_ERROR = `Payment required. x402 buyer setup: ${X402_BUYER_SETUP_URL}` as const;
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
          },
          preSignGuardAuthorization: {
            hook: "onPaymentRequested",
            stage: "before_wallet_signature",
            toolNames: ["payment_guard", "x402_payment_preflight"],
            priceUsd: 0.001,
            expectedAtomicUsdc: "1000",
            allowedNetworks: [
              "eip155:8453",
              "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
            ],
            expectedRequirements: [
              {
                scheme: "exact",
                network: "eip155:8453",
                amount: "1000",
                asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                payTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8",
                resource: "https://agentresolver.vercel.app/mcp"
              },
              {
                scheme: "exact",
                network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
                amount: "1000",
                asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                payTo: "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa",
                resource: "https://agentresolver.vercel.app/mcp"
              }
            ],
            rule:
              "Return true only when the caller-owned spend policy has authorized this exact AgentResolver Guard fee and the tool, amount, network, scheme, asset and resource match caller expectations; otherwise return false."
          }
        },
        behavior: [
          "Connect the x402-aware MCP client to https://agentresolver.vercel.app/mcp.",
          "Register only payment schemes/networks backed by the caller's own signer.",
          "Apply caller-owned spend controls or policies before any wallet signature.",
          "For per-call Guard authorization, use the x402 MCP client's onPaymentRequested hook to verify the intended tool and exact $0.001 requirement before the signer runs.",
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
          ],
          preSignGuardAuthorization: {
            mechanism: "paymentRequirementsSelector",
            stage: "after_402_before_payment_payload_creation",
            guardUrl: "https://agentresolver.vercel.app/api/payment-guard",
            expectedAtomicUsdc: "1000",
            expectedRequirements: [
              {
                scheme: "exact",
                network: "eip155:8453",
                amount: "1000",
                asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                payTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
              },
              {
                scheme: "exact",
                network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
                amount: "1000",
                asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                payTo: "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa"
              }
            ],
            rule:
              "Only invoke the payment-wrapped request for the exact Guard URL after caller policy authorizes the $0.001 fee. The paymentRequirementsSelector must reject every requirement that does not exactly match one approved tuple before payment payload creation."
          }
        },
        axios: {
          package: "@x402/axios",
          packages: ["axios", "@x402/axios", "@x402/evm", "@x402/svm"],
          installCommand: "npm install axios @x402/axios @x402/evm @x402/svm",
          wrapper: "wrapAxiosWithPayment",
          client: "x402Client",
          evmExactScheme: "@x402/evm/exact/client",
          svmExactScheme: "@x402/svm/exact/client",
          baseEvmQuickstart: [
            'import axios from "axios";',
            'import { x402Client, wrapAxiosWithPayment } from "@x402/axios";',
            'import { ExactEvmScheme } from "@x402/evm/exact/client";',
            "",
            "// callerOwnedSigner is supplied by the host wallet/runtime. Do not send it to AgentResolver.",
            "// Only call the wrapped client after the caller has authorized the displayed x402 requirement.",
            "const client = new x402Client()",
            '  .register("eip155:8453", new ExactEvmScheme(callerOwnedSigner));',
            "const axiosWithPayment = wrapAxiosWithPayment(axios.create(), client);",
            "",
            'const response = await axiosWithPayment.get("https://agentresolver.vercel.app/api/x402-ping");'
          ],
          authorizationRule:
            "The Axios wrapper automatically retries a 402 with payment. Use it only after caller-owned policy has authorized the exact requirement or behind a caller-defined paymentRequirementsSelector.",
          preSignGuardAuthorization: {
            mechanism: "paymentRequirementsSelector",
            stage: "after_402_before_payment_payload_creation",
            guardUrl: "https://agentresolver.vercel.app/api/payment-guard",
            expectedAtomicUsdc: "1000",
            expectedRequirements: [
              {
                scheme: "exact",
                network: "eip155:8453",
                amount: "1000",
                asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                payTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
              },
              {
                scheme: "exact",
                network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
                amount: "1000",
                asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                payTo: "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa"
              }
            ],
            rule:
              "Only invoke the payment-wrapped Axios request for the exact Guard URL after caller policy authorizes the $0.001 fee. Reject every unmatched requirement in paymentRequirementsSelector before payment payload creation."
          }
        },
        python: {
          package: "x402",
          installCommand: "pip install x402",
          client: "x402HttpxClient",
          evmSignerAdapter: "EthAccountSigner",
          exactEvmRegistration: "register_exact_evm_client",
          baseEvmQuickstart: [
            "import asyncio",
            "from x402 import x402Client",
            "from x402.http.clients import x402HttpxClient",
            "from x402.mechanisms.evm import EthAccountSigner",
            "from x402.mechanisms.evm.exact.register import register_exact_evm_client",
            "",
            "# caller_owned_account is supplied by the host wallet/runtime. Never send wallet secrets to AgentResolver.",
            "async def main():",
            "    client = x402Client()",
            "    register_exact_evm_client(client, EthAccountSigner(caller_owned_account))",
            "    async with x402HttpxClient(client) as http:",
            "        response = await http.request(",
            '            method="GET",',
            '            url="https://agentresolver.vercel.app/api/x402-ping",',
            "        )",
            "        await response.aread()",
            "        return response",
            "",
            "response = asyncio.run(main())"
          ],
          preSignGuardAuthorization: {
            mechanisms: ["client_policies", "on_before_payment_creation"],
            hook: "on_before_payment_creation",
            abortType: "AbortResult",
            stage: "before_payment_payload_creation",
            guardUrl: "https://agentresolver.vercel.app/api/payment-guard",
            expectedAtomicUsdc: "1000",
            expectedRequirements: [
              {
                scheme: "exact",
                network: "eip155:8453",
                amount: "1000",
                asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                payTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
              },
              {
                scheme: "exact",
                network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
                amount: "1000",
                asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                payTo: "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa"
              }
            ],
            rule:
              "Use client policies to reject disallowed requirements and on_before_payment_creation to return AbortResult for any selected Guard requirement not authorized by caller policy before a payment payload is created."
          }
        },
        behavior: [
          "Create an x402Client and register only exact schemes backed by the caller's own signer.",
          "Wrap the caller's fetch implementation with wrapFetchWithPayment(fetch, client), use wrapAxiosWithPayment for Axios, or use x402HttpxClient for Python/httpx.",
          "Apply caller-owned payment selection and spend policy before signing.",
          "Send the original paid request; the x402 wrapper handles PAYMENT-REQUIRED and the authorized PAYMENT-SIGNATURE retry."
        ]
      },
      coinbaseAgentKit: {
        package: "@coinbase/agentkit",
        x402Actions: {
          discover: "discover_x402_services",
          listApprovedServices: "list_registered_services",
          approveService: "register_x402_service",
          challenge: "make_http_request",
          authorizedRetry: "retry_http_request_with_x402",
          automaticPayment: "make_http_request_with_x402"
        },
        serviceApproval: {
          defaultDynamicRegistration: false,
          configKeys: ["registeredServices", "allowDynamicServiceRegistration"],
          requiredOrigins: ["https://agentresolver.vercel.app"],
          rule:
            "Before make_http_request, the exact target and AgentResolver origin must already be approved. If dynamic service registration is enabled, register them explicitly; otherwise the host administrator must preconfigure them."
        },
        paymentGuardUrl: "https://agentresolver.vercel.app/api/payment-guard",
        behavior: [
          "Call list_registered_services before the first request. AgentKit blocks make_http_request for URLs outside its registered service allowlist.",
          "Ensure the exact target and https://agentresolver.vercel.app are approved. If allowDynamicServiceRegistration is true, register each intentionally with register_x402_service; otherwise the host administrator must preconfigure them in registeredServices.",
          "Use make_http_request on the approved exact target first so its x402 terms are visible before any payment.",
          "Build the AgentResolver Guard URL with that target plus caller-owned constraints and use make_http_request on the approved AgentResolver origin to receive Guard's separate $0.001 challenge without paying.",
          "Only after the caller's own policy authorizes the $0.001 Guard spend, use retry_http_request_with_x402 to pay Guard and obtain the eligible/blocked evidence.",
          "Require decision === eligible and re-check amount, asset, network, payTo and resource binding against caller policy.",
          "Only after separate caller authorization for the target amount, use retry_http_request_with_x402 on the original target challenge.",
          "Do not use make_http_request_with_x402 on an unfamiliar target before Guard and caller authorization because it combines challenge handling and payment."
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
      mcpPreSignPolicy: "https://github.com/x402-foundation/x402/blob/main/docs/guides/mcp-server-with-x402.md#using-the-onpaymentrequested-hook",
      bazaar: "https://github.com/x402-foundation/x402/blob/main/docs/extensions/bazaar.mdx",
      protocol: "https://github.com/x402-foundation/x402",
      axios: "https://github.com/x402-foundation/x402/blob/main/typescript/packages/http/axios/README.md",
      coinbaseAgentKit: "https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/README.md"
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
