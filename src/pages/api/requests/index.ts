import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { handleApiError, methodNotAllowed, parseRequestBody } from "../../../server/apiHelpers";
import {
  isMemoryMode,
  memoryActorRoleCodes,
  memoryCreateRequest,
  memoryListRequests,
} from "../../../server/memoryStore";
import {
  createAuditEvent,
  evaluateRequestAndPersist,
  getActorRoleCodes,
  getRequestDetail,
} from "../../../server/policyService";
import { serializeRequest } from "../../../server/serializers";
import { createRequestSchema } from "../../../server/schemas";
import { canListRequests } from "../../../server/requestAccess";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const actorId = typeof req.query.actorId === "string" ? req.query.actorId : "";
      if (!actorId) {
        return res.status(400).json({ error: "actorId is required." });
      }

      if (isMemoryMode()) {
        const roleCodes = memoryActorRoleCodes(actorId);
        if (!canListRequests(roleCodes)) {
          return res.status(403).json({ error: "You do not have permission to list requests." });
        }
        const query = {
          ...req.query,
          requesterId:
            roleCodes.includes("REQUESTER") &&
            !roleCodes.some(role => ["REVIEWER", "AUDITOR", "POLICY_OWNER", "ADMIN"].includes(role))
              ? actorId
              : req.query.requesterId,
        };
        return res.status(200).json(memoryListRequests(query));
      }

      const roleCodes = await getActorRoleCodes(actorId);
      if (!canListRequests(roleCodes)) {
        return res.status(403).json({ error: "You do not have permission to list requests." });
      }
      const page = Math.max(Number(req.query.page ?? 1), 1);
      const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 10), 1), 50);
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const sortDirection = req.query.sort === "oldest" ? "asc" : "desc";

      const requesterScope =
        roleCodes.includes("REQUESTER") &&
        !roleCodes.some(role => ["REVIEWER", "AUDITOR", "POLICY_OWNER", "ADMIN"].includes(role))
          ? actorId
          : req.query.requesterId;
      const where: any = {
        ...(req.query.status ? { status: req.query.status } : {}),
        ...(req.query.decision ? { decision: req.query.decision } : {}),
        ...(req.query.category ? { category: req.query.category } : {}),
        ...(req.query.department ? { department: req.query.department } : {}),
        ...(req.query.urgency ? { urgency: req.query.urgency } : {}),
        ...(requesterScope ? { requesterId: requesterScope } : {}),
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
          orderBy: { createdAt: sortDirection },
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
        const request = memoryCreateRequest(input);
        if ("error" in request) return res.status(403).json({ error: request.error });
        return res.status(201).json({ request });
      }

      const roleCodes = await getActorRoleCodes(input.requesterId);
      if (!roleCodes.some(role => ["REQUESTER", "ADMIN"].includes(role))) {
        return res.status(403).json({ error: "Only a Requester or Admin can create a request." });
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
