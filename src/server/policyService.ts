import {
  Decision,
  PolicyEvaluationResult,
  PolicyVersionDefinition,
  RequestInput,
} from "../domain/policy/types";
import {
  demoPendingApprovalVersion,
  demoPolicyVersions,
  demoRoles,
  demoSeedRequests,
  demoUsers,
} from "../domain/policy/demoData";
import { evaluatePolicyVersions } from "../domain/policy/ruleEngine";
import { prisma } from "../lib/prisma";
import { deleteStorageObjects } from "./minioClient";

export const requestStatusForDecision = (decision: Decision) => {
  switch (decision) {
    case "APPROVED":
      return "AUTO_APPROVED";
    case "MISSING_INFORMATION":
      return "NEEDS_INFORMATION";
    case "REQUIRES_REVIEW":
      return "IN_REVIEW";
    case "REJECTED":
      return "REJECTED";
  }
};

// A human reviewer decision (UC-3 / UC-9) follows the IN_REVIEW -> {APPROVED, REJECTED,
// APPROVED_WITH_EXCEPTION} branch of the state machine. Unlike the automatic path, a manual
// approval is a plain APPROVED unless it is explicitly recorded as an exception.
export const statusForReviewerDecision = (decision: Decision, exception = false) => {
  switch (decision) {
    case "APPROVED":
      return exception ? "APPROVED_WITH_EXCEPTION" : "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "MISSING_INFORMATION":
      return "NEEDS_INFORMATION";
    case "REQUIRES_REVIEW":
    default:
      return "IN_REVIEW";
  }
};

export const buildRequestInput = (request: any): RequestInput => {
  const inputData =
    request.inputData && typeof request.inputData === "object"
      ? (request.inputData as Record<string, unknown>)
      : {};
  const dpaAttachment = request.attachments?.find((attachment: any) => attachment.attachmentType === "DPA");

  return {
    ...inputData,
    id: request.id,
    title: request.title,
    description: request.description,
    type: request.type,
    category: request.category,
    annualCost: Number(request.annualCost),
    currency: request.currency,
    vendorName: request.vendorName,
    vendorCountry: request.vendorCountry,
    department: request.department,
    urgency: request.urgency,
    justification: request.justification,
    processesPersonalData: request.processesPersonalData,
    dataCategories: request.dataCategories ?? [],
    dataClassification: request.dataClassification,
    hasDpa: request.hasDpa ?? Boolean(dpaAttachment),
    transfersOutsideEea: request.transfersOutsideEea,
    requiresSecurityQuestionnaire: request.requiresSecurityQuestionnaire,
    vendorRisk: request.vendorRisk,
    dpaDocument: dpaAttachment?.fileName ?? inputData.dpaDocument ?? "",
    emergencyJustification: inputData.emergencyJustification ?? "",
  };
};

const toPolicyVersionDefinition = (version: any): PolicyVersionDefinition => {
  if (typeof version.versionNumber !== "number") {
    throw new Error("A policy version must have a publication number before evaluation.");
  }

  return {
    id: version.id,
    policyId: version.policyId,
    policyName: version.policy.name,
    policyDomain: version.policy.domain,
    versionNumber: version.versionNumber,
    rules: version.rules.map((rule: any) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      condition: rule.condition,
      effects: rule.effects,
      reason: rule.reason,
      enabled: rule.enabled,
      priority: rule.priority,
      policyId: version.policyId,
      policyName: version.policy.name,
      policyDomain: version.policy.domain,
      policyVersionId: version.id,
      policyVersionNumber: version.versionNumber,
    })),
  };
};

export const loadPublishedPolicyVersions = async () => {
  const now = new Date();
  const versions = await prisma.policyVersion.findMany({
    where: {
      status: "PUBLISHED",
      policy: { status: "PUBLISHED" },
      AND: [
        {
          OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        },
        {
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
      ],
    },
    include: {
      policy: true,
      rules: {
        orderBy: [{ priority: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ policyId: "asc" }, { versionNumber: "asc" }],
  });

  return versions.map(toPolicyVersionDefinition);
};

export const getRequestDetail = async (id: string) =>
  prisma.request.findUnique({
    where: { id },
    include: {
      requester: true,
      businessOwner: true,
      budgetOwner: true,
      comments: {
        include: { author: true },
        orderBy: { createdAt: "desc" },
      },
      attachments: {
        include: { uploadedBy: true },
        orderBy: { createdAt: "desc" },
      },
      manualOverrides: {
        include: { createdBy: true, approver: true },
        orderBy: { createdAt: "desc" },
      },
      evaluations: {
        include: { ruleMatches: true, evaluatedBy: true },
        orderBy: { evaluatedAt: "desc" },
      },
    },
  });

export const evaluateRequestAndPersist = async (requestId: string, evaluatedById?: string) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { attachments: true },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  const policyVersions = await loadPublishedPolicyVersions();
  const inputSnapshot = buildRequestInput(request);
  const result = evaluatePolicyVersions(inputSnapshot, policyVersions);

  const evaluation = await prisma.policyEvaluation.create({
    data: {
      requestId,
      decision: result.decision,
      inputSnapshot: inputSnapshot as any,
      resultSnapshot: result as any,
      appliedPolicyVersions: result.appliedPolicyVersions as any,
      evaluatedById,
      ruleMatches: {
        create: result.ruleResults.map(rule => ({
          ruleId: rule.ruleId,
          matched: rule.matched,
          ruleSnapshot: {
            ruleId: rule.ruleId,
            ruleName: rule.ruleName,
            policyName: rule.policyName,
            policyDomain: rule.policyDomain,
            policyVersionId: rule.policyVersionId,
            policyVersionNumber: rule.policyVersionNumber,
            severity: rule.severity,
            reason: rule.reason,
          },
          effects: rule.effects as any,
          facts: rule.facts as any,
          reason: rule.reason,
        })),
      },
    },
  });

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: requestStatusForDecision(result.decision) as any,
      decision: result.decision,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: evaluatedById,
      action: "REQUEST_EVALUATED",
      entityType: "Request",
      entityId: requestId,
      metadata: {
        evaluationId: evaluation.id,
        decision: result.decision,
        matchedRules: result.matchedRules.map(rule => rule.ruleName),
      } as any,
    },
  });

  return getRequestDetail(requestId);
};

