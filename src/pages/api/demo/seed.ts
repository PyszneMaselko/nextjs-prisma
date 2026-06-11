import type { NextApiRequest, NextApiResponse } from "next";
import { handleApiError, methodNotAllowed } from "../../../server/apiHelpers";
import { getMemoryState, isMemoryMode, resetMemoryState } from "../../../server/memoryStore";
import { deleteStorageObjects } from "../../../server/minioClient";
import { resetDemoData } from "../../../server/policyService";
import { serializeRequest } from "../../../server/serializers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    if (isMemoryMode()) {
      const storageKeys = getMemoryState()
        .requests.flatMap((r: any) => r.attachments)
        .map((a: any) => a.storageKey);
      await deleteStorageObjects(storageKeys);
      return res.status(200).json({ request: resetMemoryState() });
    }

    const request = await resetDemoData();
    return res.status(200).json({ request: serializeRequest(request) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
