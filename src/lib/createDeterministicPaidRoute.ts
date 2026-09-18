import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { BatchFacilitatorClient, GatewayEvmScheme } from "@circle-fin/x402-batching/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { logPaidCapabilityAttempt, logPaidRetryRejection, logX402Settlement } from "@/lib/telemetry";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { x402WireResourceMetadata } from "@/lib/x402WireResourceMetadata";
import { x402RuntimeDiscoveryInput, x402RuntimeDiscoveryOutput } from "@/lib/x402RuntimeDiscovery";
import { AGENT_SKILLS_INDEX_URL, PAYMENT_GUARD_SKILL_URL, x402BuyerSetupChallengeError, x402BuyerSetupChallengeUrl, x402ChallengeBuyerHandoff } from "@/lib/x402BuyerSetup";
import { X402_FACILITATOR_URL, X402_NETWORK, X402_PAY_TO, X402_SOLANA_NETWORK, X402_SOLANA_PAY_TO } from "@/lib/x402Config";
import { classifyTraffic, trafficLogFields } from "@/lib/trafficClassification";
import {
  buildExecutionEvidence,
  executionEvidenceHeaders,
  VERIFIED_SETTLEMENT_HISTORY_URL
} from "@/lib/executionEvidence";

type JsonObject = Record<string, unknown>;
type Execute = (request: NextRequest) => Promise<JsonObject> | JsonObject;
type PaidHandler = (request: NextRequest) => Promise<NextResponse<unknown>>;

function decodePaymentRequiredHeader(value: string | null): JsonObject | null {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as JsonObject
      : null;
  } catch {
    return null;
  }
}

async function mirrorPaymentChallengeBody(response: NextResponse<unknown>, capabilityId: PaidCapabilityId) {
  if (response.status !== 402) return response;
  const headerChallenge = decodePaymentRequiredHeader(response.headers.get("payment-required"));
  if (!headerChallenge) return response;

  let current: unknown = null;
  try {
    current = await response.clone().json();
  } catch {
    current = null;
  }

  const bodyChallenge =
    current &&
    typeof current === "object" &&
    !Array.isArray(current) &&
    "x402Version" in current &&
    "accepts" in current
      ? current as JsonObject
      : headerChallenge;

  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new NextResponse(JSON.stringify({
    ...bodyChallenge,
    error: x402BuyerSetupChallengeError(capabilityId),
    buyerSetup: x402ChallengeBuyerHandoff(capabilityId)
  }), {
    status: 402,
    statusText: response.statusText,
    headers
  });
}

export function circleGatewayEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED === "1";
}

export function cdpFacilitatorEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.AGENTRESOLVER_CDP_FACILITATOR_ENABLED === "1";
}

export function cdpFacilitatorCapabilities(
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const configured = env.AGENTRESOLVER_CDP_FACILITATOR_CAPABILITIES?.trim();
  const raw = configured || "x402-ping";
  return new Set(raw.split(",").map((value) => value.trim()).filter(Boolean));
}

export function cdpFacilitatorEnabledFor(
  capabilityId: PaidCapabilityId,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  return cdpFacilitatorEnabled(env) && cdpFacilitatorCapabilities(env).has(capabilityId);
}

export function cdpFacilitatorCredentialsPresent(
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  return Boolean(env.CDP_API_KEY_ID?.trim() && env.CDP_API_KEY_SECRET?.trim());
}

function isCaip2Network(value: string): value is `${string}:${string}` {
  const separator = value.indexOf(":");
  return separator > 0 && separator < value.length - 1;
}

