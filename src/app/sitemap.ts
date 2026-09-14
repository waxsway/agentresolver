import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://agentresolver.example";
  return [{ url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 }];
}
