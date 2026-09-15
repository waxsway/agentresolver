import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { MarketplaceMatch } from "@/lib/circleDiscovery";

const TIMEOUT_MS = 3_000;
const MAX_BODY_BYTES = 32_000;
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

type UnknownObject = Record<string, unknown>;

export type X402PaymentOptionSummary = {
  scheme: string | null;
  network: string | null;
  amount: string | null;
  asset: string | null;
  payTo: string | null;
};

export type MarketplaceProbeReport = {
  provider: string | null;
  resource: string;
  source: MarketplaceMatch["source"];
  method: string;
  reachable: boolean;
  status: number | null;
  latencyMs: number | null;
  x402Compatible: boolean;
  paymentOptions: X402PaymentOptionSummary[];
  confidence: number;
  error?: string;
};

function object(value: unknown): UnknownObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownObject
    : null;
}

function stripIpv6Brackets(hostname: string) {
  return hostname.replace(/^\[/, "").replace(/\]$/, "");
}

function isBlockedIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) return true;

  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string) {
  const value = address.toLowerCase().split("%")[0];
  if (value === "::" || value === "::1") return true;

  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    return isIP(mapped) === 4 ? isBlockedIpv4(mapped) : true;
  }

  const first = value.split(":")[0] || "0";
  const firstWord = Number.parseInt(first, 16);
  if (!Number.isFinite(firstWord)) return true;

  return (
    (firstWord & 0xfe00) === 0xfc00 ||
    (firstWord & 0xffc0) === 0xfe80 ||
    (firstWord & 0xff00) === 0xff00 ||
    value.startsWith("2001:db8:")
  );
}

function isBlockedAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

async function resolvePublicAddress(hostname: string) {
  const host = stripIpv6Brackets(hostname).replace(/\.$/, "").toLowerCase();

  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    throw new Error("Private or local marketplace targets are not allowed.");
  }

  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new Error("Private or reserved marketplace targets are not allowed.");
    }
    return { address: host, family: isIP(host) as 4 | 6 };
  }

  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("Marketplace target did not resolve.");
  if (addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error("Marketplace target resolves to a private or reserved address.");
  }
  return addresses[0];
}

function safeResourceUrl(input: string) {
  const url = new URL(input);
  if (url.protocol !== "https:") {
    throw new Error("Only public HTTPS marketplace resources are verified.");
  }
  if (url.username || url.password) {
    throw new Error("Credential-bearing marketplace URLs are not allowed.");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Custom marketplace ports are not supported.");
  }
  url.hash = "";
  return url;
}

