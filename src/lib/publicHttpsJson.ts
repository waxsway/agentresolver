import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 32_000;
const TIMEOUT_MS = 1_500;

function stripIpv6Brackets(hostname: string) {
  return hostname.replace(/^\[/, "").replace(/\]$/, "");
}

function blockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) return true;

  const [a, b, c] = parts;
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

export function validatePublicHttpsUrl(input: string): URL {
  const url = new URL(input);
  if (url.protocol !== "https:") {
    throw new Error("Only public HTTPS URLs are supported.");
  }
  if (url.username || url.password) {
    throw new Error("Credential-bearing URLs are not supported.");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Custom ports are not supported.");
  }

  const host = stripIpv6Brackets(url.hostname)
    .replace(/\.$/, "")
    .toLowerCase();

  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    throw new Error("Private or local hosts are not supported.");
  }

  if (isIP(host) && blockedAddress(host)) {
    throw new Error("Private or reserved targets are not supported.");
  }

  url.hash = "";
  return url;
}

async function resolvePublicAddress(hostname: string) {
  const host = stripIpv6Brackets(hostname).replace(/\.$/, "").toLowerCase();

  if (isIP(host)) {
    if (blockedAddress(host)) {
      throw new Error("Private or reserved targets are not supported.");
    }
    return { address: host, family: isIP(host) as 4 | 6 };
  }

  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("Target did not resolve.");
  if (addresses.some((entry) => blockedAddress(entry.address))) {
    throw new Error("Target resolves to a private or reserved address.");
  }

  return addresses[0];
}

export async function fetchPublicJson(
  input: string,
  options: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<{ status: number; url: string; json: unknown; contentType: string | null }> {
  const url = validatePublicHttpsUrl(input);
  const resolved = await resolvePublicAddress(url.hostname);
  const originalHost = stripIpv6Brackets(url.hostname);
  const timeoutMs = Math.max(250, Math.min(options.timeoutMs ?? TIMEOUT_MS, 5_000));
  const maxBytes = Math.max(1_024, Math.min(options.maxBytes ?? MAX_BYTES, 128_000));

  return await new Promise((resolve, reject) => {
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
      method: "GET",
      servername: isIP(originalHost) ? undefined : originalHost,
      rejectUnauthorized: true,
      headers: {
        Host: url.host,
        Accept: "application/json",
        "User-Agent": "AgentResolver-Provider-Manifest/0.1",
        Connection: "close"
      },
      timeout: timeoutMs
    }, (res) => {
      const status = res.statusCode || 0;
      const contentTypeRaw = res.headers["content-type"];
      const contentType = Array.isArray(contentTypeRaw)
        ? contentTypeRaw.join(", ")
        : typeof contentTypeRaw === "string"
          ? contentTypeRaw
          : null;
      const chunks: Buffer[] = [];
      let bytes = 0;

      res.on("data", (chunk: Buffer | string) => {
        if (settled) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > maxBytes) {
          res.destroy();
          finish(() => reject(new Error("JSON response exceeded the maximum size.")));
          return;
        }
        chunks.push(buffer);
      });

      res.on("end", () => {
        if (settled) return;
        const body = Buffer.concat(chunks).toString("utf8");
        let json: unknown = null;
        try {
          json = body ? JSON.parse(body) : null;
        } catch {
          finish(() => reject(new Error("Target did not return valid JSON.")));
          return;
        }
        finish(() => resolve({
          status,
          url: url.toString(),
          json,
          contentType
        }));
      });

      res.on("error", (error) => {
        finish(() => reject(error));
      });
    });

    req.on("timeout", () => req.destroy(new Error("Public JSON fetch timed out.")));
    req.on("error", (error) => finish(() => reject(error)));
    req.end();
  });
}
