export type ProcurementConstraints = {
  maxPriceUsd?: number;
  preferredNetworks?: string[];
  protocol?: "x402" | "l402" | "mpp" | "mcp" | "any";
  requireHttps?: boolean;
  availableInputSchema?: Record<string, unknown>;
  requiredOutputSchema?: Record<string, unknown>;
  sideEffect?: "read-only" | "state-changing" | "any";
  auth?: "none" | "wallet" | "api-key" | "any";
};

export type ProcurementRequest = {
  goal: string;
  limit?: number;
  providerOrigins?: string[];
  constraints?: ProcurementConstraints;
};

export type ProcurementCandidate = {
  id: string;
  source: string;
  sourceRank: number;
  name: string;
  description: string | null;
  endpoint: string | null;
  protocol: "x402" | "l402" | "mpp" | "mcp" | "http";
  priceUsd: number | null;
  networks: string[];
  status: "eligible" | "eligible_with_unknowns" | "rejected";
  rejectionReasons: string[];
  unknownConstraints: string[];
  execute: Record<string, unknown> | null;
  evidence?: Record<string, unknown> | null;
};

export type ProcurementResponse = {
  schemaVersion: number;
  resolver: "AgentResolver";
  mode: "open_world_non_custodial_procurement";
  goal: string;
  constraints: ProcurementConstraints;
  providerOrigins: string[];
  selected: ProcurementCandidate | null;
  candidates: ProcurementCandidate[];
  verification: {
    recommended: boolean;
    reason: string;
    paidAction?: Record<string, unknown>;
  };
  boundaries: {
    accountRequired: false;
    apiKeyRequired: false;
    callerWalletControlledByAgentResolver: false;
    callerSpendAuthorizedByAgentResolver: false;
    arbitraryProxying: false;
    unknownMetadataIsNotTreatedAsVerified: true;
  };
};

export type AgentResolverClientOptions = {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export class AgentResolverClientError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "AgentResolverClientError";
    this.status = status;
    this.body = body;
  }
}

async function jsonOrText(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  return response.text().catch(() => "");
}

export function createAgentResolverClient(
  options: AgentResolverClientOptions = {}
) {
  const baseUrl = (options.baseUrl || "https://agentresolver.vercel.app").replace(/\/$/, "");
  const fetchImpl = options.fetch || globalThis.fetch;

  if (!fetchImpl) {
    throw new Error("A fetch implementation is required.");
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, init);
    const body = await jsonOrText(response);

    if (!response.ok) {
      throw new AgentResolverClientError(
        `AgentResolver request failed with HTTP ${response.status}`,
        response.status,
        body
      );
    }

    return body as T;
  }

  return {
    baseUrl,

    procure(input: ProcurementRequest): Promise<ProcurementResponse> {
      return request<ProcurementResponse>("/api/procure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });
    },

    resolve(input: {
      goal: string;
      url?: string;
      limit?: number;
      maxPriceUsd?: number;
      preferredNetwork?: string;
    }): Promise<Record<string, unknown>> {
      return request<Record<string, unknown>>("/api/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });
    },

    health(): Promise<Record<string, unknown>> {
      return request<Record<string, unknown>>("/api/health");
    }
  };
}

export type AgentResolverClient = ReturnType<typeof createAgentResolverClient>;


export type X402SelectedRequirements = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
};

export type X402PaymentRequired = {
  x402Version: number;
  resource?: {
    url?: string;
  } | null;
  extensions?: {
    bazaar?: {
      info?: {
        input?: {
          method?: unknown;
        };
      };
    };
  } | null;
};

export type X402BeforePaymentContext = {
  paymentRequired: X402PaymentRequired;
  selectedRequirements: X402SelectedRequirements;
};

export type X402BeforePaymentAbort = {
  abort: true;
  reason: string;
};

export type AgentResolverGuardHookOptions = {
  /**
   * Separate payment-enabled fetch used only for the AgentResolver Guard fee.
   * Never pass the merchant's guarded fetch here or Guard can recurse into itself.
   */
  guardFetch: typeof globalThis.fetch;
  maxTargetPriceUsd: number;
  agentResolverOrigin?: string;
};

type GuardTargetPayment = {
  network?: unknown;
  asset?: unknown;
  payTo?: unknown;
  resource?: unknown;
  amountAtomic?: unknown;
  scheme?: unknown;
  x402Version?: unknown;
};

