import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { handleApiError, methodNotAllowed } from "../../../server/apiHelpers";
import { isMemoryMode, memoryRequestFileAccess } from "../../../server/memoryStore";
import { BUCKET, ensureBucket, isStorageConfigured, serverS3 } from "../../../server/minioClient";
import { getActorRoleCodes } from "../../../server/policyService";
import { canModifyRequestFiles } from "../../../server/requestAccess";

// The file is streamed as the raw request body, so disable Next's JSON body parser for this route.
export const config = { api: { bodyParser: false } };

const readRequestBody = (req: NextApiRequest) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", chunk => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const queryValue = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const requestId = queryValue(req.query.requestId);
    const actorId = queryValue(req.query.actorId);
    const fileName = queryValue(req.query.fileName) || "document";
    const mimeType = queryValue(req.query.mimeType) || "application/octet-stream";

    if (!requestId || !actorId) {
      return res.status(400).json({ error: "requestId and actorId are required" });
    }

    // Same RBAC gate as the rest of the request-file endpoints.
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

    // Always drain the body so the connection completes cleanly.
    const body = await readRequestBody(req);

    // No object storage configured (local demo) — record metadata only so the attachment, the DPA
    // flag and the re-evaluation still happen. The browser never touches the object store directly,
    // which is what made presigned PUT uploads fail cross-origin from localhost.
    if (!isStorageConfigured) {
      return res.status(200).json({ storageKey: `metadata:${fileName}`, stored: false });
    }

    await ensureBucket();
    const storageKey = `requests/${requestId}/${randomUUID()}-${fileName}`;
    await serverS3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: storageKey,
        Body: body,
        ContentType: mimeType,
      }),
    );

    return res.status(200).json({ storageKey, stored: true });
  } catch (error) {
    return handleApiError(res, error);
  }
}
