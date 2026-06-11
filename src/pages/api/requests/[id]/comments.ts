import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memoryAddComment } from "../../../../server/memoryStore";
import {
  createAuditEvent,
  getActorRoleCodes,
  getRequestDetail,
} from "../../../../server/policyService";
import { serializeRequest } from "../../../../server/serializers";
import { commentSchema } from "../../../../server/schemas";
import { hideInternalComments } from "../../../../server/requestAccess";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const requestId = req.query.id as string;
    const input = commentSchema.parse(parseRequestBody(req));

    if (isMemoryMode()) {
      const request = memoryAddComment(requestId, input);
      if (!request) return res.status(404).json({ error: "Request not found" });
      if ("error" in request) return res.status(403).json({ error: request.error });
      return res.status(201).json({ request });
    }

    const requestRecord = await prisma.request.findUnique({
      where: { id: requestId },
      select: { requesterId: true },
    });
    if (!requestRecord) return res.status(404).json({ error: "Request not found" });

    const roleCodes = await getActorRoleCodes(input.authorId);
    const canReview = roleCodes.some(role => ["REVIEWER", "ADMIN"].includes(role));
    const ownsRequest =
      roleCodes.includes("REQUESTER") && requestRecord.requesterId === input.authorId;
    if (!canReview && !ownsRequest) {
      return res.status(403).json({ error: "You do not have permission to comment on this request." });
    }
    if (!canReview && input.visibility === "INTERNAL") {
      return res.status(403).json({
        error: "Internal comments are only available to Reviewers and Admins.",
      });
    }

    await prisma.requestComment.create({
      data: {
        requestId,
        authorId: input.authorId,
        visibility: input.visibility,
        body: input.body,
      },
    });

    await createAuditEvent(
      "REQUEST_COMMENT_ADDED",
      "Request",
      requestId,
      { visibility: input.visibility },
      input.authorId,
    );

    const request = await getRequestDetail(requestId);
    return res.status(201).json({
      request: hideInternalComments(serializeRequest(request), roleCodes),
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
