import { PolicyVersionDefinition } from "./types";

export const demoRoles = [
  {
    id: "role-requester",
    code: "REQUESTER",
    name: "Requester",
    description: "Składa i uzupełnia własne wnioski.",
  },
  {
    id: "role-reviewer",
    code: "REVIEWER",
    name: "Reviewer",
    description: "Ocenia wnioski wymagające decyzji człowieka.",
  },
  {
    id: "role-policy-owner",
    code: "POLICY_OWNER",
    name: "Policy Owner",
    description: "Tworzy polityki, wersje i reguły.",
  },
  {
    id: "role-policy-approver",
    code: "POLICY_APPROVER",
    name: "Policy Approver",
    description: "Publikuje zatwierdzone wersje polityk.",
  },
  {
    id: "role-admin",
    code: "ADMIN",
    name: "Admin",
    description: "Zarządza konfiguracją systemu.",
  },
  {
    id: "role-auditor",
    code: "AUDITOR",
    name: "Auditor",
    description: "Ma wgląd w historię i snapshoty decyzji.",
  },
] as const;

export const demoUsers = [
  {
    id: "user-requester",
    name: "Maja Requester",
    email: "maja.requester@example.com",
    roles: ["REQUESTER"],
  },
  {
    id: "user-reviewer",
    name: "Olek Reviewer",
    email: "olek.reviewer@example.com",
    roles: ["REVIEWER"],
  },
  {
    id: "user-policy-owner",
    name: "Nina Policy Owner",
    email: "nina.policy@example.com",
    roles: ["POLICY_OWNER", "POLICY_APPROVER"],
  },
  {
    id: "user-auditor",
    name: "Adam Auditor",
    email: "adam.auditor@example.com",
    roles: ["AUDITOR"],
  },
  {
    id: "user-business-owner",
    name: "Kasia Business Owner",
    email: "kasia.owner@example.com",
    roles: ["REQUESTER"],
  },
  {
    id: "user-budget-owner",
    name: "Filip Finance",
    email: "filip.finance@example.com",
    roles: ["REVIEWER"],
  },
] as const;

