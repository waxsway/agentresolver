import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://agentresolver.vercel.app"),
  title: "AgentResolver — Capability Routing for AI Agents",
  description:
    "Free capability resolution for AI agents. Discover, compare, and execute machine services through one interface.",
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
      isAccessibleForFree: true,
      description:
        "Free capability resolver for AI agents that discovers tools, APIs, MCP servers, and x402 machine services.",
      codeRepository: "https://github.com/waxsway/agentresolver",
      license: "https://opensource.org/license/mit"
    },
    {
      "@type": "WebAPI",
      name: "AgentResolver API",
      url: "https://agentresolver.vercel.app/api/resolve",
      documentation: "https://agentresolver.vercel.app/openapi.json",
      description:
        "Machine-readable API for resolving an agent goal into compatible external capabilities and services.",
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
