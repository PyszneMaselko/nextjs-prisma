import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { handleApiError, methodNotAllowed } from "../../../server/apiHelpers";
import {
  isMemoryMode,
  memoryAttachmentRequestId,
  memoryRequestFileAccess,
} from "../../../server/memoryStore";
import { BUCKET, ensureBucket, publicS3 } from "../../../server/minioClient";
import { getActorRoleCodes } from "../../../server/policyService";
import { canReadRequest } from "../../../server/requestAccess";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const { key, actorId } = req.query;
    if (!key || typeof key !== "string" || !actorId || typeof actorId !== "string") {
      return res.status(400).json({ error: "key and actorId are required" });
    }

    if (key.startsWith("metadata:")) {
      return res.status(404).json({ error: "No file stored for this attachment" });
    }

    if (isMemoryMode()) {
      const requestId = memoryAttachmentRequestId(key);
      if (!requestId) return res.status(404).json({ error: "Attachment not found" });
      const access = memoryRequestFileAccess(requestId, actorId, "read");
      if (access === "forbidden") {
        return res.status(403).json({ error: "You do not have permission to download this file." });
      }
    } else {
      const attachment = await prisma.requestAttachment.findFirst({
        where: { storageKey: key },
        select: { request: { select: { requesterId: true } } },
      });
      if (!attachment) return res.status(404).json({ error: "Attachment not found" });
      const roleCodes = await getActorRoleCodes(actorId);
      if (!canReadRequest(roleCodes, actorId, attachment.request.requesterId)) {
        return res.status(403).json({ error: "You do not have permission to download this file." });
      }
    }

    await ensureBucket();

    const downloadUrl = await getSignedUrl(
      publicS3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 300 },
    );

    return res.status(200).json({ downloadUrl });
  } catch (error) {
    return handleApiError(res, error);
  }
}
