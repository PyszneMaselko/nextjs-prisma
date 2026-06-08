import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memoryCreateVersion } from "../../../../server/memoryStore";
import { createAuditEvent } from "../../../../server/policyService";
import { serializePolicy } from "../../../../server/serializers";

const createVersionSchema = z.object({
  authorId: z.string().min(1),
  changeSummary: z.string().min(3),
  copyCurrentRules: z.boolean().default(true),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const policyId = req.query.id as string;
    const input = createVersionSchema.parse(parseRequestBody(req));

    if (isMemoryMode()) {
      const result = memoryCreateVersion(policyId, input);
      if (!result) return res.status(404).json({ error: "Policy not found" });
      return res.status(201).json(result);
    }

    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        versions: {
          include: { rules: true },
          orderBy: { versionNumber: "desc" },
        },
      },
    });

    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }

    const latestVersion = policy.versions[0];
    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const version = await prisma.policyVersion.create({
      data: {
        policyId,
        versionNumber: nextVersionNumber,
        status: "DRAFT",
        authorId: input.authorId,
        changeSummary: input.changeSummary,
        rules:
          input.copyCurrentRules && latestVersion
            ? {
                create: latestVersion.rules.map(rule => ({
                  name: rule.name,
                  description: rule.description,
                  severity: rule.severity,
                  condition: rule.condition as any,
                  effects: rule.effects as any,
                  reason: rule.reason,
                  enabled: rule.enabled,
                  priority: rule.priority,
                })),
              }
            : undefined,
      },
    });

    await prisma.policy.update({
      where: { id: policyId },
      data: { status: "DRAFT" },
    });

    await createAuditEvent(
      "POLICY_VERSION_CREATED",
      "PolicyVersion",
      version.id,
      { policyId, versionNumber: nextVersionNumber },
      input.authorId,
    );

    const detail = await prisma.policy.findUnique({
      where: { id: policyId },
      include: { owner: true, versions: { include: { author: true, rules: true } } },
    });

    return res.status(201).json({ policy: serializePolicy(detail) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
