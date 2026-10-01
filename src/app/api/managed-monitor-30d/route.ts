import { randomUUID } from "node:crypto";
import { createDeterministicPaidRoute } from "@/lib/createDeterministicPaidRoute";
import { parseServiceMonitorInput, runServiceMonitor } from "@/lib/serviceMonitor";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const route = createDeterministicPaidRoute(
  "managed-monitor-30d",
  async (req) => {
    const body = await req.json().catch(() => null);
    const input = parseServiceMonitorInput(body);
    if (input.baselineFingerprint || input.baselineSnapshot) {
      throw new Error("Managed activation does not accept a caller baseline; AgentResolver establishes the managed baseline.");
    }

    const initial = await runServiceMonitor(input);
    const activatedAt = new Date();
    const activeUntil = new Date(activatedAt.getTime() + THIRTY_DAYS_MS);
    const activationId = randomUUID();
    const registryEntry = {
      id: initial.monitorId,
      label: input.label,
      origin: input.origin,
      mcpEndpoint: input.mcpEndpoint,
      x402Endpoint: input.x402Endpoint,
      activatedAt: activatedAt.toISOString(),
      activeUntil: activeUntil.toISOString(),
      billable: true,
      source: "managed-monitor-30d",
      activationId
    };

    return {
      product: "AgentResolver Managed Monitor — 30 days",
      managed: true,
      cadence: "hourly",
      monitorId: initial.monitorId,
      activationId,
      activatedAt: activatedAt.toISOString(),
      activeUntil: activeUntil.toISOString(),
      activationStatus: "queued_for_managed_registry",
      statusUrl:
        "https://agentresolver.vercel.app/api/managed-monitor-status?id=" +
        encodeURIComponent(initial.monitorId),
      current: initial,
      privacy: {
        publicTargetsOnly: true,
        storesCredentials: false,
        storesWalletKeys: false,
        storesCustomerContactInfo: false,
        publicStatusRecord:
          "Managed state contains only the public service URLs, health snapshots, and opaque activation metadata needed to operate the monitor."
      },
      renewal:
        "A later paid activation for the same monitor can extend the managed window without changing the monitor id.",
      note:
        "Managed registry activation is asynchronous. The status URL may return MONITOR_NOT_ACTIVE until the activation processor records the paid monitor."
    };
  },
  {
    onConfirmedSettlement: async ({ response, requestId }) => {
      const body = await response.clone().json().catch(() => null) as Record<string, unknown> | null;
      if (
        !body ||
        body.product !== "AgentResolver Managed Monitor — 30 days" ||
        body.managed !== true ||
        body.activationStatus !== "queued_for_managed_registry"
      ) {
        throw new Error("Managed monitor settlement response did not contain activation metadata.");
      }

      console.log(JSON.stringify({
        event: "managed_monitor_activation_settled",
        capabilityId: "managed-monitor-30d",
        requestId,
        id: body.monitorId,
        label: body.current && typeof body.current === "object"
          ? ((body.current as Record<string, unknown>).target as Record<string, unknown> | undefined)?.label ?? null
          : null,
        origin: body.current && typeof body.current === "object"
          ? ((body.current as Record<string, unknown>).target as Record<string, unknown> | undefined)?.origin ?? null
          : null,
        mcpEndpoint: body.current && typeof body.current === "object"
          ? ((body.current as Record<string, unknown>).target as Record<string, unknown> | undefined)?.mcpEndpoint ?? null
          : null,
        x402Endpoint: body.current && typeof body.current === "object"
          ? ((body.current as Record<string, unknown>).target as Record<string, unknown> | undefined)?.x402Endpoint ?? null
          : null,
        activatedAt: body.activatedAt,
        activeUntil: body.activeUntil,
        billable: true,
        source: "managed-monitor-30d",
        activationId: body.activationId
      }));
    }
  }
);

export const POST = route.POST;
export const GET = route.GET;
export const OPTIONS = route.OPTIONS;
