import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { NextApiRequest, NextApiResponse } from "next";
import { handleApiError, methodNotAllowed } from "../../../server/apiHelpers";
import { BUCKET, ensureBucket, publicS3 } from "../../../server/minioClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const { key } = req.query;
    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "key is required" });
    }

    if (key.startsWith("metadata:")) {
      return res.status(404).json({ error: "No file stored for this attachment" });
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
