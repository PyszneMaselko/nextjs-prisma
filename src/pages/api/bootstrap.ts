import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import { handleApiError, methodNotAllowed } from "../../server/apiHelpers";
import { isMemoryMode, memoryBootstrap } from "../../server/memoryStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  try {
    if (isMemoryMode()) {
      return res.status(200).json(memoryBootstrap());
    }

    const [users, roles] = await Promise.all([
      prisma.user.findMany({
        include: { roleAssignments: { include: { role: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.role.findMany({ orderBy: { code: "asc" } }),
    ]);

    return res.status(200).json({
      users,
      roles,
      dictionaries: {
        requestTypes: [
          "NEW_VENDOR",
          "NEW_SOFTWARE",
          "SOFTWARE_RENEWAL",
          "CONSULTING_SERVICE",
          "HARDWARE_PURCHASE",
          "EXCEPTION_REQUEST",
        ],
        categories: ["SAAS", "HARDWARE", "CONSULTING", "MARKETING_SERVICE", "CLOUD_SERVICE", "DATA_PROVIDER", "OTHER"],
        currencies: ["EUR", "PLN", "USD", "GBP"],
        departments: ["MARKETING", "ENGINEERING", "FINANCE", "PROCUREMENT", "SECURITY", "LEGAL", "HR", "OPERATIONS"],
        urgency: ["LOW", "NORMAL", "HIGH", "EMERGENCY"],
        vendorRisks: ["LOW", "MEDIUM", "HIGH", "UNKNOWN"],
        decisions: ["APPROVED", "REQUIRES_REVIEW", "REJECTED", "MISSING_INFORMATION"],
      },
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
