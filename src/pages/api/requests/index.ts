import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../server/apiHelpers";
import { isMemoryMode, memoryCreateRequest, memoryListRequests } from "../../../server/memoryStore";
import {
  createAuditEvent,
  evaluateRequestAndPersist,
  getRequestDetail,
} from "../../../server/policyService";
import { serializeRequest } from "../../../server/serializers";
import { createRequestSchema } from "../../../server/schemas";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      if (isMemoryMode()) {
        return res.status(200).json(memoryListRequests(req.query));
      }

      const page = Math.max(Number(req.query.page ?? 1), 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 10), 1), 50);
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

      const where: any = {
        ...(req.query.status ? { status: req.query.status } : {}),
        ...(req.query.decision ? { decision: req.query.decision } : {}),
        ...(req.query.category ? { category: req.query.category } : {}),
        ...(req.query.department ? { department: req.query.department } : {}),
        ...(req.query.urgency ? { urgency: req.query.urgency } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { vendorName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [total, requests] = await Promise.all([
        prisma.request.count({ where }),
        prisma.request.findMany({
          where,
          include: {
            requester: true,
            businessOwner: true,
            budgetOwner: true,
            evaluations: {
              orderBy: { evaluatedAt: "desc" },
              take: 1,
            },
            manualOverrides: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return res.status(200).json({
        page,
        pageSize,
        total,
        requests: requests.map(serializeRequest),
      });
    }

    if (req.method === "POST") {
      const input = createRequestSchema.parse(parseRequestBody(req));

      if (isMemoryMode()) {
        return res.status(201).json({ request: memoryCreateRequest(input) });
      }

      const request = await prisma.request.create({
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          category: input.category,
          status: input.mode === "draft" ? "DRAFT" : "SUBMITTED",
          annualCost: input.annualCost,
          currency: input.currency,
          vendorName: input.vendorName,
          vendorCountry: input.vendorCountry.toUpperCase(),
          department: input.department,
          urgency: input.urgency,
          justification: input.justification,
          processesPersonalData: input.processesPersonalData,
          dataCategories: input.dataCategories,
          dataClassification: input.dataClassification,
          hasDpa: input.hasDpa ?? false,
          transfersOutsideEea: input.transfersOutsideEea,
          requiresSecurityQuestionnaire: input.requiresSecurityQuestionnaire,
          vendorRisk: input.vendorRisk,
          inputData: input as any,
          requesterId: input.requesterId,
          businessOwnerId: input.businessOwnerId,
          budgetOwnerId: input.budgetOwnerId || null,
        },
      });

      await createAuditEvent(
        input.mode === "draft" ? "REQUEST_DRAFT_CREATED" : "REQUEST_SUBMITTED",
        "Request",
        request.id,
        { title: input.title, vendorName: input.vendorName },
        input.requesterId,
      );

      const detail =
        input.mode === "submit"
          ? await evaluateRequestAndPersist(request.id, input.requesterId)
          : await getRequestDetail(request.id);

      return res.status(201).json({ request: serializeRequest(detail) });
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (error) {
    return handleApiError(res, error);
  }
}
