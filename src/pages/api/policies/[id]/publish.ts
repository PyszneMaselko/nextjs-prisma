import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memoryPublishVersion } from "../../../../server/memoryStore";
import { createAuditEvent } from "../../../../server/policyService";
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
      const result = memoryPublishVersion(policyId, input.versionId);
      if (!result) return res.status(404).json({ error: "Policy not found" });
      return res.status(200).json(result);
    }

    const now = new Date();

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
          status: "PUBLISHED",
          effectiveFrom: now,
          effectiveTo: null,
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
      { policyId },
      input.actorId,
    );

    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: { owner: true, versions: { include: { author: true, rules: true } } },
    });

    return res.status(200).json({ policy: serializePolicy(policy) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
