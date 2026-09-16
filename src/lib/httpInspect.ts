import https from "node:https";
import type { TLSSocket } from "node:tls";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_URL = 500;
const TIMEOUT_MS = 4_500;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type HttpInspectOptions = {
  maxPriceUsd?: number;
  expectedPayTo?: string;
  expectedNetwork?: string;
  method?: "GET" | "HEAD" | "POST";
  body?: unknown;
  allowUnpaidPostProbe?: boolean;
};

export type HttpInspectReport = {
  url: string;
  status: number;
  ok: boolean;
  latencyMs: number;
  contentType: string | null;
  contentLength: string | null;
  cacheControl: string | null;
  etag: string | null;
  lastModified: string | null;
  location: string | null;
  server: string | null;
  response: {
    allow: string | null;
    vary: string | null;
    age: string | null;
    contentEncoding: string | null;
  };
  redirect: {
    isRedirect: boolean;
    location: string | null;
  };
  dns: {
    family: 4 | 6;
  };
  tls: {
    protocol: string | null;
    authorized: boolean;
    validFrom: string | null;
    validTo: string | null;
    daysRemaining: number | null;
    subjectCn: string | null;
    issuerCn: string | null;
  };
  security: {
    hsts: boolean;
    csp: boolean;
    xContentTypeOptions: boolean;
    xFrameOptions: boolean;
    referrerPolicy: boolean;
    permissionsPolicy: boolean;
  };
  x402: {
    detected: boolean;
    challengeHeaderPresent: boolean;
    parseable: boolean;
    version: number | null;
    acceptCount: number;
    scheme: string | null;
    network: string | null;
    asset: string | null;
    payTo: string | null;
    resource: string | null;
    amountAtomic: string | null;
    amountUsd: number | null;
    score: number | null;
    verdict: "strong" | "mixed" | "weak" | "not-detected";
    checks: Array<{
      id: string;
      label: string;
      passed: boolean;
      weight: number;
      evidence: string;
    }>;
  };
  trust: {
    score: number;
    infrastructureScore: number;
    x402Score: number | null;
    grade: "A" | "B" | "C" | "D" | "F";
    verdict: "strong" | "mixed" | "weak";
    checks: Array<{
      id: string;
      label: string;
      passed: boolean;
      weight: number;
      evidence: string;
    }>;
  };
};

function blockedIpv4(address: string) {
  const p = address.split(".").map(Number);
  if (p.length !== 4 || p.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = p;
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

function blockedIpv6(address: string) {
  const value = address.toLowerCase().split("%")[0];
  if (value === "::" || value === "::1") return true;

  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    return isIP(mapped) === 4 ? blockedIpv4(mapped) : true;
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

function blockedAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return blockedIpv4(address);
  if (version === 6) return blockedIpv6(address);
  return true;
}

export function validateHttpInspectTarget(input: string): URL {
  const raw = input.trim();
  if (!raw) throw new Error("Provide a public HTTPS URL.");
  if (raw.length > MAX_URL) throw new Error("URL must be 500 characters or fewer.");

  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Only public HTTPS URLs are supported.");
  if (url.username || url.password || url.port) {
    throw new Error("Credentials and custom ports are not supported.");
  }

  const host = url.hostname.replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    throw new Error("Private hosts are not supported.");
  }

  if (isIP(host) && blockedAddress(host)) {
    throw new Error("Private or reserved targets are not supported.");
  }

  url.hash = "";
  return url;
}

async function resolvePublicAddress(hostname: string) {
  const host = hostname.replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();

  if (isIP(host)) {
    if (blockedAddress(host)) throw new Error("Private or reserved targets are not supported.");
    return { address: host, family: isIP(host) as 4 | 6 };
  }

  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("Target did not resolve.");
  if (addresses.some((entry) => blockedAddress(entry.address))) {
    throw new Error("Target resolves to a private or reserved address.");
  }
  return addresses[0];
}

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value : null;
}

