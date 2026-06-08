import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memoryAddOverride } from "../../../../server/memoryStore";
import { createAuditEvent, getRequestDetail } from "../../../../server/policyService";
import { serializeRequest } from "../../../../server/serializers";
import { manualOverrideSchema } from "../../../../server/schemas";

const statusForOverrideDecision = (decision: string) => {
  switch (decision) {
    case "APPROVED":
      return "APPROVED_WITH_EXCEPTION";
    case "REJECTED":
      return "REJECTED";
    case "MISSING_INFORMATION":
      return "NEEDS_INFORMATION";
    default:
      return "IN_REVIEW";
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const requestId = req.query.id as string;
    const input = manualOverrideSchema.parse(parseRequestBody(req));

    if (isMemoryMode()) {
      const request = memoryAddOverride(requestId, input);
      if (!request) return res.status(404).json({ error: "Request not found" });
      return res.status(201).json({ request });
    }

    const request = await prisma.request.findUnique({ where: { id: requestId } });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const override = await prisma.manualOverride.create({
      data: {
        requestId,
        originalDecision: request.decision,
        newDecision: input.newDecision,
        reason: input.reason,
        comment: input.comment,
        approverId: input.approverId,
        createdById: input.createdById,
        attachmentName: input.attachmentName,
      },
    });

    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: statusForOverrideDecision(input.newDecision) as any,
      },
    });

    await createAuditEvent(
      "REQUEST_DECISION_OVERRIDDEN",
      "Request",
      requestId,
      {
        overrideId: override.id,
        originalDecision: request.decision,
        newDecision: input.newDecision,
        reason: input.reason,
      },
      input.createdById,
    );

    const detail = await getRequestDetail(requestId);
    return res.status(201).json({ request: serializeRequest(detail) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
