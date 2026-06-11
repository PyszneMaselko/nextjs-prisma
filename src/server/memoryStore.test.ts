import { beforeEach, describe, expect, it } from "vitest";
import {
  memoryCreatePolicy,
  memoryCreateRequest,
  memoryCreateRule,
  memoryCreateVersion,
  memoryAddOverride,
  memoryGetRequest,
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
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].requesterId).toBe("user-requester");

    const empty = memoryListRequests({ requesterId: "user-policy-owner", page: 1, pageSize: 20 });
    expect(empty.requests).toHaveLength(0);
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
    memoryAddOverride("request-demo-acme-analytics", {
      createdById: "user-reviewer",
      approverId: "user-policy-owner",
      newDecision: "REJECTED",
      reason: "Reviewer rejected the request.",
      comment: "The documented exception criteria were not met.",
    });

    expect(memoryGetRequest("request-demo-acme-analytics")?.status).toBe("REJECTED");
  });

  it("treats a plain reviewer approval as APPROVED and an exception as APPROVED_WITH_EXCEPTION", () => {
    memoryAddOverride("request-demo-acme-analytics", {
      createdById: "user-reviewer",
      approverId: "user-reviewer",
      newDecision: "APPROVED",
      reason: "Reviewer accepts the request after manual review.",
      comment: "Policy requirements are satisfied.",
    });
    expect(memoryGetRequest("request-demo-acme-analytics")?.status).toBe("APPROVED");

    memoryAddOverride("request-demo-acme-analytics", {
      createdById: "user-reviewer",
      approverId: "user-policy-owner",
      newDecision: "APPROVED",
      exception: true,
      reason: "Business exception approved despite the outstanding concern.",
      comment: "Residual risk accepted with a compensating control.",
    });
    expect(memoryGetRequest("request-demo-acme-analytics")?.status).toBe("APPROVED_WITH_EXCEPTION");
  });

  it("keeps ownership immutable and only edits draft or missing-information requests", () => {
    const updated = memoryUpdateRequest("request-demo-acme-analytics", {
      requesterId: "user-policy-owner",
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

    expect(memoryUpdateRequest(submitted.id, { title: "Forbidden edit" })).toEqual({
      error: "Only DRAFT or NEEDS_INFORMATION requests can be edited.",
    });
  });
});
