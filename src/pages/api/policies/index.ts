import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../server/apiHelpers";
import { isMemoryMode, memoryCreatePolicy, memoryPolicies } from "../../../server/memoryStore";
import { createAuditEvent } from "../../../server/policyService";
import { serializePolicy } from "../../../server/serializers";
import { policyCreateSchema } from "../../../server/schemas";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      if (isMemoryMode()) {
        return res.status(200).json(memoryPolicies());
      }

      const policies = await prisma.policy.findMany({
        include: {
          owner: true,
          versions: {
            include: {
              author: true,
              approvedBy: true,
              rules: { orderBy: [{ priority: "asc" }, { name: "asc" }] },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: [{ domain: "asc" }, { name: "asc" }],
      });

      return res.status(200).json({ policies: policies.map(serializePolicy) });
    }

    if (req.method === "POST") {
      const input = policyCreateSchema.parse(parseRequestBody(req));

      if (isMemoryMode()) {
        return res.status(201).json(memoryCreatePolicy(input));
      }

      const policy = await prisma.policy.create({
        data: {
          name: input.name,
          description: input.description,
          domain: input.domain,
          status: "DRAFT",
          ownerId: input.ownerId,
          versions: {
            create: {
              versionNumber: null,
              status: "DRAFT",
              effectiveFrom: null,
              authorId: input.ownerId,
              changeSummary: input.changeSummary,
            },
          },
        },
        include: { versions: true },
      });

      const version = policy.versions[0];

      await createAuditEvent(
        "POLICY_CREATED",
        "Policy",
        policy.id,
        { versionId: version.id, domain: input.domain },
        input.ownerId,
      );

      const detail = await prisma.policy.findUnique({
        where: { id: policy.id },
        include: {
          owner: true,
          versions: { include: { author: true, approvedBy: true, rules: true } },
        },
      });

      return res.status(201).json({ policy: serializePolicy(detail) });
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    return handleApiError(res, error);
  }
}