export const demoPolicyVersions: PolicyVersionDefinition[] = [
  {
    id: "version-procurement-v1",
    policyId: "policy-procurement",
    policyName: "Polityka akceptacji zakupów",
    policyDomain: "PROCUREMENT",
    versionNumber: 1,
    rules: [
      {
        id: "rule-saas-over-5000",
        name: "SaaS powyżej 5 000 EUR wymaga oceny zakupów",
        description: "Zakupy SaaS powyżej progu kosztowego wymagają oceny działu zakupów.",
        severity: "WARNING",
        condition: {
          combinator: "ALL",
          conditions: [
            { field: "category", operator: "equals", value: "SAAS" },
            { field: "currency", operator: "equals", value: "EUR" },
            { field: "annualCost", operator: "greater_than", value: 5000 },
          ],
        },
        effects: [
          {
            type: "REQUIRE_REVIEW",
            approver: "Procurement",
            nextStep: "Uzyskaj ocenę działu zakupów.",
          },
        ],
        reason: "Roczny koszt przekracza 5 000 EUR, wymagana jest ocena działu zakupów.",
        enabled: true,
        priority: 10,
        policyId: "policy-procurement",
        policyName: "Polityka akceptacji zakupów",
        policyDomain: "PROCUREMENT",
        policyVersionId: "version-procurement-v1",
        policyVersionNumber: 1,
      },
      {
        id: "rule-emergency-justification",
        name: "Zakup awaryjny wymaga uzasadnienia",
        description: "Zakupy w trybie awaryjnym muszą mieć dodatkowe uzasadnienie.",
        severity: "WARNING",
        condition: {
          combinator: "ALL",
          conditions: [
            { field: "urgency", operator: "equals", value: "EMERGENCY" },
            { field: "emergencyJustification", operator: "is_empty" },
          ],
        },
        effects: [
          {
            type: "REQUIRE_FIELD",
            field: "emergencyJustification",
            label: "Uzasadnienie zakupu awaryjnego",
            nextStep: "Uzupełnij uzasadnienie zakupu awaryjnego.",
          },
          { type: "ADD_REASON_CODE", code: "EMERGENCY_PURCHASE" },
        ],
        reason: "Zakupy awaryjne wymagają dodatkowego uzasadnienia.",
        enabled: true,
        priority: 40,
        policyId: "policy-procurement",
        policyName: "Polityka akceptacji zakupów",
        policyDomain: "PROCUREMENT",
        policyVersionId: "version-procurement-v1",
        policyVersionNumber: 1,
      },
    ],
  },
  {
    id: "version-data-processing-v1",
    policyId: "policy-data-processing",
    policyName: "Polityka przetwarzania danych osobowych",
    policyDomain: "DATA_SECURITY",
    versionNumber: 1,
    rules: [
      {
        id: "rule-dpa-required",
        name: "DPA wymagane przy przetwarzaniu danych osobowych",
        description: "DPA jest wymagane, gdy dostawca przetwarza dane osobowe.",
        severity: "BLOCKER",
        condition: {
          combinator: "ALL",
          conditions: [
            { field: "processesPersonalData", operator: "equals", value: true },
            { field: "hasDpa", operator: "equals", value: false },
          ],
        },
        effects: [
          {
            type: "REQUIRE_FIELD",
            field: "dpaDocument",
            label: "Dokument DPA",
            approver: "DPO",
            nextStep: "Dodaj dokument DPA i przekaż do weryfikacji DPO.",
          },
        ],
        reason: "Dostawca przetwarza dane osobowe, DPA jest wymagane.",
        enabled: true,
        priority: 20,
        policyId: "policy-data-processing",
        policyName: "Polityka przetwarzania danych osobowych",
        policyDomain: "DATA_SECURITY",
        policyVersionId: "version-data-processing-v1",
        policyVersionNumber: 1,
      },
    ],
  },
  {
    id: "version-vendor-risk-v1",
    policyId: "policy-vendor-risk",
    policyName: "Polityka ryzyka dostawcy",
    policyDomain: "VENDOR_RISK",
    versionNumber: 1,
    rules: [
      {
        id: "rule-high-risk-vendor",
        name: "Dostawca wysokiego ryzyka wymaga oceny bezpieczeństwa",
        description: "Dostawcy oznaczeni jako high risk wymagają oceny Security.",
        severity: "WARNING",
        condition: {
          combinator: "ALL",
          conditions: [{ field: "vendorRisk", operator: "equals", value: "HIGH" }],
        },
        effects: [
          {
            type: "REQUIRE_REVIEW",
            approver: "Security",
            nextStep: "Uzyskaj ocenę zespołu bezpieczeństwa.",
          },
        ],
        reason: "Dostawcy wysokiego ryzyka wymagają oceny bezpieczeństwa.",
        enabled: true,
        priority: 30,
        policyId: "policy-vendor-risk",
        policyName: "Polityka ryzyka dostawcy",
        policyDomain: "VENDOR_RISK",
        policyVersionId: "version-vendor-risk-v1",
        policyVersionNumber: 1,
      },
    ],
  },
  {
    id: "version-finance-v1",
    policyId: "policy-finance",
    policyName: "Polityka akceptacji finansowej",
    policyDomain: "FINANCE",
    versionNumber: 1,
    rules: [
      {
        id: "rule-large-purchase-cfo",
        name: "Duże zakupy wymagają akceptacji CFO",
        description: "Zakupy powyżej 50 000 EUR wymagają akceptacji finansowej i CFO.",
        severity: "WARNING",
        condition: {
          combinator: "ALL",
          conditions: [{ field: "annualCost", operator: "greater_or_equal", value: 50000 }],
        },
        effects: [
          {
            type: "REQUIRE_REVIEW",
            approver: "Finance",
            nextStep: "Uzyskaj akceptację finansów.",
          },
          {
            type: "REQUIRE_REVIEW",
            approver: "CFO",
            nextStep: "Uzyskaj akceptację CFO.",
          },
        ],
        reason: "Zakupy powyżej 50 000 EUR wymagają akceptacji finansowej.",
        enabled: true,
        priority: 50,
        policyId: "policy-finance",
        policyName: "Polityka akceptacji finansowej",
        policyDomain: "FINANCE",
        policyVersionId: "version-finance-v1",
        policyVersionNumber: 1,
      },
    ],
  },
];

export const demoRequestInput = {
  title: "Acme Analytics dla zespołu marketingu",
  description: "Nowe narzędzie SaaS do analityki kampanii i segmentacji odbiorców.",
  type: "NEW_SOFTWARE",
  category: "SAAS",
  annualCost: 8000,
  currency: "EUR",
  vendorName: "Acme Analytics",
  vendorCountry: "US",
  department: "MARKETING",
  businessOwnerId: "user-business-owner",
  budgetOwnerId: "user-budget-owner",
  requesterId: "user-requester",
  processesPersonalData: true,
  dataCategories: ["PERSONAL_DATA"],
  dataClassification: "PERSONAL_DATA",
  hasDpa: false,
  transfersOutsideEea: true,
  requiresSecurityQuestionnaire: true,
  urgency: "NORMAL",
  justification: "Marketing potrzebuje spójnego narzędzia do raportowania kampanii.",
  vendorRisk: "UNKNOWN",
  dpaDocument: "",
  emergencyJustification: "",
};
