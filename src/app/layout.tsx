import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://agentresolver.vercel.app"),
  title: "AgentResolver — x402 Payment Preflight & PayTo Verification",
  description:
    "Verify an x402 endpoint before paying: live payTo, USDC quote, network, asset, resource binding, TLS and endpoint safety for $0.001 on Base or Solana.",
  alternates: {
    canonical: "/"
  }
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "AgentResolver",
      url: "https://agentresolver.vercel.app",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      isAccessibleForFree: false,
      description:
        "x402 payment preflight and payTo verification for autonomous agents, plus a free fallback capability resolver.",
      codeRepository: "https://github.com/waxsway/agentresolver",
      license: "https://opensource.org/license/mit"
    },
    {
      "@type": "WebAPI",
      name: "AgentResolver x402 Payment Preflight",
      url: "https://agentresolver.vercel.app/api/x402-payment-preflight",
      documentation: "https://agentresolver.vercel.app/openapi.json",
      description:
        "Verify a live x402 payment challenge, payTo recipient, USDC price, network, asset and resource binding before an agent authorizes spend.",
      provider: {
        "@type": "Organization",
        name: "AgentResolver",
        url: "https://agentresolver.vercel.app"
      }
    }
  ]
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="ard" href="/.well-known/ard.json" />
        <link
          rel="describedby"
          href="/.well-known/agentresolver-trust.json"
          type="application/json"
        />
        <link rel="describedby" href="/llms.txt" type="text/markdown" />
        <link
          rel="alternate"
          href="/llms.txt"
          type="text/markdown"
          title="AgentResolver LLM documentation"
        />
        <link
          rel="service-desc"
          href="/openapi.json"
          type="application/json"
          title="AgentResolver OpenAPI"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