export function marketplaceMethod(input: unknown): string {
  const method = object(input)?.method;
  const normalized = typeof method === "string" ? method.trim().toUpperCase() : "";
  return ALLOWED_METHODS.has(normalized) ? normalized : "GET";
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodePaymentHeader(value: string | null): unknown {
  if (!value) return null;

  const direct = parseJson(value);
  if (direct) return direct;

  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return parseJson(Buffer.from(normalized, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function summaries(value: unknown): X402PaymentOptionSummary[] {
  const root = object(value);
  const accepts = Array.isArray(root?.accepts) ? root.accepts : [];

  return accepts
    .map((raw) => object(raw))
    .filter((item): item is UnknownObject => Boolean(item))
    .slice(0, 5)
    .map((item) => ({
      scheme: typeof item.scheme === "string" ? item.scheme : null,
      network: typeof item.network === "string" ? item.network : null,
      amount:
        typeof item.amount === "string"
          ? item.amount
          : typeof item.maxAmountRequired === "string"
            ? item.maxAmountRequired
            : null,
      asset: typeof item.asset === "string" ? item.asset : null,
      payTo: typeof item.payTo === "string" ? item.payTo : null
    }));
}

export function parseX402PaymentOptions(
  bodyText: string,
  paymentRequiredHeader: string | null
): X402PaymentOptionSummary[] {
  const bodyOptions = summaries(parseJson(bodyText));
  if (bodyOptions.length > 0) return bodyOptions;
  return summaries(decodePaymentHeader(paymentRequiredHeader));
}

export async function probeMarketplaceResource(
  item: MarketplaceMatch
): Promise<MarketplaceProbeReport> {
  const method = marketplaceMethod(item.input);
  const started = Date.now();

  try {
    const url = safeResourceUrl(item.resource);
    const resolved = await resolvePublicAddress(url.hostname);
    const originalHost = stripIpv6Brackets(url.hostname);
    const body = BODY_METHODS.has(method) ? Buffer.from("{}") : null;

    return await new Promise<MarketplaceProbeReport>((resolve) => {
      let settled = false;

      const finish = (value: MarketplaceProbeReport) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const req = https.request({
        hostname: resolved.address,
        family: resolved.family,
        port: 443,
        path: `${url.pathname || "/"}${url.search}`,
        method,
        servername: isIP(originalHost) ? undefined : originalHost,
        rejectUnauthorized: true,
        headers: {
          Host: url.host,
          Accept: "application/json, */*;q=0.5",
          "User-Agent": "AgentResolver-Verified-Resolve/0.1",
          Connection: "close",
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": String(body.length)
              }
            : {})
        },
        timeout: TIMEOUT_MS
      }, (res) => {
        const status = res.statusCode ?? null;
        const chunks: Buffer[] = [];
        let bytes = 0;

        res.on("data", (chunk: Buffer | string) => {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.length;

          if (bytes > MAX_BODY_BYTES) {
            res.destroy();
            finish({
              provider: item.provider,
              resource: item.resource,
              source: item.source,
              method,
              reachable: true,
              status,
              latencyMs: Date.now() - started,
              x402Compatible: status === 402 && Boolean(res.headers["payment-required"]),
              paymentOptions: [],
              confidence: status === 402 ? 0.7 : 0.4,
              error: "Probe response exceeded 32 KB."
            });
            return;
          }

          chunks.push(buffer);
        });

        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const header = typeof res.headers["payment-required"] === "string"
            ? res.headers["payment-required"]
            : Array.isArray(res.headers["payment-required"])
              ? res.headers["payment-required"][0] || null
              : null;
          const paymentOptions = parseX402PaymentOptions(text, header);
          const x402Compatible = status === 402 && paymentOptions.length > 0;

          finish({
            provider: item.provider,
            resource: item.resource,
            source: item.source,
            method,
            reachable: true,
            status,
            latencyMs: Date.now() - started,
            x402Compatible,
            paymentOptions,
            confidence: x402Compatible ? 1 : status === 402 ? 0.7 : 0.4
          });
        });

        res.on("error", () => {
          finish({
            provider: item.provider,
            resource: item.resource,
            source: item.source,
            method,
            reachable: true,
            status,
            latencyMs: Date.now() - started,
            x402Compatible: false,
            paymentOptions: [],
            confidence: 0.25,
            error: "Marketplace response failed."
          });
        });
      });

      req.on("timeout", () => req.destroy(new Error("Marketplace probe timed out.")));
      req.on("error", (error) => {
        finish({
          provider: item.provider,
          resource: item.resource,
          source: item.source,
          method,
          reachable: false,
          status: null,
          latencyMs: Date.now() - started,
          x402Compatible: false,
          paymentOptions: [],
          confidence: 0,
          error: error instanceof Error ? error.message : "Marketplace probe failed."
        });
      });

      if (body) req.write(body);
      req.end();
    });
  } catch (error) {
    return {
      provider: item.provider,
      resource: item.resource,
      source: item.source,
      method,
      reachable: false,
      status: null,
      latencyMs: Date.now() - started,
      x402Compatible: false,
      paymentOptions: [],
      confidence: 0,
      error: error instanceof Error ? error.message : "Marketplace probe failed."
    };
  }
}
