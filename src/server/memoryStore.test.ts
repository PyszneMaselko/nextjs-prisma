import { beforeEach, describe, expect, it } from "vitest";
import {
  memoryCreatePolicy,
  memoryCreateRequest,
  memoryCreateRule,
  memoryCreateVersion,
  memoryAddAttachment,
  memoryAddComment,
  memoryAddOverride,
  memoryGetRequest,
  memoryGetRequestForActor,
  memoryUpdateRequest,
  memoryListRequests,
  memoryPolicies,
  memoryPublishVersion,
  memorySubmitVersionForApproval,
  memoryTestRules,
  memoryUpdateRule,
  resetMemoryState,
} from "./memoryStore";

describe("memory policy lifecycle", () => {
  beforeEach(() => {
    resetMemoryState();
  });

  const createReviewRequest = () =>
    memoryCreateRequest({
      title: "Reviewable SaaS request",
      description: "A complete request that requires a procurement review.",
      type: "NEW_SOFTWARE",
      category: "SAAS",
      annualCost: 8000,
      currency: "EUR",
      vendorName: "Reviewable vendor",
      vendorCountry: "PL",
      department: "ENGINEERING",
      urgency: "NORMAL",
      justification: "Reviewer workflow test.",
      processesPersonalData: false,
      dataCategories: [],
      dataClassification: "NONE",
      hasDpa: false,
      transfersOutsideEea: false,
      requiresSecurityQuestionnaire: false,
      vendorRisk: "LOW",
      requesterId: "user-requester",
      businessOwnerId: "user-business-owner",
      budgetOwnerId: "user-budget-owner",
      mode: "submit",
    });

  it("keeps the published version active while a newer version is drafted and reviewed", () => {
    const created = memoryCreateVersion("policy-data-processing", {
      authorId: "user-policy-owner",
      changeSummary: "Draft threshold update",
      copyCurrentRules: true,
    });

    expect(created).not.toBeNull();
    const draft = created!.policy.versions.find((version: any) => version.status === "DRAFT");
    expect(created!.policy.status).toBe("PUBLISHED");
    expect(draft).toBeDefined();
    expect(draft.versionNumber).toBeNull();

    const existingRule = draft.rules[0];
    const updatedRule = memoryUpdateRule(existingRule.id, {
      ...existingRule,
      name: "Updated draft threshold rule",
    });
    expect(updatedRule).not.toBeNull();
    expect(updatedRule!.rule.name).toBe("Updated draft threshold rule");

    const duringDraft = memoryTestRules({ annualCost: 8000, category: "SAAS", currency: "EUR" });
    expect(duringDraft.result.appliedPolicyVersions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ policyVersionId: "version-data-processing-v1" }),
      ]),
    );

    const submitted = memorySubmitVersionForApproval(
      "policy-data-processing",
      draft.id,
      "user-policy-owner",
    );
    expect(submitted).not.toBeNull();
    expect(submitted!.policy.status).toBe("PUBLISHED");
    expect(draft.status).toBe("IN_REVIEW");

    const ruleResult = memoryCreateRule({
      policyVersionId: draft.id,
      name: "Late rule",
      description: "Must not be added after submission.",
      severity: "WARNING",
      condition: { field: "annualCost", operator: "greater_than", value: 1 },
      effects: [{ type: "REQUIRE_REVIEW" }],
      reason: "Late mutation",
      enabled: true,
      priority: 100,
    });
    expect(ruleResult).toEqual({
      error: "Rules can only be added to DRAFT policy versions.",
    });

    const published = memoryPublishVersion(
      "policy-data-processing",
      draft.id,
      "user-policy-approver",
    );
    expect(published).not.toBeNull();
    expect(published!.policy.currentVersionId).toBe(draft.id);
    expect(draft).toMatchObject({
      versionNumber: 2,
      status: "PUBLISHED",
      approvedById: "user-policy-approver",
    });
    expect(
      published!.policy.versions.find(
        (version: any) => version.id === "version-data-processing-v1",
      ),
    ).toMatchObject({ versionNumber: 1, status: "ARCHIVED" });
  });

  it("filters requester lists to the selected requester", () => {
    const result = memoryListRequests({ requesterId: "user-requester", page: 1, pageSize: 20 });
    expect(result.requests.length).toBeGreaterThan(0);
    expect(result.requests.every((request: any) => request.requesterId === "user-requester")).toBe(
      true,
    );

    const empty = memoryListRequests({ requesterId: "user-policy-owner", page: 1, pageSize: 20 });
    expect(empty.requests).toHaveLength(0);
  });

  it("hides internal comments from requesters and exposes them to audit-capable roles", () => {
    const request = createReviewRequest();
    const commented = memoryAddComment(request.id, {
      authorId: "user-reviewer",
      visibility: "INTERNAL",
      body: "Internal reviewer note.",
    });

    expect(commented).toMatchObject({
      comments: [expect.objectContaining({ visibility: "INTERNAL" })],
    });
    expect(memoryGetRequestForActor(request.id, "user-requester")).toMatchObject({
      comments: [],
    });
    expect(memoryGetRequestForActor(request.id, "user-reviewer")).toMatchObject({
      comments: [expect.objectContaining({ body: "Internal reviewer note." })],
    });
    expect(memoryGetRequestForActor(request.id, "user-auditor")).toMatchObject({
      comments: [expect.objectContaining({ body: "Internal reviewer note." })],
    });
    expect(memoryGetRequestForActor(request.id, "user-policy-owner")).toMatchObject({
      comments: [expect.objectContaining({ body: "Internal reviewer note." })],
    });
  });

  it("uploads a missing DPA and immediately re-evaluates the request", () => {
    const before = memoryGetRequest("request-demo-acme-analytics");
    expect(before).toMatchObject({
      status: "NEEDS_INFORMATION",
      hasDpa: false,
    });
    const evaluationCountBeforeUpload = before?.evaluations.length ?? 0;

    const updated = memoryAddAttachment("request-demo-acme-analytics", {
      uploadedById: "user-requester",
      attachmentType: "DPA",
      fileName: "acme-dpa.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      storageKey: "metadata:acme-dpa.pdf",
    });

    expect(updated).toMatchObject({
      status: "IN_REVIEW",
      hasDpa: true,
      latestEvaluation: {
        decision: "REQUIRES_REVIEW",
        resultSnapshot: { missingFields: [] },
      },
      attachments: [expect.objectContaining({ attachmentType: "DPA" })],
    });
    expect(updated.evaluations).toHaveLength(evaluationCountBeforeUpload + 1);
  });

  it("always creates new policies as drafts", () => {
    const result = memoryCreatePolicy({
      ownerId: "user-policy-owner",
      name: "Draft policy",
      description: "Policy awaiting its approval cycle.",
      domain: "PROCUREMENT",
      changeSummary: "Initial version",
      publish: true,
    });

    expect(result.policy.status).toBe("DRAFT");
    expect(result.policy.currentVersionId).toBeNull();
    expect(result.policy.versions[0].status).toBe("DRAFT");
    expect(result.policy.versions[0].versionNumber).toBeNull();
    expect(
      memorySubmitVersionForApproval(
        result.policy.id,
        result.policy.versions[0].id,
        "user-policy-owner",
      ),
    ).toEqual({
      error: "Add and save at least one rule before submitting the version for approval.",
    });
  });

  it("exposes the pending approval without deactivating the current published version", () => {
    const policy = memoryPolicies().policies.find(
      (item: any) => item.id === "policy-procurement",
    );

    expect(policy.status).toBe("PUBLISHED");
    expect(policy.versions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "version-procurement-v1",
          status: "PUBLISHED",
        }),
        expect.objectContaining({
          id: "version-procurement-v2-pending",
          status: "IN_REVIEW",
          versionNumber: null,
        }),
      ]),
    );
  });

  it("tests a saved draft version without publishing it", () => {
    const created = memoryCreateVersion("policy-data-processing", {
      authorId: "user-policy-owner",
      changeSummary: "Draft console test",
      copyCurrentRules: true,
    });
    const draft = created!.policy.versions.find((version: any) => version.status === "DRAFT");

    const result = memoryTestRules(
      { annualCost: 8000, category: "SAAS", currency: "EUR" },
      undefined,
      draft.id,
    );

    expect(result.result.appliedPolicyVersions).toEqual([
      expect.objectContaining({
        policyVersionId: draft.id,
        versionNumber: 2,
      }),
    ]);
    expect(draft.versionNumber).toBeNull();
  });

  it("uses the newly published version when testing active policies", () => {
    const created = memoryCreateVersion("policy-data-processing", {
      authorId: "user-policy-owner",
      changeSummary: "Published console regression test",
      copyCurrentRules: true,
    });
    const draft = created!.policy.versions.find((version: any) => version.status === "DRAFT");

    expect(memorySubmitVersionForApproval(
      "policy-data-processing",
      draft.id,
      "user-policy-owner",
    )).not.toHaveProperty("error");
    expect(memoryPublishVersion(
      "policy-data-processing",
      draft.id,
      "user-policy-approver",
    )).not.toHaveProperty("error");

    const activeTest = memoryTestRules({ processesPersonalData: true, hasDpa: false });
    expect(activeTest.result.appliedPolicyVersions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyVersionId: draft.id,
          versionNumber: 2,
        }),
      ]),
    );
    expect(activeTest.result.ruleResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyVersionId: draft.id,
          matched: true,
        }),
      ]),
    );
  });

  it("blocks a contradictory ALL rule before approval", () => {
    const created = memoryCreateVersion("policy-data-processing", {
      authorId: "user-policy-owner",
      changeSummary: "Contradictory condition test",
      copyCurrentRules: false,
    });
    const draft = created!.policy.versions.find((version: any) => version.status === "DRAFT");
    memoryCreateRule({
      policyVersionId: draft.id,
      name: "Impossible risk rule",
      description: "A vendor cannot have two risk values at once.",
      severity: "BLOCKER",
      condition: {
        combinator: "ALL",
        conditions: [
          { field: "vendorRisk", operator: "equals", value: "HIGH" },
          { field: "vendorRisk", operator: "equals", value: "MEDIUM" },
        ],
      },
      effects: [{ type: "REQUIRE_REVIEW", approver: "Security" }],
      reason: "Impossible condition",
      enabled: true,
      priority: 10,
    });

    expect(memorySubmitVersionForApproval(
      "policy-data-processing",
      draft.id,
      "user-policy-owner",
    )).toMatchObject({ error: expect.stringContaining("cannot equal HIGH and MEDIUM") });
  });

  it("prevents parallel draft or review versions for one policy", () => {
    const result = memoryCreateVersion("policy-procurement", {
      authorId: "user-policy-owner",
      changeSummary: "Parallel draft",
      copyCurrentRules: true,
    });

    expect(result).toEqual({
      error: "Finish the existing DRAFT or IN_REVIEW version before creating another draft.",
    });
  });

  it("maps manual override decisions to the same request statuses as the database path", () => {
    const request = createReviewRequest();
    memoryAddOverride(request.id, {
      createdById: "user-reviewer",
      approverId: "user-policy-owner",
      newDecision: "REJECTED",
      reason: "Reviewer rejected the request.",
      comment: "The documented exception criteria were not met.",
    });

    expect(memoryGetRequest(request.id)?.status).toBe("REJECTED");
  });

  it("treats a plain reviewer approval as APPROVED and an exception as APPROVED_WITH_EXCEPTION", () => {
    const plainRequest = createReviewRequest();
    memoryAddOverride(plainRequest.id, {
      createdById: "user-reviewer",
      approverId: "user-reviewer",
      newDecision: "APPROVED",
      reason: "Reviewer accepts the request after manual review.",
      comment: "Policy requirements are satisfied.",
    });
    expect(memoryGetRequest(plainRequest.id)).toMatchObject({
      status: "APPROVED",
      manualOverrides: [expect.objectContaining({ isException: false })],
    });

    const exceptionRequest = createReviewRequest();
    memoryAddOverride(exceptionRequest.id, {
      createdById: "user-reviewer",
      approverId: "user-policy-owner",
      newDecision: "APPROVED",
      exception: true,
      reason: "Business exception approved despite the outstanding concern.",
      comment: "Residual risk accepted with a compensating control.",
    });
    expect(memoryGetRequest(exceptionRequest.id)).toMatchObject({
      status: "APPROVED_WITH_EXCEPTION",
      manualOverrides: [expect.objectContaining({ isException: true })],
    });
  });

  it("rejects reviewer decisions outside the review queue or from the wrong role", () => {
    expect(
      memoryAddOverride("request-demo-acme-analytics", {
        createdById: "user-reviewer",
        approverId: "user-reviewer",
        newDecision: "APPROVED",
        reason: "Invalid state.",
        comment: "The request is not currently in review.",
      }),
    ).toEqual({
      error: "Reviewer decisions can only be recorded for requests in IN_REVIEW.",
    });

    const request = createReviewRequest();
    expect(
      memoryAddOverride(request.id, {
        createdById: "user-requester",
        approverId: "user-requester",
        newDecision: "APPROVED",
        reason: "Invalid actor.",
        comment: "A requester cannot decide a review.",
      }),
    ).toEqual({
      error: "Only a Reviewer or Admin can record a reviewer decision.",
    });
  });

  it("enforces ownership and only edits draft or missing-information requests", () => {
    const forbidden = memoryUpdateRequest("request-demo-acme-analytics", {
      requesterId: "user-policy-owner",
      title: "Updated missing-information request",
      mode: "draft",
    });

    expect(forbidden).toEqual({
      error: "Only a Requester or Admin can update a request.",
    });

    const updated = memoryUpdateRequest("request-demo-acme-analytics", {
      requesterId: "user-requester",
      title: "Updated missing-information request",
      mode: "draft",
    });

    expect(updated).toMatchObject({
      requesterId: "user-requester",
      status: "NEEDS_INFORMATION",
      title: "Updated missing-information request",
    });

    const submitted = memoryCreateRequest({
      title: "Locked request",
      description: "Already submitted and evaluated.",
      type: "NEW_SOFTWARE",
      category: "SAAS",
      annualCost: 8000,
      currency: "EUR",
      vendorName: "Locked vendor",
      vendorCountry: "PL",
      department: "ENGINEERING",
      urgency: "NORMAL",
      justification: "State transition test.",
      processesPersonalData: false,
      dataCategories: [],
      dataClassification: "NONE",
      hasDpa: false,
      transfersOutsideEea: false,
      requiresSecurityQuestionnaire: false,
      vendorRisk: "LOW",
      requesterId: "user-requester",
      businessOwnerId: "user-business-owner",
      budgetOwnerId: "user-budget-owner",
      mode: "submit",
    });

    expect(
      memoryUpdateRequest(submitted.id, {
        requesterId: "user-requester",
        title: "Forbidden edit",
      }),
    ).toEqual({
      error: "Only DRAFT or NEEDS_INFORMATION requests can be edited.",
    });
  });
});
