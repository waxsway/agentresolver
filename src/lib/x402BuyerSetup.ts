export const X402_BUYER_SETUP_PATH = "/api/x402-client-setup" as const;
export const X402_BUYER_SETUP_URL = `https://agentresolver.vercel.app${X402_BUYER_SETUP_PATH}` as const;
export const X402_BUYER_SETUP_ERROR = `Payment required. x402 buyer setup: ${X402_BUYER_SETUP_URL}` as const;

export function x402BuyerSetupChallengeUrl(capabilityId: string) {
  return `${X402_BUYER_SETUP_URL}?source=x402-challenge&capabilityId=${encodeURIComponent(capabilityId)}`;
}

export function x402BuyerSetupChallengeError(capabilityId: string) {
  return `Payment required. x402 buyer setup: ${x402BuyerSetupChallengeUrl(capabilityId)}`;
}
export const AGENT_SKILLS_INDEX_URL = "https://agentresolver.vercel.app/.well-known/agent-skills/index.json" as const;
export const PAYMENT_GUARD_SKILL_URL = "https://agentresolver.vercel.app/.well-known/agent-skills/agentresolver-payment-guard/SKILL.md" as const;

export const X402_CHALLENGE_CLIENT_INSTALLS = {
  httpTypescript: "npm install @x402/core @x402/evm @x402/svm @x402/fetch",
  mcpTypescript: "npm install @x402/mcp @x402/evm @x402/svm",
  httpPython: "pip install \"x402[httpx,evm]\"",
  walletMcp: "npx -y x402-trinity-mcp",
  agentSkill: "npx skills add waxsway/agentresolver --skill agentresolver-payment-guard"
} as const;

export const X402_CHALLENGE_CLIENT_ENTRYPOINTS = {
  httpTypescript: {
    package: "@x402/fetch",
    factory: "wrapFetchWithPaymentFromConfig",
    wrapper: "wrapFetchWithPayment",
    schemes: [
      {
        network: "eip155:8453",
        package: "@x402/evm/exact/client",
        clientClass: "ExactEvmScheme",
        signer: "callerOwnedSigner"
      },
      {
        network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        package: "@x402/svm/exact/client",
        clientClass: "ExactSvmScheme",
        signer: "callerOwnedSigner"
      }
    ]
  },
  mcpTypescript: {
    package: "@x402/mcp",
    factory: "createx402MCPClient",
    autoPayment: true,
    approvalHook: "onPaymentRequested",
    schemes: [
      {
        network: "eip155:8453",
        package: "@x402/evm/exact/client",
        clientClass: "ExactEvmScheme",
        signer: "callerOwnedSigner"
      },
      {
        network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        package: "@x402/svm/exact/client",
        clientClass: "ExactSvmScheme",
        signer: "callerOwnedSigner"
      }
    ]
  },
  httpPython: {
    package: "x402",
    install: "pip install \"x402[httpx,evm]\"",
    client: "x402HttpxClient",
    clientFactory: "x402Client",
    clientFactoryImport: "from x402 import x402Client",
    httpClientImport: "from x402.http.clients import x402HttpxClient",
    signerAdapter: "EthAccountSigner",
    signerAdapterImport: "from x402.mechanisms.evm import EthAccountSigner",
    exactEvmRegistration: "register_exact_evm_client",
    exactEvmRegistrationImport: "from x402.mechanisms.evm.exact.register import register_exact_evm_client",
    registration: "register_exact_evm_client(client, EthAccountSigner(callerOwnedAccount))",
    evmNetwork: "eip155:8453",
    signer: "callerOwnedAccount"
  },
  walletMcp: {
    package: "x402-trinity",
    command: "x402-trinity-mcp",
    tools: ["check_price", "pay_and_fetch", "wallet_status"],
    defaultNetwork: "eip155:8453"
  },
  agentSkill: {
    repository: "waxsway/agentresolver",
    skill: "agentresolver-payment-guard"
  }
} as const;

