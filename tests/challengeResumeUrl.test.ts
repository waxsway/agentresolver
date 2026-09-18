import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  normalizeX402ChallengeResumeUrl,
  x402BuyerSetupChallengeUrl
} from "../src/lib/x402BuyerSetup";
import { GET as getBuyerSetup } from "../src/app/api/x402-client-setup/route";
import { GET as getPing } from "../src/app/api/x402-ping/route";

test("challenged resume URLs preserve bounded same-origin query state", () => {
  assert.equal(
    normalizeX402ChallengeResumeUrl(
      "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check&_vercel_share=internal",
      "/api/x402-ping"
    ),
    "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check"
  );
  assert.equal(
    normalizeX402ChallengeResumeUrl(
      "https://evil.example/api/x402-ping?echo=buyer-check",
      "/api/x402-ping"
    ),
    null
  );
  assert.equal(
    normalizeX402ChallengeResumeUrl(
      "https://agentresolver.vercel.app/api/payment-guard?url=https%3A%2F%2Fexample.com",
      "/api/x402-ping"
    ),
    null
  );
});

test("buyer setup handoff can carry the exact challenged URL", () => {
  const resumeUrl = "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check";
  const setup = x402BuyerSetupChallengeUrl("x402-ping", "GET", resumeUrl);
  const parsed = new URL(setup);

  assert.equal(parsed.searchParams.get("source"), "x402-challenge");
  assert.equal(parsed.searchParams.get("capabilityId"), "x402-ping");
  assert.equal(parsed.searchParams.get("method"), "GET");
  assert.equal(parsed.searchParams.get("resumeUrl"), resumeUrl);
});

test("live x402 challenge hands setup the exact GET purchase URL", async () => {
  const response = await getPing(new NextRequest(
    "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check&_vercel_share=internal",
    { headers: { "user-agent": "agentresolver-test" } }
  ));

  assert.equal(response.status, 402);
  const setupHeader = response.headers.get("x-agentresolver-buyer-setup");
  assert.ok(setupHeader);
  const setupUrl = new URL(setupHeader);
  assert.equal(setupUrl.searchParams.get("method"), "GET");
  assert.equal(
    setupUrl.searchParams.get("resumeUrl"),
    "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check"
  );

  const body = await response.json() as any;
  assert.equal(body.buyerSetup?.method, "GET");
  assert.equal(body.buyerSetup?.setup, setupHeader);
  assert.equal(String(body.buyerSetup?.setup).includes("_vercel_share"), false);
});

test("buyer setup returns the exact validated resume URL and rejects injected origins", async () => {
  const exact = "https://agentresolver.vercel.app/api/x402-ping?echo=buyer-check";
  const requestUrl = new URL("https://agentresolver.vercel.app/api/x402-client-setup");
  requestUrl.searchParams.set("source", "x402-challenge");
  requestUrl.searchParams.set("capabilityId", "x402-ping");
  requestUrl.searchParams.set("method", "GET");
  requestUrl.searchParams.set("resumeUrl", exact);

  const response = await getBuyerSetup(new Request(requestUrl, {
    headers: { "user-agent": "agentresolver-test" }
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-agentresolver-resume-url"), exact);
  assert.equal(response.headers.get("x-agentresolver-resume-method"), "GET");
  const body = await response.json() as any;
  assert.equal(body.challengeContext?.resumeUrl, exact);
  assert.equal(body.challengeContext?.method, "GET");

  const injected = new URL(requestUrl);
  injected.searchParams.set("resumeUrl", "https://evil.example/api/x402-ping?echo=buyer-check");
  const rejected = await getBuyerSetup(new Request(injected, {
    headers: { "user-agent": "agentresolver-test" }
  }));
  assert.equal(
    rejected.headers.get("x-agentresolver-resume-url"),
    "https://agentresolver.vercel.app/api/x402-ping"
  );
});
