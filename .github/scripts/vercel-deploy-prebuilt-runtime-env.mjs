#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";

const envFile = process.argv[2] || ".vercel/.env.production.local";
const token = process.env.VERCEL_TOKEN;
const orgId = process.env.VERCEL_ORG_ID;
const projectId = process.env.VERCEL_PROJECT_ID;

if (!token) {
  console.error("VERCEL_TOKEN is required.");
  process.exit(1);
}
if (!orgId || !projectId) {
  console.error("VERCEL_ORG_ID and VERCEL_PROJECT_ID are required.");
  process.exit(1);
}

let parsed;
try {
  parsed = parseEnv(readFileSync(envFile, "utf8"));
} catch (error) {
  console.error(`Unable to parse Vercel runtime env file: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
}

const envResponse = await fetch(
  `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/env?teamId=${encodeURIComponent(orgId)}`,
  { headers: { Authorization: `Bearer ${token}` } }
);

if (!envResponse.ok) {
  console.error(`Unable to read Vercel project environment metadata (HTTP ${envResponse.status}).`);
  process.exit(1);
}

const envPayload = await envResponse.json();
const productionKeys = new Set();
for (const item of Array.isArray(envPayload?.envs) ? envPayload.envs : []) {
  if (!item || typeof item !== "object" || typeof item.key !== "string") continue;
  const targets = Array.isArray(item.target) ? item.target : [item.target].filter(Boolean);
  if (!targets.includes("production")) continue;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.key)) continue;
  if (item.key.startsWith("VERCEL_") || item.key.startsWith("GITHUB_") || item.key === "CI") continue;
  productionKeys.add(item.key);
}

const runtimeValues = new Map();
for (const key of productionKeys) {
  const injected = process.env[key];
  const pulled = parsed[key];
  const value =
    typeof injected === "string" && injected.length > 0
      ? injected
      : typeof pulled === "string"
        ? pulled
        : "";
  if (value.length > 0) runtimeValues.set(key, value);
}

const cdpEnabled = runtimeValues.get("AGENTRESOLVER_CDP_FACILITATOR_ENABLED") === "1";
if (cdpEnabled) {
  const hasId = ["CDP_API_KEY_ID", "CDI_API_KEY_ID"].some((key) => runtimeValues.has(key));
  const hasSecret = [
    "CDP_API_KEY_SECRET",
    "CDP_API_SECRET",
    "CDI_API_KEY_SECRET",
    "CDI_API_SECRET"
  ].some((key) => runtimeValues.has(key));
  if (!hasId || !hasSecret) {
    console.error(
      "CDP is enabled but the production runtime environment did not provide both a supported API key ID and API key secret alias."
    );
    process.exit(1);
  }
}

const args = ["deploy", "--prebuilt", "--prod", "--no-wait", `--token=${token}`];
let forwarded = 0;

for (const [key, value] of runtimeValues) {
  if (/(SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|KEY_ID)/i.test(key)) {
    console.error(`::add-mask::${value}`);
  }
  args.push("--env", `${key}=${value}`);
  forwarded += 1;
}

if (forwarded === 0) {
  console.error("No production project environment variables were available for runtime forwarding.");
  process.exit(1);
}

console.error(`Forwarding ${forwarded} production project environment variables to the deployment runtime.`);

const result = spawnSync("vercel", args, {
  cwd: process.cwd(),
  env: process.env,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"]
});

if (result.error) {
  console.error(`Unable to launch Vercel CLI: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`Vercel deploy failed with exit code ${result.status ?? 1}.`);
  process.exit(result.status ?? 1);
}

const output = (result.stdout || "").trim();
const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const deploymentUrl = [...lines].reverse().find((line) => /^https:\/\//.test(line));
if (!deploymentUrl) {
  console.error("Vercel deploy completed but no deployment URL was returned.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deploymentHost = new URL(deploymentUrl).host;
let deploymentId = "";
let ready = false;

for (let attempt = 1; attempt <= 60; attempt += 1) {
  const response = await fetch(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentHost)}?teamId=${encodeURIComponent(orgId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (response.ok) {
    const deployment = await response.json();
    deploymentId = typeof deployment.id === "string" ? deployment.id : deploymentId;
    const state = deployment.readyState || deployment.state;
    if (state === "READY") {
      ready = true;
      break;
    }
    if (state === "ERROR" || state === "CANCELED") {
      console.error(`Vercel deployment entered terminal state ${state}.`);
      process.exit(1);
    }
  }

  await sleep(2000);
}

if (!ready || !deploymentId) {
  console.error("Timed out waiting for prebuilt deployment to become READY.");
  process.exit(1);
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
