import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memoryPublishVersion } from "../../../../server/memoryStore";
import { createAuditEvent, getActorRoleCodes } from "../../../../server/policyService";
import { serializePolicy } from "../../../../server/serializers";

const publishSchema = z.object({
  versionId: z.string().min(1),
  actorId: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const policyId = req.query.id as string;
    const input = publishSchema.parse(parseRequestBody(req));

    if (isMemoryMode()) {
      const result = memoryPublishVersion(policyId, input.versionId, input.actorId);
      if (!result) return res.status(404).json({ error: "Policy not found" });
      if ("error" in result) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    const roleCodes = await getActorRoleCodes(input.actorId);
    if (!roleCodes.includes("POLICY_APPROVER")) {
      return res.status(403).json({ error: "Only a Policy Approver can publish a policy version." });
    }

    const targetVersion = await prisma.policyVersion.findUnique({
      where: { id: input.versionId },
      include: { _count: { select: { rules: true } } },
    });
    if (!targetVersion || targetVersion.policyId !== policyId) {
      return res.status(404).json({ error: "Policy version not found" });
    }
    if (targetVersion.status !== "IN_REVIEW") {
      return res.status(400).json({ error: "Only versions awaiting approval can be published. Submit the version for approval first." });
    }
    if (targetVersion._count.rules === 0) {
      return res.status(400).json({ error: "A policy version without rules cannot be published." });
    }

    const now = new Date();
    const latestPublishedVersion = await prisma.policyVersion.aggregate({
      where: {
        policyId,
        versionNumber: { not: null },
      },
      _max: { versionNumber: true },
    });
    const nextVersionNumber = (latestPublishedVersion._max.versionNumber ?? 0) + 1;

    await prisma.$transaction([
      prisma.policyVersion.updateMany({
        where: {
          policyId,
          status: "PUBLISHED",
          id: { not: input.versionId },
        },
        data: {
          status: "ARCHIVED",
          effectiveTo: now,
        },
      }),
      prisma.policyVersion.update({
        where: { id: input.versionId },
        data: {
          versionNumber: nextVersionNumber,
          status: "PUBLISHED",
          effectiveFrom: now,
          effectiveTo: null,
          approvedById: input.actorId,
          approvedAt: now,
        },
      }),
      prisma.policy.update({
        where: { id: policyId },
        data: {
          status: "PUBLISHED",
          currentVersionId: input.versionId,
        },
      }),
    ]);

    await createAuditEvent(
      "POLICY_VERSION_PUBLISHED",
      "PolicyVersion",
      input.versionId,
      { policyId, versionNumber: nextVersionNumber },
      input.actorId,
    );

    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        owner: true,
        versions: { include: { author: true, approvedBy: true, rules: true } },
      },
    });

    return res.status(200).json({ policy: serializePolicy(policy) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
