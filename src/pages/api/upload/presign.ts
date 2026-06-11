import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../server/apiHelpers";
import { BUCKET, ensureBucket, publicS3 } from "../../../server/minioClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { fileName, mimeType, requestId } = parseRequestBody(req) as {
      fileName: string;
      mimeType: string;
      requestId: string;
    };

    if (!fileName || !requestId) {
      return res.status(400).json({ error: "fileName and requestId are required" });
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
