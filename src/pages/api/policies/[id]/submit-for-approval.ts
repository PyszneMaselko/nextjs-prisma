import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memorySubmitVersionForApproval } from "../../../../server/memoryStore";
import { createAuditEvent, getActorRoleCodes } from "../../../../server/policyService";
import { serializePolicy } from "../../../../server/serializers";

const submitSchema = z.object({
  versionId: z.string().min(1),
  actorId: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const policyId = req.query.id as string;
    const input = submitSchema.parse(parseRequestBody(req));

    if (isMemoryMode()) {
      const result = memorySubmitVersionForApproval(policyId, input.versionId, input.actorId);
      if (!result) return res.status(404).json({ error: "Policy or version not found" });
      if ("error" in result) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    const roleCodes = await getActorRoleCodes(input.actorId);
    if (!roleCodes.includes("POLICY_OWNER")) {
      return res.status(403).json({ error: "Only a Policy Owner can submit a version for approval." });
    }

    const [policyRecord, version, ruleCount] = await Promise.all([
      prisma.policy.findUnique({ where: { id: policyId } }),
      prisma.policyVersion.findUnique({ where: { id: input.versionId } }),
      prisma.rule.count({ where: { policyVersionId: input.versionId } }),
    ]);
    if (!policyRecord) {
      return res.status(404).json({ error: "Policy not found" });
    }
    if (!version || version.policyId !== policyId) {
      return res.status(404).json({ error: "Policy version not found" });
    }
    if (version.status !== "DRAFT") {
      return res.status(400).json({ error: "Only DRAFT versions can be submitted for approval." });
    }
    if (ruleCount === 0) {
      return res.status(400).json({
        error: "Add and save at least one rule before submitting the version for approval.",
      });
    }

    await prisma.$transaction([
      prisma.policyVersion.update({
        where: { id: input.versionId },
        data: { status: "IN_REVIEW" },
      }),
      prisma.policy.update({
        where: { id: policyId },
        data: { status: policyRecord.currentVersionId ? "PUBLISHED" : "IN_REVIEW" },
      }),
    ]);

    await createAuditEvent(
      "POLICY_VERSION_SUBMITTED_FOR_APPROVAL",
      "PolicyVersion",
      input.versionId,
      { policyId },
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
