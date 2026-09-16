export const AGENTRESOLVER_TRUST_CONTRACT = {
  schemaVersion: 1,
  service: "AgentResolver",
  canonicalOrigin: "https://agentresolver.vercel.app",
  role: "non-custodial x402 verify-before-pay infrastructure",
  canonicalPaidRoute: {
    method: "POST",
    operationId: "x402PaymentPreflightPayToVerification",
    url: "https://agentresolver.vercel.app/api/x402-payment-preflight",
    priceUsd: 0.001,
    asset: "USDC",
    purpose: "Verify a live x402 payment challenge before an autonomous agent authorizes spend."
  },
  paymentModel: {
    custodial: false,
    holdsCustomerBalances: false,
    escrow: false,
    forwardsThirdPartyPrincipalPayments: false,
    callerControlsAuthorization: true,
    revenueModel: "AgentResolver is paid directly for AgentResolver-owned digital verification services."
  },
  optionalPaymentRails: {
    circleGatewayNanopayments: {
      enabled: process.env.AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED === "1",
      defaultEnabled: false,
      scope: "AgentResolver-owned service payments only",
      buyerAuthorizationRequired: true,
      holdsBuyerFunds: false,
      note: "Optional gas-free EVM nanopayment rail; standard PayAI/Base and Solana x402 remain available."
    }
  },
  supportedSettlement: [
    {
      network: "eip155:8453",
      chain: "Base",
      asset: "USDC",
      assetContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
    },
    {
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      chain: "Solana",
      asset: "USDC",
      assetContract: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      payTo: "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa"
    }
  ],
  trustBoundaries: {
    observationIsPointInTime: true,
    noSafetyGuarantee: true,
    noThirdPartyEndorsement: true,
    buyerMustApplyOwnBudgetAndAuthorizationPolicy: true,
    privateNetworkTargetsBlocked: true
  },
  probeSafety: {
    httpsOnly: true,
    credentialsInTargetUrlBlocked: true,
    customPortsBlocked: true,
    privateAndReservedIpRangesBlocked: true,
    dnsResolvedBeforeConnect: true,
    anyPrivateDnsAnswerRejectsTarget: true,
    redirectsFollowed: false,
    defaultTimeoutMs: 4500,
    postProbeRequiresExplicitOptIn: true,
    maxPostBodyBytes: 65536,
    responseBodyConsumed: false
  },
  evidenceModel: {
    receiptVersion: 1,
    source: "live_endpoint_observation",
    paymentIdentityBasis: "network + asset + observed payTo",
    stableFingerprints: true,
    walletOwnershipVerified: false,
    providerLegitimacyVerified: false,
    futureFulfillmentVerified: false,
    purpose: "Change detection and reusable technical evidence across endpoint observations.",
    erc8004Ready: true,
    erc8004Submission: "none",
    erc8004IdentityBindingRequiredBeforeFeedback: true
  },
  evidence: {
    health: "https://agentresolver.vercel.app/api/health",
    openapi: "https://agentresolver.vercel.app/openapi.json",
    x402Manifest: "https://agentresolver.vercel.app/.well-known/x402",
    agentManifest: "https://agentresolver.vercel.app/.well-known/agent.json",
    legal: "https://agentresolver.vercel.app/legal",
    securityDisclosure: "https://agentresolver.vercel.app/.well-known/security.txt",
    sourceCode: "https://github.com/waxsway/agentresolver",
    trustAuditHistory: "https://github.com/waxsway/agentresolver/actions/workflows/trust-surface-audit.yml"
  },
  telemetry: {
    rawPrivateKeysCollected: false,
    rawWalletSecretsCollected: false,
    applicationTelemetry: [
      "one-way shortened caller hash",
      "user-agent",
      "referrer hostname",
      "capability identifier",
      "payment-signature presence",
      "hashed settlement identifiers"
    ]
  }
} as const;
