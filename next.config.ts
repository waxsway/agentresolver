import type { NextConfig } from "next";

const x402Tracing = [
  "./node_modules/@x402/extensions/**/*",
  "./node_modules/@x402/core/**/*",
  "./node_modules/ajv/**/*",
  "./node_modules/fast-deep-equal/**/*",
  "./node_modules/fast-uri/**/*",
  "./node_modules/json-schema-traverse/**/*",
  "./node_modules/require-from-string/**/*"
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/http-inspect": x402Tracing,
    "/api/x402-payment-preflight": x402Tracing
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()"
          },
          {
            key: "X-AgentResolver-Sponsorship",
            value: "https://agentresolver.vercel.app/.well-known/sponsorship.json"
          },
          {
            key: "Link",
            value: "<https://agentresolver.vercel.app/.well-known/agentresolver-trust.json>; rel=\"describedby\"; type=\"application/json\"; title=\"AgentResolver trust contract\", <https://agentresolver.vercel.app/.well-known/agentresolver-evidence.json>; rel=\"describedby\"; type=\"application/json\"; title=\"AgentResolver execution evidence contract\", <https://agentresolver.vercel.app/.well-known/sponsorship.json>; rel=\"describedby\"; type=\"application/json\"; title=\"AgentResolver sponsorship inventory\""
          }
        ]
      }
    ];
  }
};

export default nextConfig;
