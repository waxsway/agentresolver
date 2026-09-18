import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_SKILLS_INDEX_URL,
  PAYMENT_GUARD_SKILL_URL,
  X402_BUYER_SETUP_URL,
  x402BuyerSetupChallengeError,
  x402BuyerSetupChallengeUrl,
  x402ChallengeBuyerHandoff,
  x402BuyerSetup,
  x402BuyerSetupHint
} from "../src/lib/x402BuyerSetup";

test("buyer setup is free, machine-readable and non-custodial", () => {
  const setup = x402BuyerSetup();
  assert.equal(setup.schemaVersion, 2);
  assert.equal(setup.free, true);
  assert.equal(setup.payment.protocol, "x402");
  assert.equal(setup.payment.version, 2);
  assert.equal(setup.payment.challengeHeader, "PAYMENT-REQUIRED");
  assert.equal(setup.payment.retryHeader, "PAYMENT-SIGNATURE");
  assert.equal(setup.payment.paymentIsAuthorizedByAgentResolver, false);
  assert.equal(setup.agentResolver.agentSkillsIndex, AGENT_SKILLS_INDEX_URL);
  assert.equal(setup.agentResolver.paymentGuardSkill, PAYMENT_GUARD_SKILL_URL);
  assert.equal(
    setup.agentResolver.canonicalPreflight,
    "https://agentresolver.vercel.app/api/x402-payment-preflight"
  );
  assert.equal(
    setup.agentResolver.paymentGuard,
    "https://agentresolver.vercel.app/api/payment-guard"
  );
  assert.equal(setup.agentResolver.paymentGuardRequest.method, "GET");
  assert.equal(setup.agentResolver.paymentGuardRequest.priceUsd, 0.001);
  assert.deepEqual(setup.agentResolver.paymentGuardRequest.requiredQuery, ["url"]);
  assert.ok(setup.agentResolver.paymentGuardRequest.optionalQuery.includes("expectedPayTo"));
  assert.equal(
    setup.agentResolver.paymentGuardRequest.repeatUse,
    "before_each_autonomous_x402_spend"
  );
  assert.ok(setup.recommendedSpendLoop.some((step) => /before each autonomous spend/i.test(step)));
  assert.equal(setup.authorizationBoundary.callerControlsSigner, true);
  assert.equal(setup.authorizationBoundary.callerControlsSpendPolicy, true);
  assert.equal(setup.authorizationBoundary.agentResolverReceivesPrivateKey, false);
  assert.equal(setup.authorizationBoundary.agentResolverReceivesSeedPhrase, false);
  assert.equal(setup.authorizationBoundary.agentResolverAuthorizesSpend, false);
  assert.equal(setup.agentSkill.discoveryIndex, AGENT_SKILLS_INDEX_URL);
  assert.equal(setup.agentSkill.url, PAYMENT_GUARD_SKILL_URL);
  assert.equal(
    setup.agentSkill.installCommand,
    "npx skills add waxsway/agentresolver --skill agentresolver-payment-guard"
  );
  assert.equal(
    setup.agentSkill.wellKnownInstallCommand,
    "npx skills add https://agentresolver.vercel.app --skill agentresolver-payment-guard"
  );
  assert.equal(setup.agentSkill.repository, "waxsway/agentresolver");
  assert.equal(setup.clients.mcp.typescript.package, "@x402/mcp");
  assert.equal(setup.clients.mcp.typescript.factory, "createx402MCPClient");
  assert.match(setup.clients.mcp.typescript.installCommand, /@x402\/mcp/);
  assert.ok(
    setup.clients.mcp.typescript.baseEvmQuickstart.some((line) =>
      line.includes("client: new ExactEvmScheme(callerOwnedSigner)")
    )
  );
  assert.ok(
    setup.clients.mcp.typescript.baseEvmQuickstart.some((line) =>
      line.includes('version: "1.0.0"')
    )
  );
  assert.equal(
    setup.clients.mcp.typescript.configurationShape.schemes[0].client,
    "new ExactEvmScheme(callerOwnedSigner)"
  );
  assert.equal(setup.clients.mcp.typescript.preSignGuardAuthorization.hook, "onPaymentRequested");
  assert.equal(setup.clients.mcp.typescript.preSignGuardAuthorization.stage, "before_wallet_signature");
  assert.deepEqual(
    setup.clients.mcp.typescript.preSignGuardAuthorization.toolNames,
    ["payment_guard", "x402_payment_preflight"]
  );
  assert.deepEqual(
    setup.clients.mcp.typescript.preSignGuardAuthorization.toolResources,
    {
      payment_guard: "mcp://tool/payment_guard",
      x402_payment_preflight: "mcp://tool/x402_payment_preflight"
    }
  );
  assert.equal(setup.clients.mcp.typescript.preSignGuardAuthorization.priceUsd, 0.001);
  assert.equal(setup.clients.mcp.typescript.preSignGuardAuthorization.expectedAtomicUsdc, "1000");
  assert.ok(
    setup.clients.mcp.typescript.preSignGuardAuthorization.allowedNetworks.includes("eip155:8453")
  );
  assert.deepEqual(
    setup.clients.mcp.typescript.preSignGuardAuthorization.expectedRequirements,
    [
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
    ]
  );
  assert.match(
    setup.clients.mcp.typescript.preSignGuardAuthorization.rule,
    /caller-owned spend policy/i
  );
  const approvalExample =
    setup.clients.mcp.typescript.preSignGuardAuthorization.approvalHookExample.join("\n");
  assert.match(approvalExample, /hostAllowsGuardSpend/);
  assert.match(approvalExample, /context\.toolName/);
  assert.match(approvalExample, /mcp:\/\/tool\/payment_guard/);
  assert.match(approvalExample, /expectedResource/);
  assert.match(approvalExample, /paymentRequired\.x402Version !== 2/);
  assert.match(approvalExample, /paymentRequired\.resource\.url/);
  assert.match(approvalExample, /requirement\.scheme === "exact"/);
  assert.match(approvalExample, /requirement\.amount === "1000"/);
  assert.match(approvalExample, /requirement\.network === expected\.network/);
  assert.match(approvalExample, /samePaymentIdentifier/);
  assert.match(approvalExample, /network\.startsWith\("eip155:"\)/);
  assert.match(approvalExample, /actual === expected/);
  assert.doesNotMatch(approvalExample, /requirement\.asset\.toLowerCase\(\)/);
  assert.doesNotMatch(approvalExample, /requirement\.payTo\.toLowerCase\(\)/);
  assert.ok(
    setup.clients.mcp.behavior.some((step) => /onPaymentRequested/i.test(step))
  );
  assert.equal(setup.clients.http.typescript.package, "@x402/fetch");
  assert.ok(setup.clients.http.typescript.packages.includes("@x402/fetch"));
  assert.ok(setup.clients.http.typescript.packages.includes("@x402/core"));
  assert.equal(setup.clients.http.typescript.client, "x402Client");
  assert.equal(setup.clients.http.typescript.wrapper, "wrapFetchWithPayment");
  assert.match(setup.clients.http.typescript.installCommand, /@x402\/fetch/);
  assert.ok(
    setup.clients.http.typescript.baseEvmQuickstart.some((line) =>
      line.includes('x402Client, wrapFetchWithPayment')
    )
  );
  assert.ok(
    setup.clients.http.typescript.baseEvmQuickstart.some((line) =>
      line.includes("registerExactEvmScheme")
    )
  );
  assert.ok(
    setup.clients.http.typescript.baseEvmQuickstart.some((line) =>
      line.includes("callerOwnedSigner")
    )
  );
  assert.equal(setup.clients.http.axios.package, "@x402/axios");
  assert.equal(setup.clients.http.axios.wrapper, "wrapAxiosWithPayment");
  assert.equal(setup.clients.http.axios.client, "x402Client");
  assert.match(setup.clients.http.axios.installCommand, /@x402\/axios/);
  assert.ok(
    setup.clients.http.axios.baseEvmQuickstart.some((line) =>
      line.includes("wrapAxiosWithPayment")
    )
  );
  assert.ok(
    setup.clients.http.axios.baseEvmQuickstart.some((line) =>
      line.includes("callerOwnedSigner")
    )
  );
  assert.match(setup.clients.http.axios.authorizationRule, /caller-owned policy/i);
  assert.equal(
    setup.clients.http.typescript.preSignGuardAuthorization.mechanism,
    "paymentRequirementsSelector"
  );
  assert.equal(
    setup.clients.http.typescript.preSignGuardAuthorization.stage,
    "after_402_before_payment_payload_creation"
  );
  assert.equal(
    setup.clients.http.typescript.preSignGuardAuthorization.guardUrl,
    "https://agentresolver.vercel.app/api/payment-guard"
  );
  assert.equal(
    setup.clients.http.typescript.preSignGuardAuthorization.expectedRequirements[0].amount,
    "1000"
  );
  assert.equal(
    setup.clients.http.axios.preSignGuardAuthorization.mechanism,
    "paymentRequirementsSelector"
  );
  assert.match(
    setup.clients.http.axios.preSignGuardAuthorization.rule,
    /reject every unmatched requirement/i
  );
  assert.equal(
    setup.clients.http.python.preSignGuardAuthorization.hook,
    "on_before_payment_creation"
  );
  assert.equal(
    setup.clients.http.python.preSignGuardAuthorization.abortType,
    "AbortResult"
  );
  assert.ok(
    setup.clients.http.python.preSignGuardAuthorization.mechanisms.includes("client_policies")
  );
  assert.match(
    setup.clients.http.python.preSignGuardAuthorization.rule,
    /before a payment payload is created/i
  );
  assert.equal(setup.clients.http.python.package, "x402");
  assert.equal(setup.clients.http.python.client, "x402HttpxClient");
  assert.match(setup.clients.http.python.installCommand, /pip install x402/);
  assert.ok(
    setup.clients.http.python.baseEvmQuickstart.some((line) =>
      line.includes("register_exact_evm_client")
    )
  );
  assert.ok(
    setup.clients.http.python.baseEvmQuickstart.some((line) =>
      line.includes("x402HttpxClient")
    )
  );
  assert.ok(
    setup.clients.http.python.baseEvmQuickstart.some((line) =>
      line.includes("caller_owned_account")
    )
  );
  const quickstartText = [
    ...setup.clients.http.typescript.baseEvmQuickstart,
    ...setup.clients.http.axios.baseEvmQuickstart,
    ...setup.clients.http.python.baseEvmQuickstart,
    ...setup.clients.mcp.typescript.baseEvmQuickstart
  ].join("\n");
  assert.doesNotMatch(quickstartText, /privateKeyToAccount|seed phrase|0xYourPrivateKey/i);
});

