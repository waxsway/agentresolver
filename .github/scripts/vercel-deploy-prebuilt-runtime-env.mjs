#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";

const envFile = process.argv[2] || ".vercel/.env.production.local";
const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error("VERCEL_TOKEN is required.");
  process.exit(1);
}

let parsed;
try {
  parsed = parseEnv(readFileSync(envFile, "utf8"));
} catch (error) {
  console.error(`Unable to parse Vercel runtime env file: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
}

const args = ["deploy", "--prebuilt", "--prod", `--token=${token}`];
let forwarded = 0;

for (const [key, value] of Object.entries(parsed)) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
  if (key.startsWith("VERCEL_") || key.startsWith("GITHUB_") || key === "CI") continue;
  if (typeof value !== "string") continue;

  if (/(SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|KEY_ID)/i.test(key) && value.length > 0) {
    console.error(`::add-mask::${value}`);
  }

  args.push("--env", `${key}=${value}`);
  forwarded += 1;
}

if (forwarded === 0) {
  console.error("No production project environment variables were available for runtime forwarding.");
  process.exit(1);
}

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

process.stdout.write(deploymentUrl);
