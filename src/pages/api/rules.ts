import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../server/apiHelpers";
import { isMemoryMode, memoryCreateRule } from "../../server/memoryStore";
import { createAuditEvent } from "../../server/policyService";
import { serializePolicy } from "../../server/serializers";
import { ruleCreateSchema } from "../../server/schemas";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const input = ruleCreateSchema.parse(parseRequestBody(req));

    if (isMemoryMode()) {
      const result = memoryCreateRule(input);
      if (!result) return res.status(404).json({ error: "Policy version not found" });
      return res.status(201).json(result);
    }

    const version = await prisma.policyVersion.findUnique({
      where: { id: input.policyVersionId },
      include: { policy: true },
    });

    if (!version) {
      return res.status(404).json({ error: "Policy version not found" });
    }

    if (!["DRAFT", "IN_REVIEW"].includes(version.status)) {
      return res.status(409).json({
        error: "Rules can only be added to DRAFT or IN_REVIEW policy versions.",
      });
    }

    const rule = await prisma.rule.create({
      data: {
        policyVersionId: input.policyVersionId,
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
      "RULE_CREATED",
      "Rule",
      rule.id,
      { policyId: version.policyId, policyVersionId: input.policyVersionId },
      version.authorId,
    );

    const policy = await prisma.policy.findUnique({
      where: { id: version.policyId },
      include: { owner: true, versions: { include: { author: true, rules: true } } },
    });

    return res.status(201).json({ policy: serializePolicy(policy), rule });
  } catch (error) {
    return handleApiError(res, error);
  }
}
