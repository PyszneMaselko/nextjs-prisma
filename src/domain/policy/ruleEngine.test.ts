import { describe, expect, it } from "vitest";
import { demoPolicyVersions, demoRequestInput } from "./demoData";
import { evaluatePolicyVersions } from "./ruleEngine";
import { PolicyVersionDefinition } from "./types";

describe("evaluatePolicyVersions", () => {
  it("returns the expected decision for the Acme SaaS demo request", () => {
    const result = evaluatePolicyVersions(demoRequestInput, demoPolicyVersions);

    expect(result.decision).toBe("MISSING_INFORMATION");
    expect(result.missingFields).toEqual([{ field: "dpaDocument", label: "Dokument DPA" }]);
    expect(result.requiredApprovers).toEqual(["Procurement", "DPO"]);
    expect(result.reasons).toContain(
      "Roczny koszt przekracza 5 000 EUR, wymagana jest ocena działu zakupów.",
    );
    expect(result.reasons).toContain("Dostawca przetwarza dane osobowe, DPA jest wymagane.");
    expect(result.matchedPolicyVersions.map(policy => policy.policyName)).toEqual([
      "Polityka akceptacji zakupów",
      "Polityka przetwarzania danych osobowych",
    ]);
  });

  it("keeps REJECTED as the final decision when lower-priority effects also match", () => {
    const policies: PolicyVersionDefinition[] = [
      {
        id: "version-test",
        policyId: "policy-test",
        policyName: "Test policy",
        policyDomain: "PROCUREMENT",
        versionNumber: 1,
        rules: [
          {
            id: "missing",
            name: "Missing DPA",
            description: "Requires DPA.",
            severity: "BLOCKER",
            condition: { field: "hasDpa", operator: "equals", value: false },
            effects: [{ type: "REQUIRE_FIELD", field: "dpaDocument", label: "DPA" }],
            reason: "DPA is missing.",
            enabled: true,
            priority: 1,
            policyId: "policy-test",
            policyName: "Test policy",
            policyDomain: "PROCUREMENT",
            policyVersionId: "version-test",
            policyVersionNumber: 1,
          },
          {
            id: "reject",
            name: "Rejected country",
            description: "Rejects a blocked country.",
            severity: "BLOCKER",
            condition: { field: "vendorCountry", operator: "equals", value: "BLOCKED" },
            effects: [{ type: "REJECT" }],
            reason: "Vendor country is blocked.",
            enabled: true,
            priority: 2,
            policyId: "policy-test",
            policyName: "Test policy",
            policyDomain: "PROCUREMENT",
            policyVersionId: "version-test",
            policyVersionNumber: 1,
          },
        ],
      },
    ];

    const result = evaluatePolicyVersions(
      { hasDpa: false, vendorCountry: "BLOCKED" },
      policies,
    );

    expect(result.decision).toBe("REJECTED");
    expect(result.missingFields).toEqual([{ field: "dpaDocument", label: "DPA" }]);
  });
});