export const getActorRoleCodes = async (actorId?: string | null): Promise<string[]> => {
  if (!actorId) return [];
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    include: { roleAssignments: { include: { role: true } } },
  });
  return user?.roleAssignments.map(assignment => assignment.role.code) ?? [];
};

export const createAuditEvent = async (
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
  actorId?: string,
) =>
  prisma.auditEvent.create({
    data: {
      action,
      entityType,
      entityId,
      metadata: metadata as any,
      actorId,
    },
  });

export const resetDemoData = async () => {
  const attachments = await prisma.requestAttachment.findMany({ select: { storageKey: true } });
  await deleteStorageObjects(attachments.map(a => a.storageKey));

  await prisma.auditEvent.deleteMany();
  await prisma.policyEvaluationRuleMatch.deleteMany();
  await prisma.policyEvaluation.deleteMany();
  await prisma.manualOverride.deleteMany();
  await prisma.requestAttachment.deleteMany();
  await prisma.requestComment.deleteMany();
  await prisma.request.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.policyVersion.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.roleAssignment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  for (const role of demoRoles) {
    await prisma.role.create({
      data: {
        id: role.id,
        code: role.code as any,
        name: role.name,
        description: role.description,
      },
    });
  }

  for (const user of demoUsers) {
    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleAssignments: {
          create: user.roles.map(code => ({
            role: { connect: { code: code as any } },
          })),
        },
      },
    });
  }

  for (const policyVersion of demoPolicyVersions) {
    const firstRule = policyVersion.rules[0];

    await prisma.policy.create({
      data: {
        id: policyVersion.policyId,
        name: policyVersion.policyName,
        description: firstRule.description,
        domain: policyVersion.policyDomain as any,
        status: "PUBLISHED",
        ownerId: "user-policy-owner",
        currentVersionId: policyVersion.id,
        versions: {
          create: {
            id: policyVersion.id,
            versionNumber: policyVersion.versionNumber,
            status: "PUBLISHED",
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            authorId: "user-policy-owner",
            approvedById: "user-policy-approver",
            approvedAt: new Date("2026-01-01T00:00:00.000Z"),
            changeSummary: "Pierwsza wersja polityki demonstracyjnej.",
            rules: {
              create: policyVersion.rules.map(rule => ({
                id: rule.id,
                name: rule.name,
                description: rule.description,
                severity: rule.severity as any,
                condition: rule.condition as any,
                effects: rule.effects as any,
                reason: rule.reason,
                enabled: rule.enabled,
                priority: rule.priority,
              })),
            },
          },
        },
      },
    });
  }

  const pendingVersion = await prisma.policyVersion.create({
    data: {
      id: demoPendingApprovalVersion.id,
      policyId: demoPendingApprovalVersion.policyId,
      versionNumber: null,
      status: "IN_REVIEW",
      authorId: demoPendingApprovalVersion.authorId,
      changeSummary: demoPendingApprovalVersion.changeSummary,
      rules: {
        create: [
          {
            id: demoPendingApprovalVersion.rule.id,
            name: demoPendingApprovalVersion.rule.name,
            description: demoPendingApprovalVersion.rule.description,
            severity: demoPendingApprovalVersion.rule.severity as any,
            condition: demoPendingApprovalVersion.rule.condition as any,
            effects: demoPendingApprovalVersion.rule.effects as any,
            reason: demoPendingApprovalVersion.rule.reason,
            enabled: demoPendingApprovalVersion.rule.enabled,
            priority: demoPendingApprovalVersion.rule.priority,
          },
        ],
      },
    },
  });

  await createAuditEvent(
    "POLICY_VERSION_SUBMITTED_FOR_APPROVAL",
    "PolicyVersion",
    pendingVersion.id,
    { policyId: demoPendingApprovalVersion.policyId },
    demoPendingApprovalVersion.authorId,
  );

  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

  for (const seed of demoSeedRequests) {
    const createdAt = daysAgo(seed.daysAgo);
    const input = seed.input;

    await prisma.request.create({
      data: {
        id: seed.id,
        title: input.title,
        description: input.description,
        type: input.type as any,
        category: input.category as any,
        status: seed.mode === "draft" ? "DRAFT" : "SUBMITTED",
        annualCost: input.annualCost,
        currency: input.currency as any,
        vendorName: input.vendorName,
        vendorCountry: input.vendorCountry,
        department: input.department as any,
        urgency: input.urgency as any,
        justification: input.justification,
        processesPersonalData: input.processesPersonalData,
        dataCategories: input.dataCategories ?? [],
        dataClassification: (input.dataClassification ?? "NONE") as any,
        hasDpa: input.hasDpa ?? false,
        transfersOutsideEea: input.transfersOutsideEea ?? false,
        requiresSecurityQuestionnaire: input.requiresSecurityQuestionnaire ?? false,
        vendorRisk: (input.vendorRisk ?? "UNKNOWN") as any,
        inputData: input as any,
        requesterId: input.requesterId,
        businessOwnerId: input.businessOwnerId,
        budgetOwnerId: input.budgetOwnerId ?? null,
        createdAt,
      },
    });

    for (const comment of seed.comments ?? []) {
      await prisma.requestComment.create({
        data: {
          requestId: seed.id,
          authorId: comment.authorId,
          visibility: comment.visibility as any,
          body: comment.body,
          createdAt,
        },
      });
    }

    for (const attachment of seed.attachments ?? []) {
      await prisma.requestAttachment.create({
        data: {
          requestId: seed.id,
          uploadedById: attachment.uploadedById,
          attachmentType: attachment.attachmentType as any,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          storageKey: `metadata:${attachment.fileName}`,
          createdAt,
        },
      });
    }

    if (seed.mode !== "submit") continue;

    await evaluateRequestAndPersist(seed.id, input.requesterId);

    if (seed.override) {
      const current = await prisma.request.findUnique({ where: { id: seed.id } });
      const override = await prisma.manualOverride.create({
        data: {
          requestId: seed.id,
          originalDecision: current?.decision ?? null,
          newDecision: seed.override.newDecision as any,
          isException: seed.override.exception,
          reason: seed.override.reason,
          comment: seed.override.comment,
          approverId: seed.override.approverId,
          createdById: seed.override.createdById,
        },
      });

      await prisma.request.update({
        where: { id: seed.id },
        data: {
          status: statusForReviewerDecision(
            seed.override.newDecision as Decision,
            seed.override.exception,
          ) as any,
        },
      });

      await createAuditEvent(
        seed.override.exception ? "REQUEST_DECISION_OVERRIDDEN" : "REQUEST_REVIEW_DECIDED",
        "Request",
        seed.id,
        {
          overrideId: override.id,
          originalDecision: current?.decision ?? null,
          newDecision: seed.override.newDecision,
          exception: seed.override.exception,
        },
        seed.override.createdById,
      );
    }
  }

  return getRequestDetail("request-demo-acme-analytics");
};

