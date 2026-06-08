import type { NextApiRequest, NextApiResponse } from "next";
import { demoRequestInput } from "../../domain/policy/demoData";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../server/apiHelpers";
import { isMemoryMode, memoryTestRules } from "../../server/memoryStore";
import { evaluateDraftInput } from "../../server/policyService";
import { ruleTestSchema } from "../../server/schemas";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  try {
    const input = ruleTestSchema.parse(parseRequestBody(req));

    if (isMemoryMode()) {
      return res.status(200).json(memoryTestRules(input.input, input.draftRule));
    }

    const result = await evaluateDraftInput(
      {
        ...demoRequestInput,
        ...input.input,
      },
      input.draftRule as any,
    );

    return res.status(200).json({ result });
  } catch (error) {
    return handleApiError(res, error);
  }
}