function stampInfrastructureHeaders(
  response: NextResponse<unknown>,
  capabilityId: PaidCapabilityId,
  requestId: string
) {
  response.headers.set("access-control-allow-origin", "*");
  response.headers.set("x-agentresolver-capability", capabilityId);
  response.headers.set("x-agentresolver-request-id", requestId);
  response.headers.set("x-agentresolver-contract-version", "1");
  response.headers.set("x-agentresolver-buyer-setup", x402BuyerSetupChallengeUrl(capabilityId));
  response.headers.set("x-agentresolver-agent-skills", AGENT_SKILLS_INDEX_URL);
  response.headers.set("x-agentresolver-payment-guard-skill", PAYMENT_GUARD_SKILL_URL);
  response.headers.set(
    "x-agentresolver-payment-guard",
    "https://agentresolver.vercel.app/api/payment-guard"
  );
  response.headers.set(
    "x-agentresolver-trust",
    "https://agentresolver.vercel.app/.well-known/agentresolver-trust.json"
  );
  response.headers.set(
    "x-agentresolver-evidence",
    "https://agentresolver.vercel.app/.well-known/agentresolver-evidence.json"
  );
  response.headers.set("x-agentresolver-history", VERIFIED_SETTLEMENT_HISTORY_URL);
  response.headers.set(
    "access-control-expose-headers",
    [
      "payment-required",
      "payment-response",
      "x-agentresolver-capability",
      "x-agentresolver-request-id",
      "x-agentresolver-contract-version",
      "x-agentresolver-buyer-setup",
      "x-agentresolver-agent-skills",
      "x-agentresolver-payment-guard-skill",
      "x-agentresolver-payment-guard",
      "x-agentresolver-trust",
      "x-agentresolver-evidence",
      "x-agentresolver-history",
      "x-agentresolver-execution-id",
      "x-agentresolver-response-sha256",
      "x-agentresolver-evidence-version",
      "x-agentresolver-deployment",
      "link"
    ].join(", ")
  );
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (commitSha) response.headers.set("x-agentresolver-deployment", commitSha);
  return response;
}

export type DeterministicPaidRouteOptions = Readonly<{
  paidGet?: boolean;
  endpoint?: string;
}>;

export function x402BazaarProviderMetadata(capabilityId: PaidCapabilityId) {
  if (capabilityId === "x402-payment-preflight") {
    return {
      serviceName: "AgentResolver Guard",
      tags: ["x402", "preflight", "payment-safety", "agent-payments"]
    } as const;
  }
  if (capabilityId === "x402-ping") {
    return {
      serviceName: "AgentResolver",
      tags: ["x402", "settlement-test", "payment-canary", "agent-payments"]
    } as const;
  }
  return {
    serviceName: "AgentResolver",
    tags: ["x402", "agent-tools"]
  } as const;
}

