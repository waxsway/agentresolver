import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { BatchFacilitatorClient, GatewayEvmScheme } from "@circle-fin/x402-batching/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { logPaidCapabilityAttempt, logX402Settlement } from "@/lib/telemetry";
import { x402DiscoveryChallenge } from "@/lib/x402DiscoveryChallenge";
import { x402WireResourceMetadata } from "@/lib/x402WireResourceMetadata";
import { X402_PREFLIGHT_OUTPUT_EXAMPLE, X402_PREFLIGHT_OUTPUT_SCHEMA } from "@/lib/x402PreflightDiscovery";
import { X402_PING_OUTPUT_EXAMPLE, X402_PING_OUTPUT_SCHEMA } from "@/lib/x402PingDiscovery";
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

async function mirrorPaymentChallengeBody(response: NextResponse<unknown>) {
  if (response.status !== 402) return response;
  const challenge = decodePaymentRequiredHeader(response.headers.get("payment-required"));
  if (!challenge) return response;

  let current: unknown = null;
  try {
    current = await response.clone().json();
  } catch {
    current = null;
  }

  const alreadyMirrored =
    current &&
    typeof current === "object" &&
    !Array.isArray(current) &&
    "x402Version" in current &&
    "accepts" in current;

  if (alreadyMirrored) return response;

  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new NextResponse(JSON.stringify(challenge), {
    status: 402,
    statusText: response.statusText,
    headers
  });
}

export function circleGatewayEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  return env.AGENTRESOLVER_CIRCLE_GATEWAY_ENABLED === "1";
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
      "x-agentresolver-trust",
      "x-agentresolver-evidence",
      "x-agentresolver-history",
      "x-agentresolver-execution-id",
      "x-agentresolver-response-sha256",
      "x-agentresolver-evidence-version",
      "x-agentresolver-deployment"
    ].join(", ")
  );
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (commitSha) response.headers.set("x-agentresolver-deployment", commitSha);
  return response;
}

export type DeterministicPaidRouteOptions = Readonly<{ paidGet?: boolean }>;

export function createDeterministicPaidRoute(
  capabilityId: PaidCapabilityId,
  execute: Execute,
  options: DeterministicPaidRouteOptions = {}
) {
  const product = getPaidCapability(capabilityId);
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
      ? new x402ResourceServer([standardFacilitator, circleFacilitator])
      : new x402ResourceServer(standardFacilitator);

    if (gatewayEnabled) {
      server.register("eip155:*", new GatewayEvmScheme());
    } else {
      server.register(X402_NETWORK, new ExactEvmScheme());
    }

    server
      .register(X402_SOLANA_NETWORK, new ExactSvmScheme())
      .registerExtension(bazaarResourceServerExtension);

    if (gatewayEnabled) {
      await server.initialize();
      console.log(JSON.stringify({
        event: "circle_gateway_payment_rail_ready",
        at: new Date().toISOString(),
        capabilityId,
        standardFacilitator: facilitatorUrl,
        gateway: "circle",
        evmNetworkPattern: "eip155:*"
      }));
    }

    const discoveryOutput = capabilityId === "x402-payment-preflight"
      ? {
          example: X402_PREFLIGHT_OUTPUT_EXAMPLE,
          schema: X402_PREFLIGHT_OUTPUT_SCHEMA
        }
      : capabilityId === "x402-ping"
        ? {
            example: X402_PING_OUTPUT_EXAMPLE,
            schema: X402_PING_OUTPUT_SCHEMA
          }
        : {
            example: {},
            schema: {
              type: "object",
              additionalProperties: true
            }
          };

    return withX402<unknown>(handler, {
      [product.endpoint]: {
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
        extensions: {
          ...declareDiscoveryExtension({
            input: product.example,
            inputSchema: product.inputSchema,
            bodyType: "json",
            output: discoveryOutput
          })
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
    const traffic = classifyTraffic(req, { path: product.endpoint });
    logPaidCapabilityAttempt(req, capabilityId, traffic, requestId);
    try {
      const paidHandler = await getPaidHandler();
      const response = stampInfrastructureHeaders(await paidHandler(req), capabilityId, requestId);
      const compatibleResponse = await mirrorPaymentChallengeBody(response);
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
    const traffic = classifyTraffic(req, { path: product.endpoint, isDiscovery: true });
    console.log(JSON.stringify({
      event: "paid_capability_discovery",
      at: new Date().toISOString(),
      capabilityId,
      requestId,
      ...trafficLogFields(req, traffic)
    }));
    return stampInfrastructureHeaders(x402DiscoveryChallenge(capabilityId), capabilityId, requestId);
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
