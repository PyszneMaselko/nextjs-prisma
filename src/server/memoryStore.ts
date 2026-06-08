import { demoPolicyVersions, demoRequestInput, demoRoles, demoUsers } from "../domain/policy/demoData";
import { evaluatePolicyVersions } from "../domain/policy/ruleEngine";
import { PolicyVersionDefinition, RequestInput } from "../domain/policy/types";
import { requestStatusForDecision } from "./policyService";

type MemoryState = {
  roles: any[];
  users: any[];
  policies: any[];
  requests: any[];
  auditEvents: any[];
};

const globalForMemory = globalThis as unknown as {
  policyCheckerMemory?: MemoryState;
};

export const isMemoryMode = () => process.env.POLICY_CHECKER_MEMORY_DEMO === "1";

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const now = () => new Date().toISOString();

const userById = (state: MemoryState, userId: string) => state.users.find(user => user.id === userId);

const toPolicyDefinitions = (state: MemoryState): PolicyVersionDefinition[] =>
  state.policies
    .filter(policy => policy.status === "PUBLISHED")
    .flatMap(policy =>
      policy.versions
        .filter((version: any) => version.status === "PUBLISHED")
        .map((version: any) => ({
          id: version.id,
          policyId: policy.id,
          policyName: policy.name,
          policyDomain: policy.domain,
          versionNumber: version.versionNumber,
          rules: version.rules.map((rule: any) => ({
            ...rule,
            policyId: policy.id,
            policyName: policy.name,
            policyDomain: policy.domain,
            policyVersionId: version.id,
            policyVersionNumber: version.versionNumber,
          })),
        })),
    );

const buildMemoryInput = (request: any): RequestInput => {
  const dpaAttachment = request.attachments.find((attachment: any) => attachment.attachmentType === "DPA");

  return {
    ...request.inputData,
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
    dataCategories: request.dataCategories,
    dataClassification: request.dataClassification,
    hasDpa: request.hasDpa ?? Boolean(dpaAttachment),
    transfersOutsideEea: request.transfersOutsideEea,
    requiresSecurityQuestionnaire: request.requiresSecurityQuestionnaire,
    vendorRisk: request.vendorRisk,
    dpaDocument: dpaAttachment?.fileName ?? request.inputData?.dpaDocument ?? "",
    emergencyJustification: request.inputData?.emergencyJustification ?? "",
  };
};

const attachRelations = (state: MemoryState, request: any) => ({
  ...request,
  requester: userById(state, request.requesterId),
  businessOwner: userById(state, request.businessOwnerId),
  budgetOwner: request.budgetOwnerId ? userById(state, request.budgetOwnerId) : null,
  comments: request.comments.map((comment: any) => ({
    ...comment,
    author: userById(state, comment.authorId),
  })),
  attachments: request.attachments.map((attachment: any) => ({
    ...attachment,
    uploadedBy: userById(state, attachment.uploadedById),
  })),
  manualOverrides: request.manualOverrides.map((override: any) => ({
    ...override,
    createdBy: userById(state, override.createdById),
    approver: userById(state, override.approverId),
  })),
  evaluations: request.evaluations,
  latestEvaluation: request.evaluations[0] ?? null,
  effectiveDecision: request.manualOverrides[0]?.newDecision ?? request.decision,
});

