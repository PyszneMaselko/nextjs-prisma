import {
  demoPendingApprovalVersion,
  demoPolicyVersions,
  demoRequestInput,
  demoRoles,
  demoSeedRequests,
  demoUsers,
} from "../domain/policy/demoData";
import { evaluatePolicyVersions } from "../domain/policy/ruleEngine";
import {
  approverGroups,
  findConditionContradiction,
  PolicyVersionDefinition,
  RequestInput,
} from "../domain/policy/types";
import { requestStatusForDecision, statusForReviewerDecision } from "./policyService";
import {
  canListRequests,
  canModifyRequestFiles,
  canReadRequest,
  hideInternalComments,
} from "./requestAccess";

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

const actorRoleCodes = (state: MemoryState, actorId: string): string[] =>
  (userById(state, actorId)?.roleAssignments ?? [])
    .map((assignment: any) => assignment.role?.code)
    .filter(Boolean);

export const memoryActorRoleCodes = (actorId: string) =>
  actorRoleCodes(getMemoryState(), actorId);

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

// Applies a seeded reviewer decision directly (bypasses the runtime role/status guards because the
// seed already guarantees the request is IN_REVIEW and the actor is a reviewer).
const applySeedOverride = (state: MemoryState, requestId: string, override: any) => {
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return;
  request.manualOverrides.unshift({
    id: id("override"),
    requestId,
    originalDecision: request.decision,
    isException: Boolean(override.exception),
    newDecision: override.newDecision,
    reason: override.reason,
    comment: override.comment,
    approverId: override.approverId,
    createdById: override.createdById,
    createdAt: request.updatedAt ?? now(),
  });
  request.status = statusForReviewerDecision(override.newDecision, override.exception);
  request.updatedAt = now();
  state.auditEvents.push({
    action: override.exception ? "REQUEST_DECISION_OVERRIDDEN" : "REQUEST_REVIEW_DECIDED",
    entityId: requestId,
    actorId: override.createdById,
    createdAt: now(),
  });
};

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
        approvedById: "user-policy-approver",
        approvedBy: users.find(user => user.id === "user-policy-approver"),
        approvedAt: "2026-01-01T00:00:00.000Z",
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

  const procurementPolicy = policies.find(policy => policy.id === demoPendingApprovalVersion.policyId);
  procurementPolicy?.versions.unshift({
    id: demoPendingApprovalVersion.id,
    policyId: demoPendingApprovalVersion.policyId,
    versionNumber: null,
    status: "IN_REVIEW",
    effectiveFrom: null,
    effectiveTo: null,
    authorId: demoPendingApprovalVersion.authorId,
    author: users.find(user => user.id === demoPendingApprovalVersion.authorId),
    approvedById: null,
    approvedBy: null,
    approvedAt: null,
    changeSummary: demoPendingApprovalVersion.changeSummary,
    createdAt: now(),
    rules: [
      {
        ...(demoPendingApprovalVersion.rule as any),
        createdAt: now(),
        updatedAt: now(),
      },
    ],
  });

  const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  const requests = demoSeedRequests.map(seed => {
    const createdAt = daysAgoIso(seed.daysAgo);
    return {
      id: seed.id,
      ...seed.input,
      annualCost: Number(seed.input.annualCost),
      dataCategories: seed.input.dataCategories ?? [],
      status: seed.mode === "draft" ? "DRAFT" : "SUBMITTED",
      decision: null,
      createdAt,
      updatedAt: createdAt,
      inputData: seed.input,
      comments: (seed.comments ?? []).map((comment, index) => ({
        id: `${seed.id}-comment-${index}`,
        requestId: seed.id,
        authorId: comment.authorId,
        visibility: comment.visibility,
        body: comment.body,
        createdAt,
      })),
      attachments: (seed.attachments ?? []).map((attachment, index) => ({
        id: `${seed.id}-attachment-${index}`,
        requestId: seed.id,
        uploadedById: attachment.uploadedById,
        attachmentType: attachment.attachmentType,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        storageKey: `metadata:${attachment.fileName}`,
        createdAt,
      })),
      manualOverrides: [],
      evaluations: [],
    };
  });

  const state = { roles, users, policies, requests, auditEvents: [] };

  // Evaluate every submitted request, then apply any seeded reviewer decision (exception / rejection).
  demoSeedRequests.forEach(seed => {
    if (seed.mode !== "submit") return;
    evaluateMemoryRequest(state, seed.id, seed.input.requesterId);
    if (seed.override) {
      applySeedOverride(state, seed.id, seed.override);
    }
  });

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
      approvers: approverGroups,
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
  const page = Math.max(Number(query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? 10), 1), 50);
  const search = String(query.search ?? "").toLocaleLowerCase();
  const sortDirection = query.sort === "oldest" ? 1 : -1;
  const filtered = state.requests
    .filter(request => (!query.status || request.status === query.status))
    .filter(request => (!query.decision || request.decision === query.decision))
    .filter(request => (!query.category || request.category === query.category))
    .filter(request => (!query.department || request.department === query.department))
    .filter(request => (!query.urgency || request.urgency === query.urgency))
    .filter(request => (!query.requesterId || request.requesterId === query.requesterId))
    .filter(request => !search || request.title.toLocaleLowerCase().includes(search) || request.vendorName.toLocaleLowerCase().includes(search))
    .sort((a, b) => sortDirection * String(a.createdAt).localeCompare(String(b.createdAt)));
  const requests = filtered
    .slice((page - 1) * pageSize, page * pageSize)
    .map(request => attachRelations(state, request));

  return { page, pageSize, total: filtered.length, requests };
};