function gradeFor(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function sameUrl(a: string | null, b: string) {
  if (!a) return false;
  try {
    const left = new URL(a);
    const right = new URL(b);
    left.hash = "";
    right.hash = "";
    return left.toString() === right.toString();
  } catch {
    return false;
  }
}

function decodePaymentRequired(value: string | null): any | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function assessX402Payment(
  status: number,
  targetUrl: string,
  paymentRequired: string | null,
  options: HttpInspectOptions = {}
) {
  const decoded = decodePaymentRequired(paymentRequired);
  const accepts = Array.isArray(decoded?.accepts) ? decoded.accepts : [];
  const offer = accepts[0] && typeof accepts[0] === "object" ? accepts[0] : null;
  const scheme = typeof offer?.scheme === "string" ? offer.scheme : null;
  const network = typeof offer?.network === "string" ? offer.network : null;
  const asset = typeof offer?.asset === "string" ? offer.asset : null;
  const payTo = typeof offer?.payTo === "string" ? offer.payTo : null;
  const resource = typeof offer?.resource === "string"
    ? offer.resource
    : typeof decoded?.resource?.url === "string"
      ? decoded.resource.url
      : null;
  const amountAtomicRaw = offer?.amount ?? offer?.maxAmountRequired;
  const amountAtomic = typeof amountAtomicRaw === "string" || typeof amountAtomicRaw === "number"
    ? String(amountAtomicRaw)
    : null;
  let amountUsd: number | null = null;
  const recognizedUsdc =
    (network === "eip155:8453" && asset?.toLowerCase() === BASE_USDC) ||
    (network === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" && asset === SOLANA_USDC);
  if (
    recognizedUsdc &&
    amountAtomic &&
    /^\d+$/.test(amountAtomic)
  ) {
    const atomic = Number(amountAtomic);
    if (Number.isSafeInteger(atomic)) amountUsd = atomic / 1_000_000;
  }

  const detected = status === 402 || Boolean(paymentRequired);
  if (!detected) {
    return {
      detected: false,
      challengeHeaderPresent: Boolean(paymentRequired),
      parseable: false,
      version: null,
      acceptCount: 0,
      scheme: null,
      network: null,
      asset: null,
      payTo: null,
      resource: null,
      amountAtomic: null,
      amountUsd: null,
      score: null,
      verdict: "not-detected" as const,
      checks: []
    };
  }

  const checks = [
    { id: "status_402", label: "Returns HTTP 402", passed: status === 402, weight: 15, evidence: `HTTP ${status}.` },
    { id: "payment_required_header", label: "PAYMENT-REQUIRED header present", passed: Boolean(paymentRequired), weight: 15, evidence: paymentRequired ? "Payment challenge header present." : "Payment challenge header missing." },
    { id: "challenge_parseable", label: "Payment challenge decodes as JSON", passed: Boolean(decoded), weight: 15, evidence: decoded ? "Base64 challenge decoded successfully." : "Challenge could not be decoded." },
    { id: "x402_v2", label: "x402 v2 challenge", passed: decoded?.x402Version === 2, weight: 10, evidence: decoded?.x402Version == null ? "x402 version missing." : `x402Version=${decoded.x402Version}.` },
    { id: "accepts", label: "At least one payment option", passed: accepts.length > 0, weight: 10, evidence: `${accepts.length} payment option(s).` },
    { id: "exact_scheme", label: "Exact payment scheme", passed: scheme === "exact", weight: 5, evidence: scheme ? `scheme=${scheme}.` : "Payment scheme missing." },
    { id: "network", label: "Network declared", passed: Boolean(network), weight: 5, evidence: network ? `network=${network}.` : "Network missing." },
    { id: "asset", label: "Asset declared", passed: Boolean(asset), weight: 5, evidence: asset ? `asset=${asset}.` : "Asset missing." },
    { id: "pay_to", label: "Payment recipient declared", passed: Boolean(payTo), weight: 5, evidence: payTo ? `payTo=${payTo}.` : "Payment recipient missing." },
    { id: "amount", label: "Positive bounded amount declared", passed: Boolean(amountAtomic && /^\d+$/.test(amountAtomic) && BigInt(amountAtomic) > 0n), weight: 5, evidence: amountAtomic ? `amount=${amountAtomic} atomic units.` : "Payment amount missing." },
    { id: "resource_binding", label: "Challenge bound to requested resource", passed: sameUrl(resource, targetUrl), weight: 10, evidence: resource ? `resource=${resource}.` : "Resource binding missing." }
  ];

  if (typeof options.maxPriceUsd === "number" && Number.isFinite(options.maxPriceUsd) && options.maxPriceUsd >= 0) {
    checks.push({
      id: "max_price",
      label: "Quote is within caller max price",
      passed: amountUsd !== null && amountUsd <= options.maxPriceUsd,
      weight: 10,
      evidence: amountUsd === null ? "USD quote unavailable." : `quote=${amountUsd.toFixed(6)}, max=${options.maxPriceUsd.toFixed(6)}.`
    });
  }
  if (options.expectedPayTo) {
    checks.push({
      id: "expected_pay_to",
      label: "Payment recipient matches expectation",
      passed: payTo?.toLowerCase() === options.expectedPayTo.toLowerCase(),
      weight: 10,
      evidence: payTo ? `observed=${payTo}.` : "Payment recipient unavailable."
    });
  }
  if (options.expectedNetwork) {
    checks.push({
      id: "expected_network",
      label: "Network matches expectation",
      passed: network === options.expectedNetwork,
      weight: 10,
      evidence: network ? `observed=${network}.` : "Network unavailable."
    });
  }

  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  const score = totalWeight ? Math.round((earned / totalWeight) * 100) : 0;

  return {
    detected: true,
    challengeHeaderPresent: Boolean(paymentRequired),
    parseable: Boolean(decoded),
    version: typeof decoded?.x402Version === "number" ? decoded.x402Version : null,
    acceptCount: accepts.length,
    scheme,
    network,
    asset,
    payTo,
    resource,
    amountAtomic,
    amountUsd,
    score,
    verdict: score >= 80 ? "strong" as const : score >= 60 ? "mixed" as const : "weak" as const,
    checks
  };
}

export async function inspectHttpResource(input: string, options: HttpInspectOptions = {}): Promise<HttpInspectReport> {
  const url = validateHttpInspectTarget(input);
  const resolved = await resolvePublicAddress(url.hostname);
  const originalHost = url.hostname.replace(/^\[/, "").replace(/\]$/, "");
  const method = options.method ?? "GET";
  if (!["GET", "HEAD", "POST"].includes(method)) throw new Error("Method must be GET, HEAD, or POST.");
  if (method === "POST" && options.allowUnpaidPostProbe !== true) {
    throw new Error("POST probing can have side effects on an endpoint that is not actually paywalled. Set allowUnpaidPostProbe=true to explicitly authorize one unpaid POST probe.");
  }
  let requestBody: string | null = null;
  if (method === "POST") {
    requestBody = JSON.stringify(options.body ?? {});
    if (Buffer.byteLength(requestBody, "utf8") > 65_536) throw new Error("Probe body must be 64 KB or smaller.");
  }
  const started = Date.now();

  return await new Promise<HttpInspectReport>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
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
        Accept: "*/*",
        ...(requestBody ? {
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(requestBody, "utf8"))
        } : {}),
        "User-Agent": "AgentResolver-x402-Trust/0.3",
        Connection: "close"
      },
      timeout: TIMEOUT_MS
    }, (res) => {
      const status = res.statusCode || 0;
      const headers = res.headers;
      res.resume();

      const socket = res.socket as TLSSocket;
      const certificate = typeof socket.getPeerCertificate === "function"
        ? socket.getPeerCertificate()
        : null;
      const validTo = certificate && typeof certificate.valid_to === "string"
        ? certificate.valid_to
        : null;
      const validToMs = validTo ? Date.parse(validTo) : Number.NaN;
      const daysRemaining = Number.isFinite(validToMs)
        ? Math.ceil((validToMs - Date.now()) / 86_400_000)
        : null;
      const location = headerValue(headers.location);

      const tlsProtocol = typeof socket.getProtocol === "function" ? socket.getProtocol() : null;
      const security = {
        hsts: Boolean(headers["strict-transport-security"]),
        csp: Boolean(headers["content-security-policy"]),
        xContentTypeOptions: Boolean(headers["x-content-type-options"]),
        xFrameOptions: Boolean(headers["x-frame-options"]),
        referrerPolicy: Boolean(headers["referrer-policy"]),
        permissionsPolicy: Boolean(headers["permissions-policy"])
      };
      const latencyMs = Date.now() - started;
      const reachable = status >= 200 && status < 500;
      const checks = [
        { id: "tls_authorized", label: "TLS certificate authorized", passed: socket.authorized === true, weight: 30, evidence: socket.authorized === true ? "Certificate chain authorized." : "Certificate chain was not authorized." },
        { id: "tls_protocol", label: "Modern TLS protocol", passed: tlsProtocol === "TLSv1.3" || tlsProtocol === "TLSv1.2", weight: 10, evidence: tlsProtocol || "TLS protocol unavailable." },
        { id: "cert_lifetime", label: "Certificate not near expiry", passed: daysRemaining !== null && daysRemaining >= 14, weight: 10, evidence: daysRemaining === null ? "Certificate expiry unavailable." : `${daysRemaining} days remaining.` },
        { id: "reachable", label: "Endpoint reachable without server error", passed: reachable, weight: 20, evidence: `HTTP ${status}.` },
        { id: "redirect", label: "No immediate redirect", passed: !(status >= 300 && status < 400 && Boolean(location)), weight: 5, evidence: location ? `Redirects to ${location}.` : "No redirect observed." },
        { id: "latency", label: "Responsive endpoint", passed: latencyMs <= 1500, weight: 10, evidence: `${latencyMs} ms ${method} latency.` },
        { id: "hsts", label: "HSTS enabled", passed: security.hsts, weight: 5, evidence: security.hsts ? "Strict-Transport-Security present." : "Strict-Transport-Security missing." },
        { id: "csp", label: "Content Security Policy present", passed: security.csp, weight: 3, evidence: security.csp ? "Content-Security-Policy present." : "Content-Security-Policy missing." },
        { id: "x_content_type_options", label: "MIME sniffing protection", passed: security.xContentTypeOptions, weight: 2, evidence: security.xContentTypeOptions ? "X-Content-Type-Options present." : "X-Content-Type-Options missing." },
        { id: "x_frame_options", label: "Framing protection", passed: security.xFrameOptions, weight: 2, evidence: security.xFrameOptions ? "X-Frame-Options present." : "X-Frame-Options missing." },
        { id: "referrer_policy", label: "Referrer policy present", passed: security.referrerPolicy, weight: 2, evidence: security.referrerPolicy ? "Referrer-Policy present." : "Referrer-Policy missing." },
        { id: "permissions_policy", label: "Permissions policy present", passed: security.permissionsPolicy, weight: 1, evidence: security.permissionsPolicy ? "Permissions-Policy present." : "Permissions-Policy missing." }
      ];
      const infrastructureScore = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
      const paymentRequired = headerValue(headers["payment-required"]);
      const x402 = assessX402Payment(status, url.toString(), paymentRequired, options);
      const score = x402.score === null
        ? infrastructureScore
        : Math.round((infrastructureScore * 0.4) + (x402.score * 0.6));

      finish(() => resolve({
        url: url.toString(),
        status,
        ok: status >= 200 && status < 300,
        latencyMs,
        contentType: headerValue(headers["content-type"]),
        contentLength: headerValue(headers["content-length"]),
        cacheControl: headerValue(headers["cache-control"]),
        etag: headerValue(headers.etag),
        lastModified: headerValue(headers["last-modified"]),
        location,
        server: headerValue(headers.server),
        response: {
          allow: headerValue(headers.allow),
          vary: headerValue(headers.vary),
          age: headerValue(headers.age),
          contentEncoding: headerValue(headers["content-encoding"])
        },
        redirect: {
          isRedirect: status >= 300 && status < 400 && Boolean(location),
          location
        },
        dns: {
          family: resolved.family === 6 ? 6 : 4
        },
        tls: {
          protocol: tlsProtocol,
          authorized: socket.authorized === true,
          validFrom: certificate && typeof certificate.valid_from === "string" ? certificate.valid_from : null,
          validTo,
          daysRemaining,
          subjectCn: certificate?.subject && typeof certificate.subject.CN === "string" ? certificate.subject.CN : null,
          issuerCn: certificate?.issuer && typeof certificate.issuer.CN === "string" ? certificate.issuer.CN : null
        },
        security,
        x402,
        trust: {
          score,
          infrastructureScore,
          x402Score: x402.score,
          grade: gradeFor(score),
          verdict: score >= 80 ? "strong" : score >= 60 ? "mixed" : "weak",
          checks
        }
      }));
    });

    req.on("timeout", () => req.destroy(new Error("Inspection timed out.")));
    req.on("error", (error) => finish(() => reject(error instanceof Error ? error : new Error("Inspection failed."))));
    if (requestBody) req.write(requestBody);
    req.end();
  });
}