export function x402ChallengeBuyerHandoff(capabilityId: string) {
  return {
    type: "agentresolver_x402_buyer_handoff",
    capabilityId,
    setup: x402BuyerSetupChallengeUrl(capabilityId),
    protocol: "x402",
    retryHeader: "PAYMENT-SIGNATURE",
    signerControlledByCaller: true,
    spendAuthorizationRequired: true,
    clientInstalls: X402_CHALLENGE_CLIENT_INSTALLS,
    clientEntrypoints: X402_CHALLENGE_CLIENT_ENTRYPOINTS
  } as const;
}

export function x402ChallengeHeaderHandoff(capabilityId: string) {
  const info = {
    version: 1,
    setup: x402BuyerSetupChallengeUrl(capabilityId),
    paymentGuard: "https://agentresolver.vercel.app/api/payment-guard",
    retryHeader: "PAYMENT-SIGNATURE",
    signerControlledByCaller: true,
    spendAuthorizationRequired: true,
    clients: {
      httpTs: {
        install: X402_CHALLENGE_CLIENT_INSTALLS.httpTypescript,
        package: X402_CHALLENGE_CLIENT_ENTRYPOINTS.httpTypescript.package,
        factory: X402_CHALLENGE_CLIENT_ENTRYPOINTS.httpTypescript.factory,
        schemes: X402_CHALLENGE_CLIENT_ENTRYPOINTS.httpTypescript.schemes.map(
          ({ network, package: schemePackage, clientClass }) => [network, schemePackage, clientClass]
        )
      },
      mcpTs: {
        install: X402_CHALLENGE_CLIENT_INSTALLS.mcpTypescript,
        package: X402_CHALLENGE_CLIENT_ENTRYPOINTS.mcpTypescript.package,
        factory: X402_CHALLENGE_CLIENT_ENTRYPOINTS.mcpTypescript.factory,
        approvalHook: X402_CHALLENGE_CLIENT_ENTRYPOINTS.mcpTypescript.approvalHook,
        schemes: X402_CHALLENGE_CLIENT_ENTRYPOINTS.mcpTypescript.schemes.map(
          ({ network, package: schemePackage, clientClass }) => [network, schemePackage, clientClass]
        )
      },
      python: {
        install: X402_CHALLENGE_CLIENT_INSTALLS.httpPython,
        package: X402_CHALLENGE_CLIENT_ENTRYPOINTS.httpPython.package,
        client: X402_CHALLENGE_CLIENT_ENTRYPOINTS.httpPython.client,
        clientFactory: X402_CHALLENGE_CLIENT_ENTRYPOINTS.httpPython.clientFactory,
        signerAdapterImport: X402_CHALLENGE_CLIENT_ENTRYPOINTS.httpPython.signerAdapterImport,
        exactEvmRegistrationImport: X402_CHALLENGE_CLIENT_ENTRYPOINTS.httpPython.exactEvmRegistrationImport,
        registration: X402_CHALLENGE_CLIENT_ENTRYPOINTS.httpPython.registration,
        network: X402_CHALLENGE_CLIENT_ENTRYPOINTS.httpPython.evmNetwork
      },
      walletMcp: {
        install: X402_CHALLENGE_CLIENT_INSTALLS.walletMcp,
        package: X402_CHALLENGE_CLIENT_ENTRYPOINTS.walletMcp.package,
        command: X402_CHALLENGE_CLIENT_ENTRYPOINTS.walletMcp.command,
        tools: X402_CHALLENGE_CLIENT_ENTRYPOINTS.walletMcp.tools,
        network: X402_CHALLENGE_CLIENT_ENTRYPOINTS.walletMcp.defaultNetwork
      }
    }
  } as const;

  return {
    info,
    schema: {
      type: "object",
      additionalProperties: true,
      required: [
        "version",
        "setup",
        "paymentGuard",
        "retryHeader",
        "signerControlledByCaller",
        "spendAuthorizationRequired",
        "clients"
      ],
      properties: {
        version: { type: "integer", const: 1 },
        setup: { type: "string" },
        paymentGuard: { type: "string" },
        retryHeader: { type: "string", const: "PAYMENT-SIGNATURE" },
        signerControlledByCaller: { type: "boolean", const: true },
        spendAuthorizationRequired: { type: "boolean", const: true },
        clients: { type: "object" }
      }
    }
  } as const;
}

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
        "npx skills add waxsway/agentresolver --skill agentresolver-payment-guard",
      wellKnownInstallCommand:
        "npx skills add https://agentresolver.vercel.app --skill agentresolver-payment-guard",
      repository: "waxsway/agentresolver",
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
            toolResources: {
              payment_guard: "mcp://tool/payment_guard",
              x402_payment_preflight: "mcp://tool/x402_payment_preflight"
            },
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
              "Return true only when the caller-owned spend policy has authorized this exact AgentResolver Guard fee and the tool, amount, network, scheme, asset and resource match caller expectations; otherwise return false.",
            approvalHookExample: [
              'const guardToolResources = { payment_guard: "mcp://tool/payment_guard", x402_payment_preflight: "mcp://tool/x402_payment_preflight" };',
              'const allowedGuardRequirements = [',
              '  { network: "eip155:8453", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8" },',
              '  { network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", payTo: "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa" }',
              '];',
              'const samePaymentIdentifier = (network, actual, expected) =>',
              '  network.startsWith("eip155:")',
              '    ? actual.toLowerCase() === expected.toLowerCase()',
              '    : actual === expected;',
              '',
              '// hostAllowsGuardSpend is supplied by the caller/runtime and must fail closed.',
              'onPaymentRequested: async context => {',
              '  if (!(await hostAllowsGuardSpend(context))) return false;',
              '  const expectedResource = guardToolResources[context.toolName];',
              '  if (!expectedResource) return false;',
              '  if (context.paymentRequired.x402Version !== 2) return false;',
              '  if (context.paymentRequired.resource.url !== expectedResource) return false;',
              '  return context.paymentRequired.accepts.some(requirement =>',
              '    requirement.scheme === "exact" &&',
              '    requirement.amount === "1000" &&',
              '    allowedGuardRequirements.some(expected =>',
              '      requirement.network === expected.network &&',
              '      samePaymentIdentifier(requirement.network, requirement.asset, expected.asset) &&',
              '      samePaymentIdentifier(requirement.network, requirement.payTo, expected.payTo)',
              '    )',
              '  );',
              '}'
            ]
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
          installCommand: "pip install \"x402[httpx,evm]\"",
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
      x402Trinity: {
        runtime: "x402-trinity MCP wallet",
        package: "x402-trinity",
        mcpCommand: "npx -y x402-trinity-mcp",
        paymentGuardUrl: "https://agentresolver.vercel.app/api/payment-guard",
        defaultNetwork: "eip155:8453",
        defaultAsset: "USDC",
        tools: {
          checkPrice: "check_price",
          payAndFetch: "pay_and_fetch",
          walletStatus: "wallet_status"
        },
        authorizationModel:
          "Keep wallet credentials and hard spend limits inside the caller-controlled x402-trinity process. AgentResolver never receives the wallet secret. Use check_price before a paid call, allow pay_and_fetch only when the caller's local budget and host policy authorize the exact spend, and treat Guard eligibility as evidence rather than target-payment authorization.",
        behavior: [
          "Use check_price on the exact AgentResolver Guard URL first so the $0.001 requirement is visible without paying.",
          "Require the caller-controlled x402-trinity budget and host allowlist to permit AgentResolver before using pay_and_fetch.",
          "Use pay_and_fetch on Guard only after that local policy authorizes the separate $0.001 fee.",
          "Require Guard decision === eligible and compare the returned target amount, asset, network, payTo, scheme and resource binding against caller policy.",
          "Use a separate caller-authorized pay_and_fetch call for the original target only after Guard succeeds.",
          "Keep all wallet credentials inside x402-trinity; never send them to AgentResolver."
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
      },
      vercelAiSdkMcp: {
        runtime: "Vercel AI SDK",
        package: "ai",
        paymentPackage: "x402-mcp",
        mcpClientFactory: "experimental_createMCPClient",
        paymentWrapper: "withPayment",
        transport: "StreamableHTTPClientTransport",
        mcpUrl: "https://agentresolver.vercel.app/mcp",
        guardTool: "payment_guard",
        authorizationModel:
          "Keep the paying account inside the caller runtime. Do not invoke a payment-wrapped Guard tool until caller policy has approved the exact $0.001 Guard fee. For hard per-requirement enforcement before signing, prefer the official @x402/mcp onPaymentRequested gate published above.",
        behavior: [
          "Create an AI SDK MCP client for https://agentresolver.vercel.app/mcp using StreamableHTTPClientTransport.",
          "Wrap the MCP client with x402-mcp only with a caller-controlled local account; never send wallet secrets to AgentResolver.",
          "Before invoking payment_guard or x402_payment_preflight through the payment wrapper, require caller-owned approval of the separate $0.001 Guard fee.",
          "Require the paid Guard result to be eligible and validate its observed target payment terms before separately authorizing the target payment.",
          "If the host needs exact amount/network/asset/payTo/resource enforcement before the Guard signature, use the official @x402/mcp onPaymentRequested gate instead of relying on prompt text."
        ]
      },
      awsBedrockAgentCorePayments: {
        runtime: "Amazon Bedrock AgentCore Payments",
        protocol: "x402",
        paymentGuardUrl: "https://agentresolver.vercel.app/api/payment-guard",
        langGraph: {
          installCommand: "pip install 'bedrock-agentcore[langgraph]'",
          config: "AgentCorePaymentsConfig",
          middleware: "AgentCorePaymentsMiddleware"
        },
        strandsAgents: {
          installCommand: "pip install 'bedrock-agentcore[strands-agents]'",
          config: "AgentCorePaymentsPluginConfig",
          plugin: "AgentCorePaymentsPlugin"
        },
        paymentManager: {
          class: "PaymentManager",
          signedHeaderMethod: "generate_payment_header"
        },
        authorizationModel:
          "Use an AgentCore payment session with a caller-owned payment instrument and deterministic budget. The separate $0.001 AgentResolver Guard fee must fit caller policy; Guard eligibility still does not authorize the target payment.",
        behavior: [
          "Invoke the AgentResolver Guard URL through the AgentCore-managed HTTP path so the runtime receives its standard x402 402 challenge.",
          "Let AgentCore Payments enforce the active session budget, generate payment proof through ProcessPayment, and retry Guard with the signed proof.",
          "Require Guard decision === eligible and verify the observed target amount, asset, network, payTo, scheme and resource binding.",
          "Only then invoke the original target through a separately authorized caller-owned AgentCore payment session or policy.",
          "Never send AgentCore payment-instrument credentials, wallet secrets, connector secrets or signed proof material to AgentResolver outside the standard x402 retry."
        ]
      },
      codingTools: {
        sharedPackages: ["@x402/fetch", "@x402/evm", "viem"],
        paymentWrapper: "wrapFetchWithPayment",
        paymentGuardUrl: "https://agentresolver.vercel.app/api/payment-guard",
        openCode: {
          runtime: "OpenCode",
          integration: "plugin",
          pluginPath: ".opencode/plugins/x402-payment.ts",
          toolName: "x402-fetch",
          trigger: "Use after the built-in webfetch receives HTTP 402.",
          behavior: [
            "Keep the wallet credential inside the caller-controlled OpenCode host; never send it to AgentResolver.",
            "On a target 402, first call AgentResolver Guard for the exact target URL and expose Guard's separate $0.001 requirement to caller policy.",
            "Only after caller policy authorizes the Guard fee, retry Guard through wrapFetchWithPayment and require decision === eligible.",
            "Then require separate caller authorization before retrying the original target through x402-fetch."
          ]
        },
        claudeCode: {
          runtime: "Claude Code",
          integration: "PostToolUse hook",
          hookEvent: "PostToolUse",
          matcher: "WebFetch",
          scriptPath: ".claude/scripts/handle-x402.mjs",
          behavior: [
            "Inspect the WebFetch result for HTTP 402 without creating a payment first.",
            "Keep the wallet credential inside the caller-controlled Claude Code hook process; never send it to AgentResolver.",
            "Before retrying the target, call AgentResolver Guard for that URL and require caller authorization of the separate $0.001 Guard fee.",
            "Require Guard decision === eligible, then require separate caller authorization before the hook retries the original target with x402 payment."
          ]
        },
        authorizationModel:
          "A coding-tool hook or plugin must not turn every 402 into an automatic spend. Guard has its own separately authorized $0.001 fee, and an eligible Guard result is evidence rather than authorization for the target payment."
      },
      cloudflareAgents: {
        runtime: "Cloudflare Agents",
        package: "agents",
        x402ClientImport: "agents/x402",
        wrapper: "withX402Client",
        confirmationCallback: "requestPaymentConfirmation",
        confirmationResolver: "resolvePayment",
        mcpUrl: "https://agentresolver.vercel.app/mcp",
        guardTool: "payment_guard",
        authorizationModel:
          "Use the payment confirmation callback as a caller-owned authorization boundary. Resolve true only after the host has approved the Guard fee and verified the pending payment requirement; never auto-confirm an unfamiliar payment.",
        behavior: [
          "Connect the Cloudflare Agents x402 MCP client to https://agentresolver.vercel.app/mcp.",
          "Call payment_guard for the target endpoint and route the resulting paid request through the runtime's payment confirmation callback.",
          "Fail closed unless the host policy permits the separate $0.001 Guard fee and the pending requirement matches the expected Guard tool/payment context.",
          "After Guard returns eligible, require separate caller authorization before paying the original target.",
          "If the runtime cannot expose enough pending-payment detail for exact requirement checks, use the official @x402/mcp onPaymentRequested gate rather than auto-confirming."
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
      coinbaseAgentKit: "https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/README.md",
      x402Trinity: "https://github.com/devmster/x402-trinity",
      vercelAiSdkX402Mcp: "https://vercel.com/blog/introducing-x402-mcp-open-protocol-payments-for-mcp-tools",
      cloudflareAgentsX402Mcp: "https://github.com/cloudflare/agents/blob/main/examples/x402-mcp/README.md",
      cloudflareCodingToolsX402: "https://developers.cloudflare.com/agents/tools/payments/x402/pay-with-tool-plugins/",
      awsAgentCorePaymentsFrameworks: "https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments-framework-integrations.html",
      awsAgentCorePaymentsProcess: "https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments-process-payment.html"
    }
  } as const;
}

export function x402BuyerSetupHint(capabilityId: string) {
  const handoff = x402ChallengeBuyerHandoff(capabilityId);
  return {
    ...handoff,
    type: "agentresolver_x402_buyer_setup",
    url: X402_BUYER_SETUP_URL,
    attributedUrl: handoff.setup,
    agentSkillsIndex: AGENT_SKILLS_INDEX_URL,
    paymentGuardSkill: PAYMENT_GUARD_SKILL_URL,
    paymentAuthorizationRequired: true,
    message: "This host reached a valid x402 challenge but must use an x402-aware client plus its own signer and spend policy to make an authorized retry. For target x402 purchases, run AgentResolver Guard before each autonomous spend. AgentResolver never requests wallet secrets or authorizes spend."
  } as const;
}
