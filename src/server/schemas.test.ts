import { describe, expect, it } from "vitest";
import { ruleTestSchema } from "./schemas";

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
