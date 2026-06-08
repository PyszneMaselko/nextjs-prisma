import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../server/apiHelpers";
import { isMemoryMode, memoryGetRequest, memoryUpdateRequest } from "../../../server/memoryStore";
import {
  createAuditEvent,
  evaluateRequestAndPersist,
  getRequestDetail,
} from "../../../server/policyService";
import { serializeRequest } from "../../../server/serializers";
import { updateRequestSchema } from "../../../server/schemas";

const requestFields = [
  "title",
  "description",
  "type",
  "category",
  "annualCost",
  "currency",
  "vendorName",
  "vendorCountry",
  "department",
  "urgency",
  "justification",
  "processesPersonalData",
  "dataCategories",
  "dataClassification",
  "hasDpa",
  "transfersOutsideEea",
  "requiresSecurityQuestionnaire",
  "vendorRisk",
  "requesterId",
  "businessOwnerId",
  "budgetOwnerId",
] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const id = req.query.id as string;

    if (req.method === "GET") {
      if (isMemoryMode()) {
        const request = memoryGetRequest(id);
        if (!request) return res.status(404).json({ error: "Request not found" });
        return res.status(200).json({ request });
      }

      const request = await getRequestDetail(id);
      if (!request) return res.status(404).json({ error: "Request not found" });
      return res.status(200).json({ request: serializeRequest(request) });
    }

    if (req.method === "PATCH") {
      if (isMemoryMode()) {
        const input = updateRequestSchema.parse(parseRequestBody(req));
        const request = memoryUpdateRequest(id, input);
        if (!request) return res.status(404).json({ error: "Request not found" });
        return res.status(200).json({ request });
      }

      const current = await prisma.request.findUnique({ where: { id } });
      if (!current) return res.status(404).json({ error: "Request not found" });

      const input = updateRequestSchema.parse(parseRequestBody(req));
      const data: any = {};

      requestFields.forEach(field => {
        if (input[field] !== undefined) {
          data[field] = field === "vendorCountry" ? String(input[field]).toUpperCase() : input[field];
        }
      });

      if (input.budgetOwnerId === "") {
        data.budgetOwnerId = null;
      }

      if (input.mode === "draft") {
        data.status = "DRAFT";
      }

      if (input.mode === "submit") {
        data.status = "SUBMITTED";
      }

      const currentInputData =
        current.inputData && typeof current.inputData === "object"
          ? (current.inputData as Record<string, unknown>)
          : {};

      data.inputData = {
        ...currentInputData,
        ...input,
      };

      await prisma.request.update({
        where: { id },
        data,
      });

      await createAuditEvent(
        input.mode === "submit" ? "REQUEST_RESUBMITTED" : "REQUEST_UPDATED",
        "Request",
        id,
        { mode: input.mode ?? "update" },
        input.requesterId,
      );

      const detail =
        input.mode === "submit"
          ? await evaluateRequestAndPersist(id, input.requesterId)
          : await getRequestDetail(id);

      return res.status(200).json({ request: serializeRequest(detail) });
    }

    return methodNotAllowed(res, ["GET", "PATCH"]);
  } catch (error) {
    return handleApiError(res, error);
  }
}