test("buyer setup hint points to the canonical free handoff", () => {
  const hint = x402BuyerSetupHint("x402-payment-preflight");
  assert.equal(hint.url, X402_BUYER_SETUP_URL);
  assert.equal(hint.attributedUrl, x402BuyerSetupChallengeUrl("x402-payment-preflight"));
  assert.equal(hint.agentSkillsIndex, AGENT_SKILLS_INDEX_URL);
  assert.equal(hint.paymentGuardSkill, PAYMENT_GUARD_SKILL_URL);
  assert.equal(hint.paymentAuthorizationRequired, true);
  assert.equal(hint.signerControlledByCaller, true);
});


test("Coinbase AgentKit exposes a confirmation-first Guard loop", () => {
  const setup = x402BuyerSetup();
  const agentkit = setup.clients.coinbaseAgentKit;
  assert.equal(agentkit.package, "@coinbase/agentkit");
  assert.equal(agentkit.x402Actions.discover, "discover_x402_services");
  assert.equal(agentkit.x402Actions.listApprovedServices, "list_registered_services");
  assert.equal(agentkit.x402Actions.approveService, "register_x402_service");
  assert.equal(agentkit.x402Actions.challenge, "make_http_request");
  assert.equal(agentkit.x402Actions.authorizedRetry, "retry_http_request_with_x402");
  assert.equal(agentkit.x402Actions.automaticPayment, "make_http_request_with_x402");
  assert.equal(agentkit.paymentGuardUrl, "https://agentresolver.vercel.app/api/payment-guard");
  assert.equal(agentkit.serviceApproval.defaultDynamicRegistration, false);
  assert.ok(agentkit.serviceApproval.configKeys.includes("registeredServices"));
  assert.ok(agentkit.serviceApproval.configKeys.includes("allowDynamicServiceRegistration"));
  assert.ok(agentkit.behavior.some((step) => /list_registered_services/i.test(step)));
  assert.ok(agentkit.behavior.some((step) => /register_x402_service/i.test(step)));
  assert.ok(agentkit.behavior.some((step) => /Guard spend/i.test(step)));
  assert.ok(agentkit.behavior.some((step) => /separate caller authorization/i.test(step)));
  assert.ok(agentkit.behavior.some((step) => /Do not use make_http_request_with_x402/i.test(step)));
});


