import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
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

let resourceServerPromise: Promise<x402ResourceServer> | null = null;

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

async function getResourceServer() {
  if (!resourceServerPromise) {
    resourceServerPromise = (async () => {
      const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();
      const facilitatorUrl = (
        process.env.X402_FACILITATOR_URL || X402_FACILITATOR_URL
      ).trim();

      if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
        throw new Error("AGENTRESOLVER_PAY_TO is invalid.");
      }
      if (!/^https:\/\//i.test(facilitatorUrl)) {
        throw new Error("X402_FACILITATOR_URL is invalid.");
      }

      const facilitatorClient = new HTTPFacilitatorClient({
        url: facilitatorUrl,
        timeoutMs: 10_000
      });

      const server = new x402ResourceServer(facilitatorClient)
        .register(X402_NETWORK, new ExactEvmScheme());

      await server.initialize();
      return server;
    })();
  }

  return resourceServerPromise;
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
  let wrappedPromise: Promise<McpToolHandler<TArgs>> | null = null;

  async function getWrappedHandler() {
    if (!wrappedPromise) {
      wrappedPromise = (async () => {
        const resourceServer = await getResourceServer();
        const payTo = (process.env.AGENTRESOLVER_PAY_TO || X402_PAY_TO).trim();

        const accepts = await Promise.resolve(
          resourceServer.buildPaymentRequirements({
            scheme: "exact",
            network: X402_NETWORK,
            payTo: payTo as `0x${string}`,
            price: product.price,
            extra: { name: "USDC", version: "2" }
          })
        );

        if (!Array.isArray(accepts) || accepts.length === 0) {
          throw new Error(`No x402 MCP payment requirements for ${capabilityId}.`);
        }

        const paid = createPaymentWrapper(resourceServer, {
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

        return paid(handler as never) as unknown as McpToolHandler<TArgs>;
      })();
    }

    return wrappedPromise;
  }

  return async (args: TArgs, extra?: unknown): Promise<McpToolResult> => {
    const wrapped = await getWrappedHandler();
    const result = await wrapped(args, extra);
    logMcpPaymentOutcome(result, capabilityId);
    return result;
  };
}