const createInitialState = (): MemoryState => {
  const roles = demoRoles.map(role => ({ ...role, createdAt: now() }));
  const users = demoUsers.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: now(),
    roleAssignments: user.roles.map(code => ({
      role: roles.find(role => role.code === code),
    })),
  }));

  const policies = demoPolicyVersions.map(policyVersion => ({
    id: policyVersion.policyId,
    name: policyVersion.policyName,
    description: policyVersion.rules[0].description,
    domain: policyVersion.policyDomain,
    status: "PUBLISHED",
    ownerId: "user-policy-owner",
    currentVersionId: policyVersion.id,
    createdAt: now(),
    updatedAt: now(),
    owner: users.find(user => user.id === "user-policy-owner"),
    versions: [
      {
        id: policyVersion.id,
        policyId: policyVersion.policyId,
        versionNumber: policyVersion.versionNumber,
        status: "PUBLISHED",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
        authorId: "user-policy-owner",
        author: users.find(user => user.id === "user-policy-owner"),
        changeSummary: "Pierwsza wersja polityki demonstracyjnej.",
        createdAt: now(),
        rules: policyVersion.rules.map(rule => ({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          condition: rule.condition,
          effects: rule.effects,
          reason: rule.reason,
          enabled: rule.enabled,
          priority: rule.priority,
          createdAt: now(),
          updatedAt: now(),
        })),
      },
    ],
  }));

  const requests = [
    {
      id: "request-demo-acme-analytics",
      ...demoRequestInput,
      annualCost: Number(demoRequestInput.annualCost),
      dataCategories: demoRequestInput.dataCategories,
      status: "SUBMITTED",
      decision: null,
      createdAt: now(),
      updatedAt: now(),
      inputData: demoRequestInput,
      comments: [
        {
          id: "comment-demo",
          requestId: "request-demo-acme-analytics",
          authorId: "user-requester",
          visibility: "PUBLIC",
          body: "Demo: zakup SaaS za 8 000 EUR bez DPA, zgodnie ze scenariuszem z dokumentu.",
          createdAt: now(),
        },
      ],
      attachments: [],
      manualOverrides: [],
      evaluations: [],
    },
  ];

  const state = { roles, users, policies, requests, auditEvents: [] };
  evaluateMemoryRequest(state, requests[0].id, "user-requester");
  return state;
};

export const getMemoryState = () => {
  if (!globalForMemory.policyCheckerMemory) {
    globalForMemory.policyCheckerMemory = createInitialState();
  }

  return globalForMemory.policyCheckerMemory;
};

export const resetMemoryState = () => {
  globalForMemory.policyCheckerMemory = createInitialState();
  return memoryGetRequest("request-demo-acme-analytics");
};

export const evaluateMemoryRequest = (state: MemoryState, requestId: string, actorId?: string) => {
  const request = state.requests.find(item => item.id === requestId);
  if (!request) throw new Error("Request not found");

  const inputSnapshot = buildMemoryInput(request);
  const result = evaluatePolicyVersions(inputSnapshot, toPolicyDefinitions(state));
  const evaluation = {
    id: id("evaluation"),
    requestId,
    decision: result.decision,
    inputSnapshot,
    resultSnapshot: result,
    appliedPolicyVersions: result.appliedPolicyVersions,
    evaluatedById: actorId,
    evaluatedBy: actorId ? userById(state, actorId) : null,
    evaluatedAt: now(),
    ruleMatches: result.ruleResults.map(rule => ({
      id: id("match"),
      matched: rule.matched,
      ruleId: rule.ruleId,
      ruleSnapshot: rule,
      effects: rule.effects,
      facts: rule.facts,
      reason: rule.reason,
    })),
  };

  request.evaluations.unshift(evaluation);
  request.decision = result.decision;
  request.status = requestStatusForDecision(result.decision);
  request.updatedAt = now();
  state.auditEvents.push({ action: "REQUEST_EVALUATED", entityId: requestId, actorId, createdAt: now() });
  return attachRelations(state, request);
};

export const memoryBootstrap = () => {
  const state = getMemoryState();
  return {
    users: state.users,
    roles: state.roles,
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
  };
};