test("buyer setup exposes Vercel AI SDK and Cloudflare Agents payment handoffs", () => {
  const setup = x402BuyerSetup();
  const vercel = setup.clients.vercelAiSdkMcp;
  assert.equal(vercel.package, "ai");
  assert.equal(vercel.paymentPackage, "x402-mcp");
  assert.equal(vercel.mcpClientFactory, "experimental_createMCPClient");
  assert.equal(vercel.paymentWrapper, "withPayment");
  assert.equal(vercel.mcpUrl, "https://agentresolver.vercel.app/mcp");
  assert.match(vercel.authorizationModel, /caller policy has approved the exact \$0\.001 Guard fee/i);
  assert.ok(vercel.behavior.some((step) => /@x402\/mcp onPaymentRequested/i.test(step)));

  const cloudflare = setup.clients.cloudflareAgents;
  assert.equal(cloudflare.package, "agents");
  assert.equal(cloudflare.x402ClientImport, "agents/x402");
  assert.equal(cloudflare.wrapper, "withX402Client");
  assert.equal(cloudflare.confirmationCallback, "requestPaymentConfirmation");
  assert.equal(cloudflare.confirmationResolver, "resolvePayment");
  assert.match(cloudflare.authorizationModel, /caller-owned authorization boundary/i);
  assert.ok(cloudflare.behavior.some((step) => /separate caller authorization/i.test(step)));

  const runtimeText = JSON.stringify({ vercel, cloudflare });
  assert.doesNotMatch(runtimeText, /PRIVATE_KEY|seed phrase|0xYourPrivateKey/i);
  assert.equal(
    setup.officialReferences.vercelAiSdkX402Mcp,
    "https://vercel.com/blog/introducing-x402-mcp-open-protocol-payments-for-mcp-tools"
  );
  assert.equal(
    setup.officialReferences.cloudflareAgentsX402Mcp,
    "https://github.com/cloudflare/agents/blob/main/examples/x402-mcp/README.md"
  );
});


