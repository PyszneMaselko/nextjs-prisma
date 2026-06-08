import type { NextApiRequest, NextApiResponse } from "next";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../../server/apiHelpers";
import { evaluateMemoryRequest, getMemoryState, isMemoryMode } from "../../../../server/memoryStore";
import { evaluateRequestAndPersist } from "../../../../server/policyService";
import { serializeRequest } from "../../../../server/serializers";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const id = req.query.id as string;
    const body = parseRequestBody(req);

    if (isMemoryMode()) {
      return res.status(200).json({ request: evaluateMemoryRequest(getMemoryState(), id, body.evaluatedById) });
    }

    const request = await evaluateRequestAndPersist(id, body.evaluatedById);
    return res.status(200).json({ request: serializeRequest(request) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
