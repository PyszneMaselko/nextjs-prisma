import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memoryRejectVersion } from "../../../../server/memoryStore";
import { createAuditEvent, getActorRoleCodes } from "../../../../server/policyService";
import { serializePolicy } from "../../../../server/serializers";

const rejectSchema = z.object({
  versionId: z.string().min(1),
  actorId: z.string().min(1),
  reason: z.string().min(3),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const policyId = req.query.id as string;
    const input = rejectSchema.parse(parseRequestBody(req));

    if (isMemoryMode()) {
      const result = memoryRejectVersion(policyId, input.versionId, input.actorId, input.reason);
      if (!result) return res.status(404).json({ error: "Policy or version not found" });
      if ("error" in result) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    const roleCodes = await getActorRoleCodes(input.actorId);
    if (!roleCodes.includes("POLICY_APPROVER")) {
      return res.status(403).json({ error: "Only a Policy Approver can reject a version." });
    }

    const [policyRecord, version] = await Promise.all([
      prisma.policy.findUnique({ where: { id: policyId } }),
      prisma.policyVersion.findUnique({ where: { id: input.versionId } }),
    ]);
    if (!policyRecord) {
      return res.status(404).json({ error: "Policy not found" });
    }
    if (!version || version.policyId !== policyId) {
      return res.status(404).json({ error: "Policy version not found" });
    }
    if (version.status !== "IN_REVIEW") {
      return res.status(400).json({ error: "Only versions awaiting approval can be rejected." });
    }

    await prisma.$transaction([
      prisma.policyVersion.update({
        where: { id: input.versionId },
        data: { status: "DRAFT" },
      }),
      prisma.policy.update({
        where: { id: policyId },
        data: { status: policyRecord.currentVersionId ? "PUBLISHED" : "DRAFT" },
      }),
    ]);

    await createAuditEvent(
      "POLICY_VERSION_REJECTED",
      "PolicyVersion",
      input.versionId,
      { policyId, reason: input.reason },
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
