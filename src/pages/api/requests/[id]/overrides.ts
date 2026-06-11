import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memoryAddOverride } from "../../../../server/memoryStore";
import {
  createAuditEvent,
  getActorRoleCodes,
  getRequestDetail,
  statusForReviewerDecision,
} from "../../../../server/policyService";
import { serializeRequest } from "../../../../server/serializers";
import { manualOverrideSchema } from "../../../../server/schemas";

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
      if ("error" in request) return res.status(409).json({ error: request.error });
      return res.status(201).json({ request });
    }

    const request = await prisma.request.findUnique({ where: { id: requestId } });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }
    if (request.status !== "IN_REVIEW") {
      return res.status(409).json({
        error: "Reviewer decisions can only be recorded for requests in IN_REVIEW.",
      });
    }

    const roleCodes = await getActorRoleCodes(input.createdById);
    if (!roleCodes.some(role => ["REVIEWER", "ADMIN"].includes(role))) {
      return res.status(403).json({
        error: "Only a Reviewer or Admin can record a reviewer decision.",
      });
    }

    const override = await prisma.manualOverride.create({
      data: {
        requestId,
        originalDecision: request.decision,
        newDecision: input.newDecision,
        isException: input.exception,
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
        status: statusForReviewerDecision(input.newDecision, input.exception) as any,
      },
    });

    await createAuditEvent(
      input.exception ? "REQUEST_DECISION_OVERRIDDEN" : "REQUEST_REVIEW_DECIDED",
      "Request",
      requestId,
      {
        overrideId: override.id,
        originalDecision: request.decision,
        newDecision: input.newDecision,
        exception: input.exception,
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