type GuardResponse = {
  prepaymentDecision?: {
    decision?: unknown;
    eligibleForCallerAuthorization?: unknown;
    targetPayment?: GuardTargetPayment;
  };
};

function samePaymentIdentifier(left: unknown, right: unknown): boolean {
  if (typeof left !== "string" || typeof right !== "string") {
    return false;
  }

  if (
    left.slice(0, 2).toLowerCase() === "0x" &&
    right.slice(0, 2).toLowerCase() === "0x"
  ) {
    return left.toLowerCase() === right.toLowerCase();
  }

  return left === right;
}

function guardTargetUrl(paymentRequired: X402PaymentRequired): string | null {
  const value = paymentRequired.resource?.url;
  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Creates a fail-closed pre-sign hook compatible with the official x402 client's
 * onBeforePaymentCreation lifecycle.
 *
 * The host remains responsible for wallet custody and for independently
 * authorizing both the $0.001 AgentResolver Guard payment and the merchant
 * payment. AgentResolver never receives a private key or signs the target spend.
 *
 * The supplied guardFetch MUST be a separate payment-enabled fetch without this
 * hook installed, otherwise paying AgentResolver Guard can recurse into itself.
 */
export function createAgentResolverX402GuardHook(
  options: AgentResolverGuardHookOptions
) {
  if (
    !Number.isFinite(options.maxTargetPriceUsd) ||
    options.maxTargetPriceUsd < 0
  ) {
    throw new Error("maxTargetPriceUsd must be a finite non-negative number.");
  }

  const origin = (
    options.agentResolverOrigin || "https://agentresolver.vercel.app"
  ).replace(/\/$/, "");

  return async function agentResolverGuardHook(
    context: X402BeforePaymentContext
  ): Promise<void | X402BeforePaymentAbort> {
    const targetUrl = guardTargetUrl(context.paymentRequired);
    if (!targetUrl) {
      return {
        abort: true,
        reason: "AgentResolver Guard requires a public HTTPS target resource"
      };
    }

    const advertisedMethod =
      context.paymentRequired.extensions?.bazaar?.info?.input?.method;

    if (
      advertisedMethod !== undefined &&
      String(advertisedMethod).toUpperCase() !== "GET"
    ) {
      return {
        abort: true,
        reason:
          "AgentResolver embedded Guard hook is GET-only; use the explicit request-scoped Guard flow for non-GET targets"
      };
    }

    const selected = context.selectedRequirements;
    const guardUrl = new URL("/api/payment-guard", origin);
    guardUrl.searchParams.set("url", targetUrl);
    guardUrl.searchParams.set("method", "GET");
    guardUrl.searchParams.set(
      "maxPriceUsd",
      String(options.maxTargetPriceUsd)
    );
    guardUrl.searchParams.set("expectedPayTo", selected.payTo);
    guardUrl.searchParams.set("expectedNetwork", selected.network);

    let response: Response;
    try {
      response = await options.guardFetch(guardUrl.toString(), {
        method: "GET"
      });
    } catch (error) {
      return {
        abort: true,
        reason:
          error instanceof Error
            ? `AgentResolver Guard unavailable: ${error.message}`
            : "AgentResolver Guard unavailable"
      };
    }

    if (!response.ok) {
      return {
        abort: true,
        reason: `AgentResolver Guard returned HTTP ${response.status}`
      };
    }

    const result = (await response.json().catch(() => null)) as
      | GuardResponse
      | null;
    const decision = result?.prepaymentDecision;

    if (
      decision?.decision !== "eligible" ||
      decision?.eligibleForCallerAuthorization !== true
    ) {
      return {
        abort: true,
        reason: "AgentResolver Guard did not return an eligible decision"
      };
    }

    const observed = decision.targetPayment;
    if (
      observed?.network !== selected.network ||
      observed?.amountAtomic !== selected.amount ||
      observed?.scheme !== selected.scheme ||
      observed?.x402Version !== context.paymentRequired.x402Version ||
      observed?.resource !== targetUrl ||
      !samePaymentIdentifier(observed?.asset, selected.asset) ||
      !samePaymentIdentifier(observed?.payTo, selected.payTo)
    ) {
      return {
        abort: true,
        reason:
          "AgentResolver Guard evidence does not match the selected x402 payment requirements"
      };
    }

    // Returning void lets the x402 client continue to its own caller-controlled
    // signing and spend policy. It is not authorization from AgentResolver.
  };
}
