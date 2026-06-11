import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../server/apiHelpers";
import {
  isMemoryMode,
  memoryRequestFileAccess,
} from "../../../server/memoryStore";
import { BUCKET, ensureBucket, publicS3 } from "../../../server/minioClient";
import { getActorRoleCodes } from "../../../server/policyService";
import { canModifyRequestFiles } from "../../../server/requestAccess";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { fileName, mimeType, requestId, actorId } = parseRequestBody(req) as {
      fileName: string;
      mimeType: string;
      requestId: string;
      actorId: string;
    };

    if (!fileName || !requestId || !actorId) {
      return res.status(400).json({ error: "fileName, requestId and actorId are required" });
    }

    if (isMemoryMode()) {
      const access = memoryRequestFileAccess(requestId, actorId, "write");
      if (access === "not-found") return res.status(404).json({ error: "Request not found" });
      if (access === "forbidden") {
        return res.status(403).json({ error: "You do not have permission to upload this file." });
      }
    } else {
      const request = await prisma.request.findUnique({
        where: { id: requestId },
        select: { requesterId: true },
      });
      if (!request) return res.status(404).json({ error: "Request not found" });
      const roleCodes = await getActorRoleCodes(actorId);
      if (!canModifyRequestFiles(roleCodes, actorId, request.requesterId)) {
        return res.status(403).json({ error: "You do not have permission to upload this file." });
      }
    }

    await ensureBucket();

    const storageKey = `requests/${requestId}/${randomUUID()}-${fileName}`;

    const uploadUrl = await getSignedUrl(
      publicS3,
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: storageKey,
        ContentType: mimeType ?? "application/octet-stream",
      }),
      { expiresIn: 300 },
    );

    return res.status(200).json({ uploadUrl, storageKey });
  } catch (error) {
    return handleApiError(res, error);
  }
}
