import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { PaymentRequirements } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createPaymentWrapper } from "@x402/mcp";
import { CANONICAL_ORIGIN, getPaidCapability, type PaidCapabilityId } from "@/lib/paidCapabilities";
import { shortHash } from "@/lib/telemetry";
import {
  X402_FACILITATOR_URL,
  X402_NETWORK,
  X402_PAY_TO
} from "@/lib/x402Config";

type JsonObject = Record<string, unknown>;

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: JsonObject;
  _meta?: JsonObject;
  isError?: boolean;
};

type McpToolHandler<TArgs> = (
  args: TArgs,
  extra?: unknown
) => Promise<McpToolResult> | McpToolResult;

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
let resourceServer: x402ResourceServer | null = null;

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function getResourceServer() {
  if (resourceServer) return resourceServer;

  const facilitatorUrl = (
    process.env.X402_FACILITATOR_URL || X402_FACILITATOR_URL
  ).trim();
  if (!/^https:\/\//i.test(facilitatorUrl)) {
    throw new Error("X402_FACILITATOR_URL is invalid.");
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: facilitatorUrl,
    timeoutMs: 10_000
  });

  // Deliberately do not call server.initialize(). For our fixed Base/USDC exact
  // products the payment requirement is known locally, so unpaid MCP calls can
  // receive a challenge without any facilitator/network request. The resource
  // server contacts the configured facilitator only when verify/settle is needed.
  resourceServer = new x402ResourceServer(facilitatorClient)
    .register(X402_NETWORK, new ExactEvmScheme());

  return resourceServer;
}

export function buildStaticMcpPaymentRequirements(
  capabilityId: PaidCapabilityId
): PaymentRequirements[] {
  const product = getPaidCapability(capabilityId);
  const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
    throw new Error("AGENTRESOLVER_PAY_TO is invalid.");
  }

  return [{
    scheme: "exact",
    network: X402_NETWORK,
    amount: product.atomicAmount,
    asset: BASE_USDC,
    payTo,
    maxTimeoutSeconds: 300,
    extra: {
      name: "USD Coin",
      version: "2"
    }
  }];
}

function logMcpPaymentOutcome(result: McpToolResult, capabilityId: PaidCapabilityId) {
  const structured = object(result.structuredContent);
  const accepts = structured?.accepts;

  if (
    structured?.x402Version === 2 &&
    Array.isArray(accepts) &&
    accepts.length > 0
  ) {
    console.log(JSON.stringify({
      event: "mcp_paid_challenge_issued",
      at: new Date().toISOString(),
      capabilityId,
      acceptCount: accepts.length
    }));
  }

  const meta = object(result._meta);
  const receipt = object(meta?.["x402/payment-response"]);
  if (!receipt) return;

  const success = receipt.success === true;
  const transaction = typeof receipt.transaction === "string"
    ? receipt.transaction
    : null;
  const network = typeof receipt.network === "string"
    ? receipt.network.slice(0, 80)
    : null;
  const payer = typeof receipt.payer === "string" ? receipt.payer : null;

  console.log(JSON.stringify({
    event: success && transaction
      ? "paid_capability_settled"
      : "paid_capability_settlement_unconfirmed",
    surface: "mcp",
    at: new Date().toISOString(),
    capabilityId,
    success,
    network,
    transactionHash: transaction ? shortHash(transaction) : null,
    payerHash: payer ? shortHash(payer) : null
  }));
}

export function createLazyPaidMcpTool<TArgs>(
  capabilityId: PaidCapabilityId,
  handler: McpToolHandler<TArgs>
) {
  const product = getPaidCapability(capabilityId);
  let wrapped: McpToolHandler<TArgs> | null = null;

  function getWrappedHandler() {
    if (!wrapped) {
      const server = getResourceServer();
      const accepts = buildStaticMcpPaymentRequirements(capabilityId);

      const paid = createPaymentWrapper(server, {
        accepts,
        resource: {
          url: `${CANONICAL_ORIGIN}/mcp`,
          description: product.description,
          mimeType: "application/json"
        },
        extensions: declareDiscoveryExtension({
          toolName: product.quoteTool.name,
          description: product.description,
          transport: "streamable-http",
          inputSchema: product.inputSchema,
          example: product.example
        })
      });

      wrapped = paid(handler as never) as unknown as McpToolHandler<TArgs>;
    }

    return wrapped;
  }

  return async (args: TArgs, extra?: unknown): Promise<McpToolResult> => {
    const paidHandler = getWrappedHandler();
    const result = await paidHandler(args, extra);
    logMcpPaymentOutcome(result, capabilityId);
    return result;
  };
}
