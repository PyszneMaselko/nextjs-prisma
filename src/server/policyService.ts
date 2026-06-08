import {
  Decision,
  PolicyEvaluationResult,
  PolicyVersionDefinition,
  RequestInput,
} from "../domain/policy/types";
import {
  demoPendingApprovalVersion,
  demoPolicyVersions,
  demoRequestInput,
  demoRoles,
  demoUsers,
} from "../domain/policy/demoData";
import { evaluatePolicyVersions } from "../domain/policy/ruleEngine";
import { prisma } from "../lib/prisma";

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

const toPolicyVersionDefinition = (version: any): PolicyVersionDefinition => ({
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
});

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
      versionNumber: demoPendingApprovalVersion.versionNumber,
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

  await prisma.policy.update({
    where: { id: demoPendingApprovalVersion.policyId },
    data: { status: "IN_REVIEW" },
  });

  await createAuditEvent(
    "POLICY_VERSION_SUBMITTED_FOR_APPROVAL",
    "PolicyVersion",
    pendingVersion.id,
    { policyId: demoPendingApprovalVersion.policyId, versionNumber: demoPendingApprovalVersion.versionNumber },
    demoPendingApprovalVersion.authorId,
  );

  const request = await prisma.request.create({
    data: {
      id: "request-demo-acme-analytics",
      title: demoRequestInput.title,
      description: demoRequestInput.description,
      type: demoRequestInput.type as any,
      category: demoRequestInput.category as any,
      status: "SUBMITTED",
      annualCost: demoRequestInput.annualCost,
      currency: demoRequestInput.currency as any,
      vendorName: demoRequestInput.vendorName,
      vendorCountry: demoRequestInput.vendorCountry,
      department: demoRequestInput.department as any,
      urgency: demoRequestInput.urgency as any,
      justification: demoRequestInput.justification,
      processesPersonalData: demoRequestInput.processesPersonalData,
      dataCategories: demoRequestInput.dataCategories,
      dataClassification: demoRequestInput.dataClassification as any,
      hasDpa: demoRequestInput.hasDpa,
      transfersOutsideEea: demoRequestInput.transfersOutsideEea,
      requiresSecurityQuestionnaire: demoRequestInput.requiresSecurityQuestionnaire,
      vendorRisk: demoRequestInput.vendorRisk as any,
      inputData: demoRequestInput as any,
      requesterId: demoRequestInput.requesterId,
      businessOwnerId: demoRequestInput.businessOwnerId,
      budgetOwnerId: demoRequestInput.budgetOwnerId,
    },
  });

  await prisma.requestComment.create({
    data: {
      requestId: request.id,
      authorId: "user-requester",
      visibility: "PUBLIC",
      body: "Demo: zakup SaaS za 8 000 EUR bez DPA, zgodnie ze scenariuszem z dokumentu.",
    },
  });

  await evaluateRequestAndPersist(request.id, "user-requester");

  return getRequestDetail(request.id);
};

export const evaluateDraftInput = async (
  input: RequestInput,
  draftRule?: Omit<PolicyVersionDefinition["rules"][number], "policyVersionId" | "policyVersionNumber" | "policyId" | "policyName" | "policyDomain">,
): Promise<PolicyEvaluationResult> => {
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
