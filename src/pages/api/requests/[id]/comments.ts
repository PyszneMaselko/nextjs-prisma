import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memoryAddComment } from "../../../../server/memoryStore";
import { createAuditEvent, getRequestDetail } from "../../../../server/policyService";
import { serializeRequest } from "../../../../server/serializers";
import { commentSchema } from "../../../../server/schemas";

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
      return res.status(201).json({ request });
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
    return res.status(201).json({ request: serializeRequest(request) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
