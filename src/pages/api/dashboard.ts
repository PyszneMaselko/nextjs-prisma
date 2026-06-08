import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { handleApiError, methodNotAllowed } from "../../server/apiHelpers";
import { isMemoryMode, memoryDashboard } from "../../server/memoryStore";

const increment = (map: Record<string, number>, key: string) => {
  map[key] = (map[key] ?? 0) + 1;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    if (isMemoryMode()) {
      return res.status(200).json(memoryDashboard());
    }

    const [
      totalRequests,
      autoApproved,
      requiresReview,
      missingInformation,
      rejected,
      statusGroups,
      decisionGroups,
      requestsWithEvaluation,
      matches,
      evaluations,
    ] = await Promise.all([
      prisma.request.count(),
      prisma.request.count({ where: { status: "AUTO_APPROVED" } }),
      prisma.request.count({ where: { status: "IN_REVIEW" } }),
      prisma.request.count({ where: { status: "NEEDS_INFORMATION" } }),
      prisma.request.count({ where: { status: "REJECTED" } }),
      prisma.request.groupBy({ by: ["status"], _count: true }),
      prisma.request.groupBy({ by: ["decision"], _count: true }),
      prisma.request.findMany({
        include: { evaluations: { orderBy: { evaluatedAt: "asc" }, take: 1 } },
        take: 200,
      }),
      prisma.policyEvaluationRuleMatch.findMany({
        where: { matched: true },
        take: 200,
      }),
      prisma.policyEvaluation.findMany({
        orderBy: { evaluatedAt: "desc" },
        take: 200,
      }),
    ]);

    const decidedRequests = requestsWithEvaluation.filter(request => request.evaluations[0]);
    const averageDecisionMs =
      decidedRequests.length === 0
        ? 0
        : Math.round(
            decidedRequests.reduce((sum, request) => {
              const evaluatedAt = request.evaluations[0].evaluatedAt.getTime();
              return sum + (evaluatedAt - request.createdAt.getTime());
            }, 0) / decidedRequests.length,
          );

    const ruleHits: Record<string, number> = {};
    matches.forEach(match => {
      const snapshot = match.ruleSnapshot as any;
      increment(ruleHits, snapshot.ruleName ?? "Nieznana reguła");
    });

    const missingFields: Record<string, number> = {};
    evaluations.forEach(evaluation => {
      const result = evaluation.resultSnapshot as any;
      (result.missingFields ?? []).forEach((field: any) =>
        increment(missingFields, field.label ?? field.field ?? "Nieznane pole"),
      );
    });

    return res.status(200).json({
      totalRequests,
      autoApproved,
      requiresReview,
      missingInformation,
      rejected,
      averageDecisionMs,
      byStatus: statusGroups.map(group => ({ key: group.status, count: group._count })),
      byDecision: decisionGroups.map(group => ({ key: group.decision ?? "NONE", count: group._count })),
      topRuleHits: Object.entries(ruleHits)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topMissingFields: Object.entries(missingFields)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
