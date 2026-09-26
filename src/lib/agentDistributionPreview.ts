import type { AgentReadinessReport } from "@/lib/agentReadiness";

export function buildAgentDistributionPreview(report: AgentReadinessReport) {
  const present = report.checks.filter((check) => check.ok).map((check) => check.id);
  const missing = report.checks.filter((check) => !check.ok);

  return {
    product: "AgentResolver Agent Distribution Preview",
    preview: true,
    paid: false,
    target: report.target,
    readiness: {
      score: report.score,
      grade: report.grade,
      presentSurfaceCount: present.length,
      missingSurfaceCount: missing.length
    },
    topGaps: missing.slice(0, 3).map((check) => ({
      id: check.id,
      url: check.url,
      note: check.note
    })),
    nextActions: report.recommendations.slice(0, 2),
    upgrade: {
      product: "Agent Distribution Pack",
      endpoint: "https://agentresolver.vercel.app/api/agent-distribution-pack",
      priceUsd: 5,
      includes: [
        "full machine-readiness diagnosis",
        "ready-to-commit llms.txt",
        "MCP Registry server.json when applicable",
        "crawler-discovery additions",
        "MCP client config when applicable",
        "prioritized publication sequence",
        "distribution-target status"
      ],
      reason:
        "Use the paid pack when you want files to ship and a complete launch sequence, not just the preview diagnosis."
    },
    limitations: [
      "The free preview intentionally omits generated launch artifacts and the full distribution sequence.",
      "External registries control their own inclusion, ranking, review, and commercial terms."
    ]
  };
}