test("buyer setup exposes AWS AgentCore wallet-capable payment handoff", () => {
  const setup = x402BuyerSetup();
  const agentcore = setup.clients.awsBedrockAgentCorePayments;
  assert.equal(agentcore.runtime, "Amazon Bedrock AgentCore Payments");
  assert.equal(agentcore.protocol, "x402");
  assert.equal(agentcore.paymentGuardUrl, "https://agentresolver.vercel.app/api/payment-guard");
  assert.match(agentcore.langGraph.installCommand, /bedrock-agentcore\[langgraph\]/);
  assert.equal(agentcore.langGraph.middleware, "AgentCorePaymentsMiddleware");
  assert.match(agentcore.strandsAgents.installCommand, /bedrock-agentcore\[strands-agents\]/);
  assert.equal(agentcore.strandsAgents.plugin, "AgentCorePaymentsPlugin");
  assert.equal(agentcore.paymentManager.class, "PaymentManager");
  assert.equal(agentcore.paymentManager.signedHeaderMethod, "generate_payment_header");
  assert.match(agentcore.authorizationModel, /caller-owned payment instrument/i);
  assert.match(agentcore.authorizationModel, /\$0\.001 AgentResolver Guard fee/i);
  assert.ok(agentcore.behavior.some((step) => /ProcessPayment/i.test(step)));
  assert.ok(agentcore.behavior.some((step) => /separately authorized/i.test(step)));
  assert.doesNotMatch(JSON.stringify(agentcore), /PRIVATE_KEY|seed phrase|wallet secret value/i);
  assert.equal(
    setup.officialReferences.awsAgentCorePaymentsFrameworks,
    "https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments-framework-integrations.html"
  );
  assert.equal(
    setup.officialReferences.awsAgentCorePaymentsProcess,
    "https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments-process-payment.html"
  );
});