export function createDeterministicPaidRoute(
  capabilityId: PaidCapabilityId,
  execute: Execute,
  options: DeterministicPaidRouteOptions = {}
) {
  const product = getPaidCapability(capabilityId);
  const endpoint = options.endpoint?.trim() || product.endpoint;
  if (!endpoint.startsWith("/api/")) {
    throw new Error("Paid route endpoint override must start with /api/.");
  }
  const wireMetadata = x402WireResourceMetadata(product);
  let paidHandlerPromise: Promise<PaidHandler> | null = null;

  async function handler(req: NextRequest): Promise<NextResponse<unknown>> {
    try {
      const result = await execute(req);
      const responseBody = JSON.stringify(result);
      const executionEvidence = buildExecutionEvidence(responseBody, capabilityId);
      console.log(JSON.stringify({
        event: "paid_capability_completed",
        capabilityId,
        surface: "http",
        at: executionEvidence.completedAt,
        executionId: executionEvidence.executionId,
        responseSha256: executionEvidence.responseSha256,
        deploymentCommitSha: executionEvidence.deploymentCommitSha
      }));
      return new NextResponse(responseBody, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
          ...executionEvidenceHeaders(executionEvidence)
        }
      });
    } catch (error) {
      return NextResponse.json({
        error: "INVALID_INPUT",
        message: error instanceof Error ? error.message : "Invalid input."
      }, { status: 400 });
    }
  }

  async function buildPaidHandler(): Promise<PaidHandler> {
    const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
    const solanaPayTo = (process.env.AGENTRESOLVER_SOLANA_PAY_TO || X402_SOLANA_PAY_TO).trim();
    const facilitatorUrl = (process.env.AGENTRESOLVER_X402_FACILITATOR_URL || X402_FACILITATOR_URL).trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) throw new Error("AGENTRESOLVER_PAY_TO is invalid.");
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solanaPayTo)) throw new Error("AGENTRESOLVER_SOLANA_PAY_TO is invalid.");
    if (!/^https:\/\//i.test(facilitatorUrl)) throw new Error("AGENTRESOLVER_X402_FACILITATOR_URL is invalid.");

    const standardFacilitator = new HTTPFacilitatorClient({ url: facilitatorUrl, timeoutMs: 10_000 });
    const gatewayEnabled = circleGatewayEnabled();
    const cdpEnabled = cdpFacilitatorEnabledFor(capabilityId);
    if (cdpEnabled && !cdpFacilitatorCredentialsPresent()) {
      throw new Error(
        "AGENTRESOLVER_CDP_FACILITATOR_ENABLED requires CDP_API_KEY_ID and CDP_API_KEY_SECRET."
      );
    }
    const cdpFacilitator = cdpEnabled
      ? (await import("@coinbase/cdp-sdk/x402")).createCdpFacilitatorClient()
      : null;
    const primaryFacilitator = cdpFacilitator ?? standardFacilitator;

    type CurrentPaymentPayload = Parameters<HTTPFacilitatorClient["verify"]>[0];
    type CurrentPaymentRequirements = Parameters<HTTPFacilitatorClient["verify"]>[1];

    const circleClient = gatewayEnabled ? new BatchFacilitatorClient() : null;
    const circleFacilitator = circleClient ? {
      verify: async (paymentPayload: CurrentPaymentPayload, paymentRequirements: CurrentPaymentRequirements) => {
        const resource = paymentPayload.resource;
        const normalizedPayload = {
          ...paymentPayload,
          resource: resource ? {
            url: resource.url,
            description: resource.description ?? wireMetadata.description,
            mimeType: resource.mimeType ?? "application/json"
          } : undefined
        };
        return circleClient.verify(normalizedPayload, paymentRequirements);
      },
      settle: async (paymentPayload: CurrentPaymentPayload, paymentRequirements: CurrentPaymentRequirements) => {
        const resource = paymentPayload.resource;
        const normalizedPayload = {
          ...paymentPayload,
          resource: resource ? {
            url: resource.url,
            description: resource.description ?? wireMetadata.description,
            mimeType: resource.mimeType ?? "application/json"
          } : undefined
        };
        const result = await circleClient.settle(normalizedPayload, paymentRequirements);
        if (!isCaip2Network(result.network)) {
          throw new Error("Circle Gateway returned a non-CAIP-2 settlement network.");
        }
        return {
          ...result,
          network: result.network
        };
      },
      getSupported: async () => {
        const supported = await circleClient.getSupported();
        return {
          ...supported,
          kinds: supported.kinds.map((kind) => {
            if (!isCaip2Network(kind.network)) {
              throw new Error("Circle Gateway returned a non-CAIP-2 supported network.");
            }
            return {
              ...kind,
              network: kind.network
            };
          })
        };
      }
    } : null;

    const server = circleFacilitator
      ? new x402ResourceServer([primaryFacilitator, circleFacilitator])
      : new x402ResourceServer(primaryFacilitator);

    if (gatewayEnabled) {
      server.register("eip155:*", new GatewayEvmScheme());
    } else {
      server.register(X402_NETWORK, new ExactEvmScheme());
    }

    server
      .register(X402_SOLANA_NETWORK, new ExactSvmScheme())
      .registerExtension(bazaarResourceServerExtension);

    if (gatewayEnabled || cdpEnabled) {
      await server.initialize();
    }

    if (cdpEnabled) {
      console.log(JSON.stringify({
        event: "cdp_facilitator_payment_rail_ready",
        at: new Date().toISOString(),
        capabilityId,
        facilitator: "coinbase-cdp",
        bazaarDiscoveryEligible: true
      }));
    }

    if (gatewayEnabled) {
      console.log(JSON.stringify({
        event: "circle_gateway_payment_rail_ready",
        at: new Date().toISOString(),
        capabilityId,
        standardFacilitator: facilitatorUrl,
        gateway: "circle",
        evmNetworkPattern: "eip155:*"
      }));
    }

    const discoveryOutput = x402RuntimeDiscoveryOutput(capabilityId);
    const bazaarProviderMetadata = x402BazaarProviderMetadata(capabilityId);
    const runtimeGetInput = options.paidGet
      ? x402RuntimeDiscoveryInput(capabilityId)
      : null;

    const discoveryExtension = options.paidGet
      ? runtimeGetInput
        ? declareDiscoveryExtension({
            input: runtimeGetInput.example,
            inputSchema: runtimeGetInput.schema,
            output: discoveryOutput
          })
        : declareDiscoveryExtension({
            output: discoveryOutput
          })
      : declareDiscoveryExtension({
          input: product.example,
          inputSchema: product.inputSchema,
          bodyType: "json",
          output: discoveryOutput
        });

    return withX402<unknown>(handler, {
      [endpoint]: {
        accepts: [
          {
            scheme: "exact",
            price: product.price,
            network: X402_NETWORK,
            payTo: payTo as `0x${string}`
          },
          {
            scheme: "exact",
            price: product.price,
            network: X402_SOLANA_NETWORK,
            payTo: solanaPayTo
          }
        ],
        description: wireMetadata.description,
        mimeType: "application/json",
        serviceName: bazaarProviderMetadata.serviceName,
        tags: [...bazaarProviderMetadata.tags],
        extensions: {
          ...discoveryExtension
        }
      }
    }, server) as PaidHandler;
  }

  function getPaidHandler(): Promise<PaidHandler> {
    if (!paidHandlerPromise) paidHandlerPromise = buildPaidHandler();
    return paidHandlerPromise;
  }

  async function runPaidRequest(req: NextRequest) {
    const requestId = randomUUID();
    const traffic = classifyTraffic(req, { path: endpoint });
    logPaidCapabilityAttempt(req, capabilityId, traffic, requestId);
    try {
      const paidHandler = await getPaidHandler();
      const response = stampInfrastructureHeaders(await paidHandler(req), capabilityId, requestId);
      await logPaidRetryRejection(req, response, capabilityId, requestId);
      const compatibleResponse = await mirrorPaymentChallengeBody(response, capabilityId);
      logX402Settlement(compatibleResponse, capabilityId, requestId);
      return compatibleResponse;
    } catch (error) {
      console.error(JSON.stringify({
        event: "paid_capability_configuration_error",
        capabilityId,
        at: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Unknown error"
      }));
      return stampInfrastructureHeaders(
        NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED" }, { status: 503 }),
        capabilityId,
        requestId
      );
    }
  }

  async function runDiscoveryRequest(req: NextRequest) {
    const requestId = randomUUID();
    const traffic = classifyTraffic(req, { path: endpoint, isDiscovery: true });
    console.log(JSON.stringify({
      event: "paid_capability_discovery",
      at: new Date().toISOString(),
      capabilityId,
      requestId,
      ...trafficLogFields(req, traffic)
    }));
    return stampInfrastructureHeaders(
      x402DiscoveryChallenge(capabilityId, { endpoint }),
      capabilityId,
      requestId
    );
  }

  return {
    POST: runPaidRequest,
    GET: options.paidGet ? runPaidRequest : runDiscoveryRequest,
    OPTIONS: async () => new NextResponse(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, payment-signature, payment-required, payment-response"
      }
    })
  };
}
