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
  {
    id: "role-business-owner",
    code: "BUSINESS_OWNER",
    name: "Business Owner",
    description: "Może pełnić rolę właściciela biznesowego wniosku.",
  },
  {
    id: "role-budget-owner",
    code: "BUDGET_OWNER",
    name: "Budget Owner",
    description: "Może pełnić rolę właściciela budżetu wniosku.",
  },
] as const;

export const demoUsers = [
  {
    id: "user-requester",
    name: "Maja Requester",
    email: "maja.requester@example.com",
    roles: ["REQUESTER", "BUSINESS_OWNER"],
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
    roles: ["POLICY_OWNER"],
  },
  {
    id: "user-policy-approver",
    name: "Marek Policy Approver",
    email: "marek.approver@example.com",
    roles: ["POLICY_APPROVER"],
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
    roles: ["REQUESTER", "BUSINESS_OWNER", "BUDGET_OWNER"],
  },
  {
    id: "user-budget-owner",
    name: "Filip Finance",
    email: "filip.finance@example.com",
    roles: ["REVIEWER", "BUDGET_OWNER"],
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

export const demoPendingApprovalVersion = {
  id: "version-procurement-v2-pending",
  policyId: "policy-procurement",
  versionNumber: null,
  changeSummary: "Obniżenie progu oceny zakupów SaaS z 5 000 EUR do 3 000 EUR.",
  authorId: "user-policy-owner",
  rule: {
    id: "rule-saas-over-3000-pending",
    name: "SaaS powyżej 3 000 EUR wymaga oceny zakupów",
    description: "Obniżony próg kosztowy wymagający oceny działu zakupów dla zakupów SaaS.",
    severity: "WARNING" as const,
    condition: {
      combinator: "ALL",
      conditions: [
        { field: "category", operator: "equals", value: "SAAS" },
        { field: "currency", operator: "equals", value: "EUR" },
        { field: "annualCost", operator: "greater_than", value: 3000 },
      ],
    },
    effects: [
      {
        type: "REQUIRE_REVIEW",
        approver: "Procurement",
        nextStep: "Uzyskaj ocenę działu zakupów.",
      },
    ],
    reason: "Roczny koszt przekracza nowy próg 3 000 EUR, wymagana jest ocena działu zakupów.",
    enabled: true,
    priority: 10,
  },
};

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

export type DemoSeedComment = {
  authorId: string;
  visibility: "PUBLIC" | "INTERNAL";
  body: string;
};

export type DemoSeedAttachment = {
  uploadedById: string;
  attachmentType:
    | "DPA"
    | "CONTRACT"
    | "OFFER"
    | "APPROVAL_MAIL"
    | "SECURITY_QUESTIONNAIRE"
    | "VENDOR_ASSESSMENT"
    | "OTHER";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type DemoSeedOverride = {
  createdById: string;
  approverId: string;
  newDecision: "APPROVED" | "REQUIRES_REVIEW" | "REJECTED" | "MISSING_INFORMATION";
  exception: boolean;
  reason: string;
  comment: string;
};

export type DemoSeedRequest = {
  id: string;
  daysAgo: number;
  mode: "draft" | "submit";
  input: Record<string, any>;
  comments?: DemoSeedComment[];
  attachments?: DemoSeedAttachment[];
  override?: DemoSeedOverride;
};

const seedInputBase = {
  dataCategories: [] as string[],
  dataClassification: "NONE",
  hasDpa: false,
  transfersOutsideEea: false,
  requiresSecurityQuestionnaire: false,
  vendorRisk: "UNKNOWN",
  businessOwnerId: "user-business-owner",
  budgetOwnerId: "user-budget-owner",
  dpaDocument: "",
  emergencyJustification: "",
};

// A richer demo set covering every decision/status flow so the UI shows multiple requests with
// history (comments, attachments, manual overrides) straight after "Reset demo".
export const demoSeedRequests: DemoSeedRequest[] = [
  {
    // Canonical scenario from the spec (section 15): MISSING_INFORMATION (DPA missing).
    id: "request-demo-acme-analytics",
    daysAgo: 2,
    mode: "submit",
    input: { ...demoRequestInput },
    comments: [
      {
        authorId: "user-requester",
        visibility: "PUBLIC",
        body: "Demo: zakup SaaS za 8 000 EUR bez DPA, zgodnie ze scenariuszem z dokumentu.",
      },
    ],
  },
  {
    // Clean low-cost hardware purchase -> AUTO_APPROVED.
    id: "request-demo-laptops",
    daysAgo: 9,
    mode: "submit",
    input: {
      ...seedInputBase,
      title: "Laptopy dla nowych inżynierów",
      description: "Standardowe laptopy deweloperskie dla trzech nowych osób w zespole.",
      type: "HARDWARE_PURCHASE",
      category: "HARDWARE",
      annualCost: 1800,
      currency: "EUR",
      vendorName: "TechStore",
      vendorCountry: "PL",
      department: "ENGINEERING",
      urgency: "NORMAL",
      justification: "Sprzęt jest niezbędny do onboardingu nowych inżynierów.",
      processesPersonalData: false,
      vendorRisk: "LOW",
      requesterId: "user-requester",
    },
    comments: [
      {
        authorId: "user-requester",
        visibility: "PUBLIC",
        body: "Standardowy zakup sprzętu w ramach budżetu zespołu.",
      },
    ],
  },
  {
    // SaaS above the threshold, no personal data -> REQUIRES_REVIEW (procurement). Sits in the queue.
    id: "request-demo-looker",
    daysAgo: 4,
    mode: "submit",
    input: {
      ...seedInputBase,
      title: "Looker BI dla zespołu danych",
      description: "Subskrypcja narzędzia BI do raportowania i dashboardów.",
      type: "NEW_SOFTWARE",
      category: "SAAS",
      annualCost: 9000,
      currency: "EUR",
      vendorName: "Looker",
      vendorCountry: "US",
      department: "ENGINEERING",
      urgency: "NORMAL",
      justification: "Zespół danych potrzebuje narzędzia BI do raportowania.",
      processesPersonalData: false,
      vendorRisk: "LOW",
      requesterId: "user-requester",
    },
    comments: [
      {
        authorId: "user-requester",
        visibility: "PUBLIC",
        body: "Prośba o szybką ocenę — narzędzie potrzebne na nowy kwartał.",
      },
      {
        authorId: "user-reviewer",
        visibility: "INTERNAL",
        body: "Sprawdzam, czy nie mamy już podobnego narzędzia BI w organizacji.",
      },
    ],
    attachments: [
      {
        uploadedById: "user-requester",
        attachmentType: "OFFER",
        fileName: "looker-oferta.pdf",
        mimeType: "application/pdf",
        sizeBytes: 184320,
      },
    ],
  },
  {
    // Large purchase -> REQUIRES_REVIEW (finance + CFO). Owned by a second requester.
    id: "request-demo-datacenter",
    daysAgo: 6,
    mode: "submit",
    input: {
      ...seedInputBase,
      title: "Rozbudowa serwerowni",
      description: "Zakup serwerów i macierzy do rozbudowy infrastruktury on-premise.",
      type: "HARDWARE_PURCHASE",
      category: "HARDWARE",
      annualCost: 60000,
      currency: "EUR",
      vendorName: "Dell Technologies",
      vendorCountry: "DE",
      department: "OPERATIONS",
      urgency: "HIGH",
      justification: "Obecna infrastruktura osiągnęła limit wydajności.",
      processesPersonalData: false,
      vendorRisk: "MEDIUM",
      requesterId: "user-business-owner",
      businessOwnerId: "user-business-owner",
    },
    comments: [
      {
        authorId: "user-business-owner",
        visibility: "PUBLIC",
        body: "Pilna rozbudowa — prosimy o akceptację finansową.",
      },
    ],
  },
  {
    // High-risk vendor -> REQUIRES_REVIEW, then approved as a documented exception (UC-9).
    id: "request-demo-pentest",
    daysAgo: 12,
    mode: "submit",
    input: {
      ...seedInputBase,
      title: "Usługa testów penetracyjnych",
      description: "Jednorazowy audyt bezpieczeństwa aplikacji przez zewnętrznego dostawcę.",
      type: "CONSULTING_SERVICE",
      category: "CONSULTING",
      annualCost: 12000,
      currency: "EUR",
      vendorName: "RedTeam Labs",
      vendorCountry: "GB",
      department: "SECURITY",
      urgency: "NORMAL",
      justification: "Wymóg zgodności — coroczny test penetracyjny.",
      processesPersonalData: false,
      vendorRisk: "HIGH",
      requesterId: "user-requester",
    },
    comments: [
      {
        authorId: "user-reviewer",
        visibility: "INTERNAL",
        body: "Dostawca wysokiego ryzyka, ale ma aktualne certyfikaty ISO 27001 i SOC 2.",
      },
    ],
    attachments: [
      {
        uploadedById: "user-requester",
        attachmentType: "VENDOR_ASSESSMENT",
        fileName: "redteam-vendor-assessment.pdf",
        mimeType: "application/pdf",
        sizeBytes: 256000,
      },
    ],
    override: {
      createdById: "user-reviewer",
      approverId: "user-policy-owner",
      newDecision: "APPROVED",
      exception: true,
      reason: "Zaakceptowano wyjątek — ryzyko zaadresowane certyfikatami i ograniczonym zakresem testu.",
      comment: "Akceptuję jako wyjątek za zgodą właściciela polityki bezpieczeństwa.",
    },
  },
  {
    // SaaS above threshold -> REQUIRES_REVIEW, then rejected by the reviewer.
    id: "request-demo-adtool",
    daysAgo: 15,
    mode: "submit",
    input: {
      ...seedInputBase,
      title: "Narzędzie do zakupu reklam",
      description: "Platforma SaaS do automatyzacji kampanii reklamowych.",
      type: "NEW_SOFTWARE",
      category: "SAAS",
      annualCost: 22000,
      currency: "EUR",
      vendorName: "AdBlaster",
      vendorCountry: "US",
      department: "MARKETING",
      urgency: "NORMAL",
      justification: "Marketing chce zautomatyzować zakup mediów.",
      processesPersonalData: false,
      vendorRisk: "MEDIUM",
      requesterId: "user-business-owner",
      businessOwnerId: "user-business-owner",
    },
    comments: [
      {
        authorId: "user-reviewer",
        visibility: "PUBLIC",
        body: "Funkcjonalnie pokrywa się z istniejącym narzędziem — proszę o uzasadnienie biznesowe.",
      },
    ],
    override: {
      createdById: "user-reviewer",
      approverId: "user-policy-owner",
      newDecision: "REJECTED",
      exception: false,
      reason: "Duplikacja istniejącego narzędzia, brak uzasadnienia dodatkowego kosztu.",
      comment: "Odrzucone — funkcje są już dostępne w obecnej platformie marketingowej.",
    },
  },
  {
    // Work-in-progress draft (not submitted yet) so the requester sees an editable draft.
    id: "request-demo-crm-draft",
    daysAgo: 1,
    mode: "draft",
    input: {
      ...seedInputBase,
      title: "Nowy CRM dla działu sprzedaży",
      description: "Wstępna wersja robocza wniosku o system CRM.",
      type: "NEW_SOFTWARE",
      category: "SAAS",
      annualCost: 4000,
      currency: "EUR",
      vendorName: "RoboCRM",
      vendorCountry: "PL",
      department: "OPERATIONS",
      urgency: "LOW",
      justification: "Zbieram jeszcze wymagania od zespołu sprzedaży.",
      processesPersonalData: false,
      vendorRisk: "UNKNOWN",
      requesterId: "user-requester",
    },
  },
];
