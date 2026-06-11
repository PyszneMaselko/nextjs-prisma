import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { isMemoryMode, memoryAddAttachment } from "../../../../server/memoryStore";
import {
  createAuditEvent,
  evaluateRequestAndPersist,
  getRequestDetail,
} from "../../../../server/policyService";
import { serializeRequest } from "../../../../server/serializers";
import { attachmentSchema } from "../../../../server/schemas";

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
      return res.status(201).json({ request });
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

    if (input.attachmentType === "DPA") {
      const request = await prisma.request.findUnique({ where: { id: requestId } });
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
      input.attachmentType === "DPA"
        ? await evaluateRequestAndPersist(requestId, input.uploadedById)
        : await getRequestDetail(requestId);

    return res.status(201).json({ request: serializeRequest(request) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
