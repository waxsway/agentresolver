export type ProcurementConstraints = {
  maxPriceUsd?: number;
  preferredNetworks?: string[];
  protocol?: "x402" | "mcp" | "any";
  requireHttps?: boolean;
  availableInputSchema?: Record<string, unknown>;
  requiredOutputSchema?: Record<string, unknown>;
  sideEffect?: "read-only" | "state-changing" | "any";
  auth?: "none" | "wallet" | "api-key" | "any";
};

export type ProcurementRequest = {
  goal: string;
  limit?: number;
  constraints?: ProcurementConstraints;
};

export type ProcurementCandidate = {
  id: string;
  source: string;
  sourceRank: number;
  name: string;
  description: string | null;
  endpoint: string | null;
  protocol: "x402" | "mcp" | "http";
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