export const memoryGetRequest = (requestId: string) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  return request ? attachRelations(state, request) : null;
};

export const memoryGetRequestForActor = (requestId: string, actorId: string) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return null;

  const roleCodes = actorRoleCodes(state, actorId);
  if (!canReadRequest(roleCodes, actorId, request.requesterId)) {
    return { error: "You do not have permission to view this request." };
  }

  return hideInternalComments(attachRelations(state, request), roleCodes);
};

export const memoryRequestFileAccess = (
  requestId: string,
  actorId: string,
  mode: "read" | "write",
) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return "not-found" as const;

  const roleCodes = actorRoleCodes(state, actorId);
  const allowed =
    mode === "write"
      ? canModifyRequestFiles(roleCodes, actorId, request.requesterId)
      : canReadRequest(roleCodes, actorId, request.requesterId);
  return allowed ? ("allowed" as const) : ("forbidden" as const);
};

export const memoryAttachmentRequestId = (storageKey: string) => {
  const request = getMemoryState().requests.find(item =>
    item.attachments.some((attachment: any) => attachment.storageKey === storageKey),
  );
  return request?.id ?? null;
};

export const memoryCreateRequest = (input: any) => {
  const state = getMemoryState();
  if (!actorRoleCodes(state, input.requesterId).some(role => ["REQUESTER", "ADMIN"].includes(role))) {
    return { error: "Only a Requester or Admin can create a request." };
  }
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
  const detail =
    input.mode === "submit"
      ? evaluateMemoryRequest(state, request.id, input.requesterId)
      : attachRelations(state, request);
  return hideInternalComments(detail, actorRoleCodes(state, input.requesterId));
};

export const memoryUpdateRequest = (requestId: string, input: any) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return null;
  if (!input.requesterId) {
    return { error: "requesterId is required to update a request." };
  }
  const roleCodes = actorRoleCodes(state, input.requesterId);
  if (!roleCodes.some(role => ["REQUESTER", "ADMIN"].includes(role))) {
    return { error: "Only a Requester or Admin can update a request." };
  }
  if (!roleCodes.includes("ADMIN") && request.requesterId !== input.requesterId) {
    return { error: "Requesters can only update their own requests." };
  }
  if (!["DRAFT", "NEEDS_INFORMATION"].includes(request.status)) {
    return { error: "Only DRAFT or NEEDS_INFORMATION requests can be edited." };
  }
  const { requesterId: _ignoredRequesterId, ...editableInput } = input;
  Object.assign(request, editableInput, {
    status:
      input.mode === "submit"
        ? "SUBMITTED"
        : input.mode === "draft" && request.status === "DRAFT"
          ? "DRAFT"
          : request.status,
    inputData: { ...request.inputData, ...editableInput },
    updatedAt: now(),
  });
  const detail =
    input.mode === "submit"
      ? evaluateMemoryRequest(state, request.id, request.requesterId)
      : attachRelations(state, request);
  return hideInternalComments(detail, roleCodes);
};

