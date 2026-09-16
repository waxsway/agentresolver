import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://agentresolver.vercel.app");

  const now = new Date();
  const weekly = (path: string, priority: number) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority
  });

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    weekly("/docs", 0.9),
    weekly("/providers", 0.8),
    weekly("/agentresolver.md", 0.95),
    weekly("/integrations.json", 0.95),
    weekly("/llms.txt", 0.9),
    weekly("/llms-full.txt", 0.8),
    weekly("/openapi.json", 0.9),
    {
      url: `${base}/capabilities.json`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: `${base}/.well-known/ard.json`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: `${base}/.well-known/ai-catalog.json`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9
    },
    weekly("/.well-known/ai-plugin.json", 0.9),
    weekly("/.well-known/mcp.json", 0.9),
    weekly("/.well-known/mcp/server-card.json", 0.9),
    weekly("/mcp/server-card", 0.9),
    weekly("/legal", 0.5)
  ];
}