test("buyer challenge handoff URLs carry bounded funnel attribution", () => {
  assert.equal(
    x402BuyerSetupChallengeUrl("x402-payment-preflight"),
    "https://agentresolver.vercel.app/api/x402-client-setup?source=x402-challenge&capabilityId=x402-payment-preflight"
  );
  assert.equal(
    x402BuyerSetupChallengeError("x402-ping"),
    "Payment required. x402 buyer setup: https://agentresolver.vercel.app/api/x402-client-setup?source=x402-challenge&capabilityId=x402-ping"
  );
});


test("challenge handoff embeds executable client install choices", () => {
  const handoff = x402ChallengeBuyerHandoff("x402-payment-preflight");
  assert.equal(handoff.type, "agentresolver_x402_buyer_handoff");
  assert.equal(handoff.capabilityId, "x402-payment-preflight");
  assert.equal(
    handoff.setup,
    "https://agentresolver.vercel.app/api/x402-client-setup?source=x402-challenge&capabilityId=x402-payment-preflight"
  );
  assert.equal(handoff.protocol, "x402");
  assert.equal(handoff.retryHeader, "PAYMENT-SIGNATURE");
  assert.equal(handoff.signerControlledByCaller, true);
  assert.equal(handoff.spendAuthorizationRequired, true);
  assert.match(handoff.clientInstalls.httpTypescript, /@x402\/fetch/);
  assert.match(handoff.clientInstalls.mcpTypescript, /@x402\/mcp/);
  assert.equal(handoff.clientInstalls.httpPython, "pip install x402");
  assert.match(handoff.clientInstalls.agentSkill, /skills add waxsway\/agentresolver/);
  assert.equal(handoff.clientEntrypoints.httpTypescript.package, "@x402/fetch");
  assert.equal(handoff.clientEntrypoints.httpTypescript.wrapper, "wrapFetchWithPayment");
  assert.equal(handoff.clientEntrypoints.mcpTypescript.package, "@x402/mcp");
  assert.equal(handoff.clientEntrypoints.mcpTypescript.factory, "createx402MCPClient");
  assert.equal(handoff.clientEntrypoints.httpPython.package, "x402");
  assert.equal(handoff.clientEntrypoints.httpPython.client, "x402HttpxClient");
  assert.equal(handoff.clientInstalls.walletMcp, "npx -y x402-trinity-mcp");
  assert.equal(handoff.clientEntrypoints.walletMcp.package, "x402-trinity");
  assert.equal(handoff.clientEntrypoints.walletMcp.command, "x402-trinity-mcp");
  assert.deepEqual(handoff.clientEntrypoints.walletMcp.tools, ["check_price", "pay_and_fetch", "wallet_status"]);
  assert.equal(handoff.clientEntrypoints.walletMcp.defaultNetwork, "eip155:8453");
  assert.equal(handoff.clientEntrypoints.agentSkill.repository, "waxsway/agentresolver");
  assert.equal(handoff.clientEntrypoints.agentSkill.skill, "agentresolver-payment-guard");
});


