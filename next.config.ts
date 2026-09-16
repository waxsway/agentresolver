import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/http-inspect": [
      "./node_modules/@x402/extensions/**/*",
      "./node_modules/ajv/**/*",
      "./node_modules/fast-deep-equal/**/*",
      "./node_modules/fast-uri/**/*",
      "./node_modules/json-schema-traverse/**/*",
      "./node_modules/require-from-string/**/*"
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
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
            value: "<https://agentresolver.vercel.app/.well-known/sponsorship.json>; rel=\"describedby\"; type=\"application/json\"; title=\"AgentResolver sponsorship inventory\""
          }
        ]
      }
    ];
  }
};

export default nextConfig;
