import https from "node:https";
import type { TLSSocket } from "node:tls";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_URL = 500;
const TIMEOUT_MS = 4_500;

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

export async function inspectHttpResource(input: string): Promise<HttpInspectReport> {
  const url = validateHttpInspectTarget(input);
  const resolved = await resolvePublicAddress(url.hostname);
  const originalHost = url.hostname.replace(/^\[/, "").replace(/\]$/, "");
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
      method: "HEAD",
      servername: isIP(originalHost) ? undefined : originalHost,
      rejectUnauthorized: true,
      headers: {
        Host: url.host,
        Accept: "*/*",
        "User-Agent": "AgentResolver-HTTP-Inspect/0.2",
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

      finish(() => resolve({
        url: url.toString(),
        status,
        ok: status >= 200 && status < 300,
        latencyMs: Date.now() - started,
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
          family: resolved.family
        },
        tls: {
          protocol: typeof socket.getProtocol === "function" ? socket.getProtocol() : null,
          authorized: socket.authorized === true,
          validFrom: certificate && typeof certificate.valid_from === "string" ? certificate.valid_from : null,
          validTo,
          daysRemaining,
          subjectCn: certificate?.subject && typeof certificate.subject.CN === "string" ? certificate.subject.CN : null,
          issuerCn: certificate?.issuer && typeof certificate.issuer.CN === "string" ? certificate.issuer.CN : null
        },
        security: {
          hsts: Boolean(headers["strict-transport-security"]),
          csp: Boolean(headers["content-security-policy"]),
          xContentTypeOptions: Boolean(headers["x-content-type-options"]),
          xFrameOptions: Boolean(headers["x-frame-options"]),
          referrerPolicy: Boolean(headers["referrer-policy"]),
          permissionsPolicy: Boolean(headers["permissions-policy"])
        }
      }));
    });

    req.on("timeout", () => req.destroy(new Error("Inspection timed out.")));
    req.on("error", (error) => finish(() => reject(error instanceof Error ? error : new Error("Inspection failed."))));
    req.end();
  });
}