export const memoryDashboard = () => {
  const state = getMemoryState();
  const requests = state.requests;
  const ruleHits: Record<string, number> = {};
  const missingFields: Record<string, number> = {};

  requests.forEach(request => {
    request.evaluations.forEach((evaluation: any) => {
      evaluation.resultSnapshot.matchedRules.forEach((rule: any) => {
        ruleHits[rule.ruleName] = (ruleHits[rule.ruleName] ?? 0) + 1;
      });
      evaluation.resultSnapshot.missingFields.forEach((field: any) => {
        missingFields[field.label] = (missingFields[field.label] ?? 0) + 1;
      });
    });
  });

  return {
    totalRequests: requests.length,
    autoApproved: requests.filter(request => request.status === "AUTO_APPROVED").length,
    requiresReview: requests.filter(request => request.status === "IN_REVIEW").length,
    missingInformation: requests.filter(request => request.status === "NEEDS_INFORMATION").length,
    rejected: requests.filter(request => request.status === "REJECTED").length,
    averageDecisionMs: 0,
    byStatus: Object.entries(
      requests.reduce((map: Record<string, number>, request) => {
        map[request.status] = (map[request.status] ?? 0) + 1;
        return map;
      }, {}),
    ).map(([key, count]) => ({ key, count })),
    byDecision: Object.entries(
      requests.reduce((map: Record<string, number>, request) => {
        map[request.decision ?? "NONE"] = (map[request.decision ?? "NONE"] ?? 0) + 1;
        return map;
      }, {}),
    ).map(([key, count]) => ({ key, count })),
    topRuleHits: Object.entries(ruleHits).map(([name, count]) => ({ name, count })),
    topMissingFields: Object.entries(missingFields).map(([name, count]) => ({ name, count })),
  };
};

export const memoryListRequests = (query: any) => {
  const state = getMemoryState();
  const search = String(query.search ?? "").toLocaleLowerCase();
  const requests = state.requests
    .filter(request => (!query.status || request.status === query.status))
    .filter(request => (!query.decision || request.decision === query.decision))
    .filter(request => (!query.category || request.category === query.category))
    .filter(request => !search || request.title.toLocaleLowerCase().includes(search) || request.vendorName.toLocaleLowerCase().includes(search))
    .map(request => attachRelations(state, request));

  return { page: 1, pageSize: requests.length, total: requests.length, requests };
};

export const memoryGetRequest = (requestId: string) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  return request ? attachRelations(state, request) : null;
};

export const memoryCreateRequest = (input: any) => {
  const state = getMemoryState();
  const request = {
    id: id("request"),
    ...input,
    annualCost: Number(input.annualCost),
    dataCategories: input.dataCategories ?? [],
    status: input.mode === "draft" ? "DRAFT" : "SUBMITTED",
    decision: null,
    createdAt: now(),
    updatedAt: now(),
    inputData: input,
    comments: [],
    attachments: [],
    manualOverrides: [],
    evaluations: [],
  };
  state.requests.unshift(request);
  return input.mode === "submit" ? evaluateMemoryRequest(state, request.id, input.requesterId) : attachRelations(state, request);
};

export const memoryUpdateRequest = (requestId: string, input: any) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return null;
  Object.assign(request, input, {
    status: input.mode === "submit" ? "SUBMITTED" : input.mode === "draft" ? "DRAFT" : request.status,
    inputData: { ...request.inputData, ...input },
    updatedAt: now(),
  });
  return input.mode === "submit" ? evaluateMemoryRequest(state, request.id, input.requesterId) : attachRelations(state, request);
};

export const memoryAddComment = (requestId: string, input: any) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return null;
  request.comments.unshift({ id: id("comment"), requestId, createdAt: now(), ...input });
  return attachRelations(state, request);
};

export const memoryAddAttachment = (requestId: string, input: any) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return null;
  request.attachments.unshift({ id: id("attachment"), requestId, createdAt: now(), storageKey: `metadata:${input.fileName}`, ...input });
  if (input.attachmentType === "DPA") {
    request.hasDpa = true;
    request.inputData = { ...request.inputData, hasDpa: true, dpaDocument: input.fileName };
    return evaluateMemoryRequest(state, requestId, input.uploadedById);
  }
  return attachRelations(state, request);
};

export const memoryAddOverride = (requestId: string, input: any) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return null;
  request.manualOverrides.unshift({
    id: id("override"),
    requestId,
    originalDecision: request.decision,
    createdAt: now(),
    ...input,
  });
  request.status = input.newDecision === "APPROVED" ? "APPROVED_WITH_EXCEPTION" : request.status;
  return attachRelations(state, request);
};

