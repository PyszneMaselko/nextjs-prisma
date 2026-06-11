import { describe, expect, it } from "vitest";
import { createRequestSchema, manualOverrideSchema, ruleTestSchema } from "./schemas";

describe("ruleTestSchema", () => {
  it("accepts an unsaved rule without a target policy version or metadata", () => {
    const parsed = ruleTestSchema.parse({
      input: {
        annualCost: 8000,
        category: "SAAS",
      },
      draftRule: {
        severity: "WARNING",
        condition: {
          field: "annualCost",
          operator: "greater_than",
          value: 5000,
        },
        effects: [{ type: "REQUIRE_REVIEW" }],
        enabled: true,
        priority: 100,
      },
    });

    expect(parsed.draftRule).toMatchObject({
      name: "Test rule",
      description: "Temporary rule tested in the rule console.",
      reason: "The temporary test rule matched.",
    });
    expect(parsed.draftRule).not.toHaveProperty("policyVersionId");
  });

  it("accepts a saved draft version as the console target", () => {
    const parsed = ruleTestSchema.parse({
      input: { annualCost: 8000 },
      policyVersionId: "draft-version",
    });

    expect(parsed.policyVersionId).toBe("draft-version");
    expect(parsed.draftRule).toBeUndefined();
  });

  it("rejects testing a saved version and editor rule at the same time", () => {
    expect(() =>
      ruleTestSchema.parse({
        input: { annualCost: 8000 },
        policyVersionId: "draft-version",
        draftRule: {
          severity: "WARNING",
          condition: { field: "annualCost", operator: "greater_than", value: 5000 },
          effects: [{ type: "REQUIRE_REVIEW" }],
          enabled: true,
          priority: 100,
        },
      }),
    ).toThrow();
  });
});

describe("request and reviewer schemas", () => {
  const completeRequest = {
    title: "SaaS request",
    description: "Purchase request description.",
    type: "NEW_SOFTWARE",
    category: "SAAS",
    annualCost: 8000,
    currency: "EUR",
    vendorName: "Example vendor",
    vendorCountry: "PL",
    department: "ENGINEERING",
    urgency: "NORMAL",
    justification: "Required for the engineering team.",
    processesPersonalData: true,
    dataCategories: ["CONTACT_DATA"],
    dataClassification: "PERSONAL_DATA",
    hasDpa: false,
    transfersOutsideEea: false,
    requiresSecurityQuestionnaire: true,
    vendorRisk: "UNKNOWN",
    requesterId: "user-requester",
    businessOwnerId: "user-business-owner",
    budgetOwnerId: null,
    mode: "submit",
  };

  it("requires data categories when a submitted request processes personal data", () => {
    expect(() =>
      createRequestSchema.parse({
        ...completeRequest,
        dataCategories: [],
      }),
    ).toThrow();

    expect(createRequestSchema.parse(completeRequest).dataCategories).toEqual(["CONTACT_DATA"]);
  });

  it("only permits APPROVED as an exception decision", () => {
    expect(() =>
      manualOverrideSchema.parse({
        createdById: "user-reviewer",
        approverId: "user-policy-owner",
        newDecision: "REJECTED",
        exception: true,
        reason: "Invalid exception.",
        comment: "Exceptions can only approve a request.",
      }),
    ).toThrow();
  });
});
