import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memoryAddAttachment } from "../../../../server/memoryStore";
import {
  createAuditEvent,
  evaluateRequestAndPersist,
  getActorRoleCodes,
  getRequestDetail,
} from "../../../../server/policyService";
import { serializeRequest } from "../../../../server/serializers";
import { attachmentSchema } from "../../../../server/schemas";
import { hideInternalComments } from "../../../../server/requestAccess";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const requestId = req.query.id as string;
    const input = attachmentSchema.parse(parseRequestBody(req));

    if (isMemoryMode()) {
      const request = memoryAddAttachment(requestId, input);
      if (!request) return res.status(404).json({ error: "Request not found" });
      if ("error" in request) return res.status(403).json({ error: request.error });
      return res.status(201).json({ request });
    }

    const accessRequest = await prisma.request.findUnique({
      where: { id: requestId },
      select: { requesterId: true },
    });
    if (!accessRequest) return res.status(404).json({ error: "Request not found" });

    const roleCodes = await getActorRoleCodes(input.uploadedById);
    const canReview = roleCodes.some(role => ["REVIEWER", "ADMIN"].includes(role));
    const ownsRequest =
      roleCodes.includes("REQUESTER") && accessRequest.requesterId === input.uploadedById;
    if (!canReview && !ownsRequest) {
      return res.status(403).json({
        error: "You do not have permission to add attachments to this request.",
      });
    }

    await prisma.requestAttachment.create({
      data: {
        requestId,
        uploadedById: input.uploadedById,
        attachmentType: input.attachmentType,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey ?? `metadata:${input.fileName}`,
      },
    });

    let requestStatus: string | undefined;
    if (input.attachmentType === "DPA") {
      const request = await prisma.request.findUnique({ where: { id: requestId } });
      requestStatus = request?.status;
      const inputData =
        request?.inputData && typeof request.inputData === "object"
          ? (request.inputData as Record<string, unknown>)
          : {};

      await prisma.request.update({
        where: { id: requestId },
        data: {
          hasDpa: true,
          inputData: {
            ...inputData,
            hasDpa: true,
            dpaDocument: input.fileName,
          },
        },
      });
    }

    await createAuditEvent(
      "REQUEST_ATTACHMENT_ADDED",
      "Request",
      requestId,
      { attachmentType: input.attachmentType, fileName: input.fileName },
      input.uploadedById,
    );

    const request =
      input.attachmentType === "DPA" && requestStatus === "NEEDS_INFORMATION"
        ? await evaluateRequestAndPersist(requestId, input.uploadedById)
        : await getRequestDetail(requestId);

    return res.status(201).json({
      request: hideInternalComments(serializeRequest(request), roleCodes),
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
