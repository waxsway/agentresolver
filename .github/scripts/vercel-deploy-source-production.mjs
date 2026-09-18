#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const token = process.env.VERCEL_TOKEN;
const orgId = process.env.VERCEL_ORG_ID;
const projectId = process.env.VERCEL_PROJECT_ID;
const validatedSha = process.env.VALIDATED_SHA;

if (!token) {
  console.error("VERCEL_TOKEN is required.");
  process.exit(1);
}
if (!orgId || !projectId) {
  console.error("VERCEL_ORG_ID and VERCEL_PROJECT_ID are required.");
  process.exit(1);
}
if (!validatedSha || !/^[0-9a-f]{40}$/.test(validatedSha)) {
  console.error("VALIDATED_SHA must be the exact 40-character commit SHA approved by CI.");
  process.exit(1);
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", options.inheritStderr === false ? "pipe" : "inherit"]
  });
  if (result.error) {
    console.error(`Unable to launch ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    if (options.inheritStderr === false && result.stderr) process.stderr.write(result.stderr);
    console.error(`${command} exited with status ${result.status ?? 1}.`);
    process.exit(result.status ?? 1);
  }
  return result.stdout || "";
};

const deployOutput = run("vercel", [
  "deploy",
  "--prod",
  "--skip-domain",
  "--no-wait",
  "--yes",
  `--token=${token}`
]);

const deploymentUrl = [...deployOutput.split(/\r?\n/)]
  .reverse()
  .map((line) => line.trim())
  .find((line) => /^https:\/\//.test(line));

if (!deploymentUrl) {
  console.error("Vercel source deploy returned no deployment URL.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deploymentHost = new URL(deploymentUrl).host;
let deploymentId = "";
let deploymentMeta = null;

for (let attempt = 1; attempt <= 90; attempt += 1) {
  const response = await fetch(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentHost)}?teamId=${encodeURIComponent(orgId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (response.ok) {
    const deployment = await response.json();
    const state = deployment.readyState || deployment.state;
    deploymentId = typeof deployment.id === "string" ? deployment.id : deploymentId;
    deploymentMeta = deployment;
    if (state === "READY") break;
    if (state === "ERROR" || state === "CANCELED") {
      console.error(`Vercel source deployment entered terminal state ${state}.`);
      process.exit(1);
    }
  }

  await sleep(2000);
}

if (!deploymentId || !deploymentMeta || (deploymentMeta.readyState || deploymentMeta.state) !== "READY") {
  console.error("Timed out waiting for staged Vercel source deployment to become READY.");
  process.exit(1);
}
if (deploymentMeta.target !== "production") {
  console.error(`Staged deployment target was ${deploymentMeta.target ?? "unknown"}, expected production.`);
  process.exit(1);
}
if (deploymentMeta.meta?.githubCommitSha !== validatedSha) {
  console.error(
    `Staged deployment Git SHA mismatch: ${deploymentMeta.meta?.githubCommitSha ?? "missing"} != ${validatedSha}.`
  );
  process.exit(1);
}

const workdir = mkdtempSync(join(tmpdir(), "agentresolver-release-"));

function probe(path, expectedStatus) {
  const key = String(Math.random()).slice(2);
  const headersPath = join(workdir, `headers-${key}.txt`);
  const bodyPath = join(workdir, `body-${key}.txt`);

  const statusText = run("vercel", [
    "curl",
    path,
    "--deployment",
    deploymentUrl,
    "--yes",
    `--token=${token}`,
    "--",
    "--silent",
    "--show-error",
    "--dump-header",
    headersPath,
    "--output",
    bodyPath,
    "--write-out",
    "%{http_code}",
    "--header",
    "x-agentresolver-internal: 1",
    "--header",
    "cache-control: no-cache"
  ]).trim();

  const status = Number(statusText.slice(-3));
  const headers = readFileSync(headersPath, "utf8");
  const body = readFileSync(bodyPath, "utf8");
  if (status !== expectedStatus) {
    console.error(`Staged probe ${path} returned HTTP ${status}, expected ${expectedStatus}.`);
    console.error(body.slice(0, 1000));
    process.exit(1);
  }
  return { status, headers, body };
}

try {
  const health = JSON.parse(probe(
    `/api/health?stagedRelease=${encodeURIComponent(validatedSha)}`,
    200
  ).body);

  if (
    health?.ok !== true ||
    health?.paymentRails?.x402CdpCanary !== "coinbase-cdp" ||
    health?.paymentRails?.x402PingBase !== "payai" ||
    health?.paymentRails?.x402PingSolana !== "payai" ||
    health?.paymentRails?.circleGatewayEnabled !== false
  ) {
    console.error("Staged health does not preserve the intended payment-rail split.");
    process.exit(1);
  }

  const cdpChallenge = JSON.parse(probe("/api/x402-cdp-canary", 402).body);
  const cdpAccepts = Array.isArray(cdpChallenge?.accepts) ? cdpChallenge.accepts : [];
  const cdpBase = cdpAccepts.find((item) => item?.network === "eip155:8453");
  if (
    cdpChallenge?.x402Version !== 2 ||
    cdpAccepts.length !== 1 ||
    cdpBase?.amount !== "2000" ||
    cdpBase?.asset !== "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" ||
    cdpBase?.payTo !== "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8"
  ) {
    console.error("Staged CDP canary challenge does not match the required $0.002 Base contract.");
    process.exit(1);
  }

  const pingChallenge = JSON.parse(probe("/api/x402-ping", 402).body);
  const pingAccepts = Array.isArray(pingChallenge?.accepts) ? pingChallenge.accepts : [];
  const payaiBase = pingAccepts.find((item) => item?.network === "eip155:8453");
  const payaiSolana = pingAccepts.find((item) => item?.network === "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
  if (
    pingChallenge?.x402Version !== 2 ||
    payaiBase?.amount !== "1000" ||
    payaiBase?.payTo !== "0x66E19457fFC829E8Ed74706f5c1399C6F6466dE8" ||
    payaiSolana?.amount !== "1000" ||
    payaiSolana?.payTo !== "AoQNzm7dB7dhBXfgq9ywqkfkS68fg2e1JwcxrgXnkLXa"
  ) {
    console.error("Staged canonical x402-ping no longer preserves the $0.001 PayAI Base + Solana contract.");
    process.exit(1);
  }

  const trust = JSON.parse(probe(
    `/.well-known/agentresolver-trust.json?stagedRelease=${encodeURIComponent(validatedSha)}`,
    200
  ).body);
  if (trust?.deployment?.commitSha !== validatedSha || trust?.deployment?.environment !== "production") {
    console.error("Staged trust surface is not bound to the validated production commit.");
    process.exit(1);
  }
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

const promote = await fetch(
  `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/promote/${encodeURIComponent(deploymentId)}?teamId=${encodeURIComponent(orgId)}`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  }
);

if (![200, 201, 202].includes(promote.status)) {
  const body = await promote.text().catch(() => "");
  console.error(`Vercel promote failed with HTTP ${promote.status}: ${body.slice(0, 500)}`);
  process.exit(1);
}

process.stdout.write(deploymentUrl);