export const memoryAddComment = (requestId: string, input: any) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return null;
  const roleCodes = actorRoleCodes(state, input.authorId);
  const canReview = roleCodes.some(role => ["REVIEWER", "ADMIN"].includes(role));
  const ownsRequest = roleCodes.includes("REQUESTER") && request.requesterId === input.authorId;
  if (!canReview && !ownsRequest) {
    return { error: "You do not have permission to comment on this request." };
  }
  if (!canReview && input.visibility === "INTERNAL") {
    return { error: "Internal comments are only available to Reviewers and Admins." };
  }
  request.comments.unshift({ id: id("comment"), requestId, createdAt: now(), ...input });
  return hideInternalComments(attachRelations(state, request), roleCodes);
};

export const memoryAddAttachment = (requestId: string, input: any) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return null;
  const roleCodes = actorRoleCodes(state, input.uploadedById);
  const canReview = roleCodes.some(role => ["REVIEWER", "ADMIN"].includes(role));
  const ownsRequest = roleCodes.includes("REQUESTER") && request.requesterId === input.uploadedById;
  if (!canReview && !ownsRequest) {
    return { error: "You do not have permission to add attachments to this request." };
  }
  const storageKey = input.storageKey ?? `metadata:${input.fileName}`;
  request.attachments.unshift({ id: id("attachment"), requestId, createdAt: now(), storageKey, ...input });
  if (input.attachmentType === "DPA") {
    const shouldReevaluate = request.status === "NEEDS_INFORMATION";
    request.hasDpa = true;
    request.inputData = { ...request.inputData, hasDpa: true, dpaDocument: input.fileName };
    if (shouldReevaluate) {
      return hideInternalComments(
        evaluateMemoryRequest(state, requestId, input.uploadedById),
        roleCodes,
      );
    }
  }
  return hideInternalComments(attachRelations(state, request), roleCodes);
};

export const memoryAddOverride = (requestId: string, input: any) => {
  const state = getMemoryState();
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return null;
  if (request.status !== "IN_REVIEW") {
    return { error: "Reviewer decisions can only be recorded for requests in IN_REVIEW." };
  }
  if (!actorRoleCodes(state, input.createdById).some(role => ["REVIEWER", "ADMIN"].includes(role))) {
    return { error: "Only a Reviewer or Admin can record a reviewer decision." };
  }
  request.manualOverrides.unshift({
    id: id("override"),
    requestId,
    originalDecision: request.decision,
    isException: Boolean(input.exception),
    createdAt: now(),
    ...input,
  });
  request.status = statusForReviewerDecision(input.newDecision, input.exception);
  request.updatedAt = now();
  state.auditEvents.push({
    action: input.exception ? "REQUEST_DECISION_OVERRIDDEN" : "REQUEST_REVIEW_DECIDED",
    entityId: requestId,
    actorId: input.createdById,
    createdAt: now(),
  });
  return attachRelations(state, request);
};

export const memoryPolicies = () => ({ policies: getMemoryState().policies });