export const memoryPolicies = () => ({ policies: getMemoryState().policies });

export const memoryCreatePolicy = (input: any) => {
  const state = getMemoryState();
  const policyId = id("policy");
  const versionId = id("version");
  const status = input.publish ? "PUBLISHED" : "DRAFT";
  const policy = {
    id: policyId,
    name: input.name,
    description: input.description,
    domain: input.domain,
    status,
    ownerId: input.ownerId,
    owner: userById(state, input.ownerId),
    currentVersionId: input.publish ? versionId : null,
    createdAt: now(),
    updatedAt: now(),
    versions: [
      {
        id: versionId,
        policyId,
        versionNumber: 1,
        status,
        effectiveFrom: input.publish ? now() : null,
        effectiveTo: null,
        authorId: input.ownerId,
        author: userById(state, input.ownerId),
        changeSummary: input.changeSummary,
        createdAt: now(),
        rules: [],
      },
    ],
  };
  state.policies.unshift(policy);
  return { policy };
};

export const memoryCreateVersion = (policyId: string, input: any) => {
  const state = getMemoryState();
  const policy = state.policies.find(item => item.id === policyId);
  if (!policy) return null;
  const latest = policy.versions[0];
  const version = {
    id: id("version"),
    policyId,
    versionNumber: (latest?.versionNumber ?? 0) + 1,
    status: "DRAFT",
    effectiveFrom: null,
    effectiveTo: null,
    authorId: input.authorId,
    author: userById(state, input.authorId),
    changeSummary: input.changeSummary,
    createdAt: now(),
    rules: input.copyCurrentRules && latest ? latest.rules.map((rule: any) => ({ ...rule, id: id("rule") })) : [],
  };
  policy.versions.unshift(version);
  policy.status = "DRAFT";
  return { policy };
};

export const memoryPublishVersion = (policyId: string, versionId: string) => {
  const state = getMemoryState();
  const policy = state.policies.find(item => item.id === policyId);
  if (!policy) return null;
  policy.versions.forEach((version: any) => {
    if (version.id === versionId) {
      version.status = "PUBLISHED";
      version.effectiveFrom = now();
      version.effectiveTo = null;
    } else if (version.status === "PUBLISHED") {
      version.status = "ARCHIVED";
      version.effectiveTo = now();
    }
  });
  policy.status = "PUBLISHED";
  policy.currentVersionId = versionId;
  return { policy };
};

export const memoryCreateRule = (input: any) => {
  const state = getMemoryState();
  const policy = state.policies.find(item => item.versions.some((version: any) => version.id === input.policyVersionId));
  const version = policy?.versions.find((item: any) => item.id === input.policyVersionId);
  if (!policy || !version) return null;
  if (!["DRAFT", "IN_REVIEW"].includes(version.status)) {
    throw new Error("Rules can only be added to DRAFT or IN_REVIEW policy versions.");
  }
  const rule = { id: id("rule"), createdAt: now(), updatedAt: now(), ...input };
  version.rules.push(rule);
  return { policy, rule };
};

export const memoryTestRules = (input: any, draftRule?: any) => {
  const state = getMemoryState();
  const facts = { ...demoRequestInput, ...input };
  if (!draftRule) return { result: evaluatePolicyVersions(facts, toPolicyDefinitions(state)) };
  return {
    result: evaluatePolicyVersions(facts, [
      {
        id: "memory-draft-version",
        policyId: "memory-draft-policy",
        policyName: "Reguła testowa",
        policyDomain: "PROCUREMENT",
        versionNumber: 1,
        rules: [
          {
            ...draftRule,
            policyId: "memory-draft-policy",
            policyName: "Reguła testowa",
            policyDomain: "PROCUREMENT",
            policyVersionId: "memory-draft-version",
            policyVersionNumber: 1,
          },
        ],
      },
    ]),
  };
};
