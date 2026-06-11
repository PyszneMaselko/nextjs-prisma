import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../server/apiHelpers";
import { isMemoryMode, memoryUpdateRule } from "../../../server/memoryStore";
import { createAuditEvent } from "../../../server/policyService";
import { ruleUpdateSchema } from "../../../server/schemas";
import { serializePolicy } from "../../../server/serializers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return methodNotAllowed(res, ["PATCH"]);
  }

  try {
    const ruleId = req.query.id as string;
    const input = ruleUpdateSchema.parse(parseRequestBody(req));

    if (isMemoryMode()) {
      const result = memoryUpdateRule(ruleId, input);
      if (!result) return res.status(404).json({ error: "Rule not found" });
      if ("error" in result) return res.status(409).json({ error: result.error });
      return res.status(200).json(result);
    }

    const existing = await prisma.rule.findUnique({
      where: { id: ruleId },
      include: { policyVersion: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Rule not found" });
    }
    if (existing.policyVersion.status !== "DRAFT") {
      return res.status(409).json({
        error: "Rules can only be edited in DRAFT policy versions.",
      });
    }

    const rule = await prisma.rule.update({
      where: { id: ruleId },
      data: {
        name: input.name,
        description: input.description,
        severity: input.severity,
        condition: input.condition as any,
        effects: input.effects as any,
        reason: input.reason,
        enabled: input.enabled,
        priority: input.priority,
      },
    });

    await createAuditEvent(
      "RULE_UPDATED",
      "Rule",
      rule.id,
      {
        policyId: existing.policyVersion.policyId,
        policyVersionId: existing.policyVersionId,
      },
      existing.policyVersion.authorId,
    );

    const policy = await prisma.policy.findUnique({
      where: { id: existing.policyVersion.policyId },
      include: {
        owner: true,
        versions: { include: { author: true, approvedBy: true, rules: true } },
      },
    });

    return res.status(200).json({ policy: serializePolicy(policy), rule });
  } catch (error) {
    return handleApiError(res, error);
  }
}