export const memoryCreatePolicy = (input: any) => {
  const state = getMemoryState();
  const policyId = id("policy");
  const versionId = id("version");
  const policy = {
    id: policyId,
    name: input.name,
    description: input.description,
    domain: input.domain,
    status: "DRAFT",
    ownerId: input.ownerId,
    owner: userById(state, input.ownerId),
    currentVersionId: null,
    createdAt: now(),
    updatedAt: now(),
    versions: [
      {
        id: versionId,
        policyId,
        versionNumber: null,
        status: "DRAFT",
        effectiveFrom: null,
        effectiveTo: null,
        authorId: input.ownerId,
        author: userById(state, input.ownerId),
        approvedById: null,
        approvedBy: null,
        approvedAt: null,
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
  if (policy.versions.some((version: any) => ["DRAFT", "IN_REVIEW"].includes(version.status))) {
    return {
      error: "Finish the existing DRAFT or IN_REVIEW version before creating another draft.",
    };
  }
  const current =
    policy.versions.find((version: any) => version.id === policy.currentVersionId) ??
    policy.versions.find((version: any) => version.status === "PUBLISHED") ??
    policy.versions.find((version: any) => version.status === "ARCHIVED");
  const version = {
    id: id("version"),
    policyId,
    versionNumber: null,
    status: "DRAFT",
    effectiveFrom: null,
    effectiveTo: null,
    authorId: input.authorId,
    author: userById(state, input.authorId),
    approvedById: null,
    approvedBy: null,
    approvedAt: null,
    changeSummary: input.changeSummary,
    createdAt: now(),
    rules: input.copyCurrentRules && current ? current.rules.map((rule: any) => ({ ...rule, id: id("rule") })) : [],
  };
  policy.versions.unshift(version);
  policy.status = policy.currentVersionId ? "PUBLISHED" : "DRAFT";
  return { policy };
};

export const memorySubmitVersionForApproval = (policyId: string, versionId: string, actorId: string) => {
  const state = getMemoryState();
  const policy = state.policies.find(item => item.id === policyId);
  if (!policy) return null;
  if (!actorRoleCodes(state, actorId).includes("POLICY_OWNER")) {
    return { error: "Only a Policy Owner can submit a version for approval." };
  }
  const version = policy.versions.find((item: any) => item.id === versionId);
  if (!version) return null;
  if (version.status !== "DRAFT") {
    return { error: "Only DRAFT versions can be submitted for approval." };
  }
  if (version.rules.length === 0) {
    return { error: "Add and save at least one rule before submitting the version for approval." };
  }
  const invalidRule = version.rules
    .map((rule: any) => ({ rule, contradiction: findConditionContradiction(rule.condition) }))
    .find((item: any) => item.contradiction);
  if (invalidRule) {
    return { error: `Rule "${invalidRule.rule.name}" is contradictory: ${invalidRule.contradiction}` };
  }
  version.status = "IN_REVIEW";
  policy.status = policy.currentVersionId ? "PUBLISHED" : "IN_REVIEW";
  return { policy };
};

export const memoryRejectVersion = (policyId: string, versionId: string, actorId: string, reason: string) => {
  const state = getMemoryState();
  const policy = state.policies.find(item => item.id === policyId);
  if (!policy) return null;
  if (!actorRoleCodes(state, actorId).includes("POLICY_APPROVER")) {
    return { error: "Only a Policy Approver can reject a version." };
  }
  const version = policy.versions.find((item: any) => item.id === versionId);
  if (!version) return null;
  if (version.status !== "IN_REVIEW") {
    return { error: "Only versions awaiting approval can be rejected." };
  }
  version.status = "DRAFT";
  version.rejectionReason = reason;
  policy.status = policy.currentVersionId ? "PUBLISHED" : "DRAFT";
  return { policy };
};

export const memoryPublishVersion = (policyId: string, versionId: string, actorId: string) => {
  const state = getMemoryState();
  const policy = state.policies.find(item => item.id === policyId);
  if (!policy) return null;
  if (!actorRoleCodes(state, actorId).includes("POLICY_APPROVER")) {
    return { error: "Only a Policy Approver can publish a policy version." };
  }
  const target = policy.versions.find((item: any) => item.id === versionId);
  if (!target) return null;
  if (target.status !== "IN_REVIEW") {
    return { error: "Only versions awaiting approval can be published. Submit the version for approval first." };
  }
  if (target.rules.length === 0) {
    return { error: "A policy version without rules cannot be published." };
  }
  const invalidRule = target.rules
    .map((rule: any) => ({ rule, contradiction: findConditionContradiction(rule.condition) }))
    .find((item: any) => item.contradiction);
  if (invalidRule) {
    return { error: `Rule "${invalidRule.rule.name}" is contradictory: ${invalidRule.contradiction}` };
  }
  const nextVersionNumber =
    Math.max(
      0,
      ...policy.versions
        .map((version: any) => version.versionNumber)
        .filter((versionNumber: unknown): versionNumber is number => typeof versionNumber === "number"),
    ) + 1;
  const publishedAt = now();
  policy.versions.forEach((version: any) => {
    if (version.id === versionId) {
      version.versionNumber = nextVersionNumber;
      version.status = "PUBLISHED";
      version.effectiveFrom = publishedAt;
      version.effectiveTo = null;
      version.approvedById = actorId;
      version.approvedBy = userById(state, actorId);
      version.approvedAt = publishedAt;
    } else if (version.status === "PUBLISHED") {
      version.status = "ARCHIVED";
      version.effectiveTo = publishedAt;
    }
  });
  policy.status = "PUBLISHED";
  policy.currentVersionId = versionId;
  state.auditEvents.push({
    action: "POLICY_VERSION_PUBLISHED",
    entityId: versionId,
    actorId,
    metadata: { policyId, versionNumber: nextVersionNumber },
    createdAt: publishedAt,
  });
  return { policy };
};

export const memoryCreateRule = (input: any) => {
  const state = getMemoryState();
  const policy = state.policies.find(item => item.versions.some((version: any) => version.id === input.policyVersionId));
  const version = policy?.versions.find((item: any) => item.id === input.policyVersionId);
  if (!policy || !version) return null;
  if (version.status !== "DRAFT") {
    return { error: "Rules can only be added to DRAFT policy versions." };
  }
  const rule = { id: id("rule"), createdAt: now(), updatedAt: now(), ...input };
  version.rules.push(rule);
  return { policy, rule };
};

export const memoryUpdateRule = (ruleId: string, input: any) => {
  const state = getMemoryState();
  const policy = state.policies.find(item =>
    item.versions.some((version: any) =>
      version.rules.some((rule: any) => rule.id === ruleId),
    ),
  );
  const version = policy?.versions.find((item: any) =>
    item.rules.some((rule: any) => rule.id === ruleId),
  );
  const rule = version?.rules.find((item: any) => item.id === ruleId);
  if (!policy || !version || !rule) return null;
  if (version.status !== "DRAFT") {
    return { error: "Rules can only be edited in DRAFT policy versions." };
  }

  Object.assign(rule, input, { updatedAt: now() });
  return { policy, rule };
};

export const memoryTestRules = (input: any, draftRule?: any, policyVersionId?: string) => {
  const state = getMemoryState();
  const facts = { ...demoRequestInput, ...input };
  if (policyVersionId) {
    const policy = state.policies.find(item =>
      item.versions.some((version: any) => version.id === policyVersionId),
    );
    const version = policy?.versions.find((item: any) => item.id === policyVersionId);
    if (!policy || !version) {
      throw new Error("Policy version not found.");
    }
    if (!["DRAFT", "IN_REVIEW"].includes(version.status)) {
      throw new Error("Only a draft or review version can be tested in the rule console.");
    }
    const prospectiveVersionNumber =
      Math.max(
        0,
        ...policy.versions
          .map((item: any) => item.versionNumber)
          .filter((value: unknown): value is number => typeof value === "number"),
      ) + 1;

    return {
      result: evaluatePolicyVersions(facts, [
        {
          id: version.id,
          policyId: policy.id,
          policyName: policy.name,
          policyDomain: policy.domain,
          versionNumber: prospectiveVersionNumber,
          rules: version.rules.map((rule: any) => ({
            ...rule,
            policyId: policy.id,
            policyName: policy.name,
            policyDomain: policy.domain,
            policyVersionId: version.id,
            policyVersionNumber: prospectiveVersionNumber,
          })),
        },
      ]),
    };
  }
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