test("buyer setup exposes OpenCode and Claude Code x402 handoffs", () => {
  const setup = x402BuyerSetup();
  const coding = setup.clients.codingTools;
  assert.ok(coding.sharedPackages.includes("@x402/fetch"));
  assert.equal(coding.paymentWrapper, "wrapFetchWithPayment");
  assert.equal(coding.paymentGuardUrl, "https://agentresolver.vercel.app/api/payment-guard");

  assert.equal(coding.openCode.runtime, "OpenCode");
  assert.equal(coding.openCode.integration, "plugin");
  assert.equal(coding.openCode.pluginPath, ".opencode/plugins/x402-payment.ts");
  assert.equal(coding.openCode.toolName, "x402-fetch");
  assert.ok(coding.openCode.behavior.some((step) => /Guard fee/i.test(step)));
  assert.ok(coding.openCode.behavior.some((step) => /separate caller authorization/i.test(step)));

  assert.equal(coding.claudeCode.runtime, "Claude Code");
  assert.equal(coding.claudeCode.integration, "PostToolUse hook");
  assert.equal(coding.claudeCode.hookEvent, "PostToolUse");
  assert.equal(coding.claudeCode.matcher, "WebFetch");
  assert.equal(coding.claudeCode.scriptPath, ".claude/scripts/handle-x402.mjs");
  assert.ok(coding.claudeCode.behavior.some((step) => /Guard fee/i.test(step)));
  assert.ok(coding.claudeCode.behavior.some((step) => /separate caller authorization/i.test(step)));

  assert.match(coding.authorizationModel, /must not turn every 402 into an automatic spend/i);
  assert.doesNotMatch(JSON.stringify(coding), /PRIVATE_KEY|seed phrase|0xYourPrivateKey/i);
  assert.equal(
    setup.officialReferences.cloudflareCodingToolsX402,
    "https://developers.cloudflare.com/agents/tools/payments/x402/pay-with-tool-plugins/"
  );
});


test("buyer setup exposes x402-trinity as a hard-budget wallet-capable MCP handoff", () => {
  const setup = x402BuyerSetup();
  const trinity = setup.clients.x402Trinity;

  assert.equal(trinity.package, "x402-trinity");
  assert.equal(trinity.mcpCommand, "npx -y x402-trinity-mcp");
  assert.equal(trinity.defaultNetwork, "eip155:8453");
  assert.equal(trinity.defaultAsset, "USDC");
  assert.equal(trinity.tools.checkPrice, "check_price");
  assert.equal(trinity.tools.payAndFetch, "pay_and_fetch");
  assert.equal(trinity.tools.walletStatus, "wallet_status");
  assert.match(trinity.authorizationModel, /hard spend limits inside the caller-controlled/i);
  assert.match(trinity.authorizationModel, /Guard eligibility as evidence rather than target-payment authorization/i);
  assert.ok(trinity.behavior.some((step) => /check_price/i.test(step)));
  assert.ok(trinity.behavior.some((step) => /separate caller-authorized pay_and_fetch/i.test(step)));
  assert.ok(trinity.behavior.some((step) => /never send them to AgentResolver/i.test(step)));
  assert.equal(setup.officialReferences.x402Trinity, "https://github.com/devmster/x402-trinity");
  assert.doesNotMatch(JSON.stringify(trinity), /0x[a-fA-F0-9]{64}|seed phrase/i);
});