export const evaluateDraftInput = async (
  input: RequestInput,
  draftRule?: Omit<PolicyVersionDefinition["rules"][number], "policyVersionId" | "policyVersionNumber" | "policyId" | "policyName" | "policyDomain">,
  policyVersionId?: string,
): Promise<PolicyEvaluationResult> => {
  if (policyVersionId) {
    const version = await prisma.policyVersion.findUnique({
      where: { id: policyVersionId },
      include: {
        policy: { include: { versions: { select: { versionNumber: true } } } },
        rules: { orderBy: [{ priority: "asc" }, { name: "asc" }] },
      },
    });
    if (!version) {
      throw new Error("Policy version not found.");
    }
    if (!["DRAFT", "IN_REVIEW"].includes(version.status)) {
      throw new Error("Only a draft or review version can be tested in the rule console.");
    }

    const prospectiveVersionNumber =
      Math.max(
        0,
        ...version.policy.versions
          .map(item => item.versionNumber)
          .filter((value): value is number => typeof value === "number"),
      ) + 1;

    return evaluatePolicyVersions(input, [
      toPolicyVersionDefinition({
        ...version,
        versionNumber: prospectiveVersionNumber,
      }),
    ]);
  }

  const policyVersions = await loadPublishedPolicyVersions();

  if (!draftRule) {
    return evaluatePolicyVersions(input, policyVersions);
  }

  const draftVersion: PolicyVersionDefinition = {
    id: "draft-test-version",
    policyId: "draft-test-policy",
    policyName: "Reguła testowa",
    policyDomain: "PROCUREMENT",
    versionNumber: 1,
    rules: [
      {
        ...draftRule,
        policyId: "draft-test-policy",
        policyName: "Reguła testowa",
        policyDomain: "PROCUREMENT",
        policyVersionId: "draft-test-version",
        policyVersionNumber: 1,
      },
    ],
  };

  return evaluatePolicyVersions(input, [draftVersion]);
};
