import {
  Alert,
  Badge,
  Button,
  CodeBlock,
  Container,
  Drawer,
  Heading,
  InlineTip,
  Input,
  Label,
  Select,
  StatusBadge,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  Toaster,
  toast,
} from "@medusajs/ui";
import {
  ArrowPath,
  BadgeCheck,
  Beaker,
  BellAlert,
  Brackets,
  ChartBar,
  ChatBubbleLeftRight,
  DecisionProcess,
  Eye,
  FilePlus,
  History,
  PaperClip,
  PencilSquare,
  Plus,
  QueueList,
  TablePen,
  XMarkMini,
} from "@medusajs/icons";
import { NextPage } from "next";
import Head from "next/head";
import { FormEvent, useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";

type ScreenId = "dashboard" | "requester" | "reviewer" | "policies" | "approvals" | "audit";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
};

const postJson = async (url: string, body: unknown, method = "POST") => {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const issueDetails = Array.isArray(data.issues)
      ? data.issues
          .map((issue: any) => `${issue.path || "request"}: ${issue.message}`)
          .join("; ")
      : "";
    throw new Error(issueDetails ? `${data.error ?? "Request failed"}: ${issueDetails}` : data.error ?? "Request failed");
  }
  return data;
};

const decisionLabels: Record<string, string> = {
  APPROVED: "Approved",
  REQUIRES_REVIEW: "Requires review",
  REJECTED: "Rejected",
  MISSING_INFORMATION: "Missing information",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  AUTO_APPROVED: "Auto approved",
  NEEDS_INFORMATION: "Needs information",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  APPROVED_WITH_EXCEPTION: "Approved with exception",
  CANCELLED: "Cancelled",
};

const decisionColor = (decision?: string | null) => {
  if (decision === "APPROVED") return "green";
  if (decision === "REQUIRES_REVIEW") return "blue";
  if (decision === "REJECTED") return "red";
  if (decision === "MISSING_INFORMATION") return "orange";
  return "grey";
};

const statusColor = (status?: string | null) => {
  if (["AUTO_APPROVED", "APPROVED", "APPROVED_WITH_EXCEPTION"].includes(status ?? "")) return "green";
  if (["IN_REVIEW", "SUBMITTED"].includes(status ?? "")) return "blue";
  if (status === "REJECTED") return "red";
  if (status === "NEEDS_INFORMATION") return "orange";
  return "grey";
};

const policyStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

const policyStatusColor = (status?: string | null) => {
  if (status === "PUBLISHED") return "green";
  if (status === "IN_REVIEW") return "blue";
  if (status === "DRAFT") return "orange";
  if (status === "ARCHIVED") return "grey";
  return "grey";
};

// A fresh request form starts empty (no seeded demo data) so the requester picks every value.
const blankRequestForm = {
  title: "",
  description: "",
  type: "",
  category: "",
  annualCost: "",
  currency: "",
  vendorName: "",
  vendorCountry: "",
  department: "",
  urgency: "",
  businessOwnerId: "",
  budgetOwnerId: "",
  processesPersonalData: false,
  hasDpa: false,
  dataCategories: "",
  dataClassification: "NONE",
  transfersOutsideEea: false,
  requiresSecurityQuestionnaire: false,
  vendorRisk: "",
  justification: "",
  emergencyJustification: "",
  dpaDocument: "",
  requesterId: "",
};

const fieldOptions = [
  "category",
  "annualCost",
  "currency",
  "vendorCountry",
  "processesPersonalData",
  "hasDpa",
  "vendorRisk",
  "urgency",
  "department",
  "dpaDocument",
  "emergencyJustification",
];

const operatorOptions = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_or_equal",
  "less_than",
  "less_or_equal",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
  "in",
  "not_in",
];

const fieldLabels: Record<string, string> = {
  category: "Category",
  annualCost: "Annual cost",
  currency: "Currency",
  vendorCountry: "Vendor country",
  processesPersonalData: "Processes personal data",
  hasDpa: "Has DPA",
  vendorRisk: "Vendor risk",
  urgency: "Urgency",
  department: "Department",
  dpaDocument: "DPA document",
  emergencyJustification: "Emergency justification",
};

const operatorLabels: Record<string, string> = {
  equals: "is equal to",
  not_equals: "is not equal to",
  greater_than: "is greater than",
  greater_or_equal: "is greater than or equal to",
  less_than: "is less than",
  less_or_equal: "is less than or equal to",
  contains: "contains",
  not_contains: "does not contain",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  in: "is one of",
  not_in: "is not one of",
};

const effectTypeLabels: Record<string, string> = {
  REQUIRE_REVIEW: "Require review",
  REQUIRE_FIELD: "Require field",
  REJECT: "Reject",
  APPROVE: "Approve",
  ADD_REASON_CODE: "Add reason code",
  ADD_RISK_POINTS: "Add risk points",
};

const effectTypeColor = (type?: string | null) => {
  if (type === "REJECT") return "red";
  if (type === "APPROVE") return "green";
  if (type === "REQUIRE_REVIEW" || type === "REQUIRE_FIELD") return "blue";
  if (type === "ADD_RISK_POINTS") return "orange";
  return "grey";
};

const formatConditionValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(formatConditionValue).join(", ");
  return String(value);
};

const describeEffect = (effect: any): string => {
  switch (effect?.type) {
    case "REQUIRE_REVIEW":
      return effect.approver
        ? `Send the request for review to ${effect.approver}`
        : "Send the request for manual review";
    case "REQUIRE_FIELD":
      return effect.label
        ? `Require the requester to provide "${effect.label}"${effect.field ? ` (${effect.field})` : ""}`
        : `Require the field "${effect.field ?? "unknown"}"`;
    case "REJECT":
      return "Automatically reject the request";
    case "APPROVE":
      return "Automatically approve the request";
    case "ADD_REASON_CODE":
      return effect.code || effect.label
        ? `Attach the reason code "${effect.code ?? effect.label}"`
        : "Attach a reason code to the evaluation";
    case "ADD_RISK_POINTS":
      return "Increase the request's risk score";
    default:
      return effect?.type ?? "Unknown effect";
  }
};

const screenCatalog = [
  {
    id: "dashboard" as ScreenId,
    label: "Overview",
    description: "Metryki, ryzyka i mapa scenariuszy.",
    roles: ["REVIEWER", "POLICY_OWNER", "ADMIN"],
    icon: ChartBar,
  },
  {
    id: "requester" as ScreenId,
    label: "Request intake",
    description: "Utworzenie, złożenie i uzupełnienie wniosku.",
    roles: ["REQUESTER", "ADMIN"],
    icon: FilePlus,
  },
  {
    id: "reviewer" as ScreenId,
    label: "Review queue",
    description: "Decyzja człowieka, komentarze, załączniki i override.",
    roles: ["REVIEWER", "ADMIN"],
    icon: QueueList,
  },
  {
    id: "policies" as ScreenId,
    label: "Policy studio",
    description: "Polityki, wersje, reguły i testowanie.",
    roles: ["POLICY_OWNER", "ADMIN"],
    icon: DecisionProcess,
  },
  {
    id: "approvals" as ScreenId,
    label: "Policy approvals",
    description: "Przegląd, akceptacja albo odrzucenie wersji przekazanych do publikacji.",
    roles: ["POLICY_APPROVER", "ADMIN"],
    icon: BadgeCheck,
  },
  {
    id: "audit" as ScreenId,
    label: "Audit trail",
    description: "Historia ocen, snapshoty i użyte wersje polityk.",
    roles: ["AUDITOR", "REVIEWER", "POLICY_OWNER", "ADMIN"],
    icon: History,
  },
];

const scenarioCards = [
  {
    title: "Requester",
    icon: FilePlus,
    steps: ["Create draft", "Submit request", "Read decision", "Add missing DPA"],
  },
  {
    title: "Reviewer",
    icon: QueueList,
    steps: ["Open queue", "Read rule trace", "Comment", "Override with reason"],
  },
  {
    title: "Policy Owner",
    icon: TablePen,
    steps: ["Create policy version", "Add rule", "Test rule", "Submit for approval"],
  },
  {
    title: "Policy Approver",
    icon: BadgeCheck,
    steps: ["Open pending versions", "Review rules", "Approve & publish", "Reject with reason"],
  },
  {
    title: "Auditor",
    icon: Eye,
    steps: ["Find request", "Open evaluation", "Compare snapshots", "Verify policy version"],
  },
];

const parseRuleValue = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.includes(",")) return trimmed.split(",").map(item => parseRuleValue(item));
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed;
};

type RuleRow = { field: string; operator: string; value: string };
type RuleEffectRow = {
  type: string;
  approver: string;
  field: string;
  label: string;
  code: string;
  points: string;
  nextStep: string;
};

const emptyRuleRow: RuleRow = { field: "category", operator: "equals", value: "" };
const emptyRuleEffect: RuleEffectRow = {
  type: "REQUIRE_REVIEW",
  approver: "",
  field: "",
  label: "",
  code: "",
  points: "0",
  nextStep: "",
};

const emptyRuleForm = {
  name: "",
  description: "",
  severity: "WARNING",
  reason: "",
  priority: 100,
  enabled: true,
};

const isEditablePolicyVersion = (version?: any) => version?.status === "DRAFT";
const isOpenPolicyVersion = (version?: any) => ["DRAFT", "IN_REVIEW"].includes(version?.status ?? "");

const stringifyRuleValue = (value: unknown) => {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(item => stringifyRuleValue(item)).join(", ");
  return String(value);
};

const conditionToRows = (condition: any): RuleRow[] => {
  if (!condition) return [];
  if (Array.isArray(condition.conditions)) {
    const rows = condition.conditions.flatMap((item: any) => conditionToRows(item));
    return rows;
  }

  return [
    {
      field: condition.field ?? "annualCost",
      operator: condition.operator ?? "greater_than",
      value: stringifyRuleValue(condition.value),
    },
  ];
};

const conditionCombinator = (condition: any) =>
  condition?.combinator === "ANY" ? "ANY" : "ALL";

const effectToRow = (effect?: any): RuleEffectRow => ({
  type: effect?.type ?? emptyRuleEffect.type,
  approver: effect?.approver ?? "",
  field: effect?.field ?? "",
  label: effect?.label ?? "",
  code: effect?.code ?? "",
  points: stringifyRuleValue(effect?.points ?? 0),
  nextStep: effect?.nextStep ?? "",
});

const ruleToBuilderState = (rule?: any) => {
  if (!rule) {
    return {
      rows: [],
      combinator: "ALL",
      effects: [{ ...emptyRuleEffect }],
      form: emptyRuleForm,
    };
  }

  return {
    rows: conditionToRows(rule.condition),
    combinator: conditionCombinator(rule.condition),
    effects:
      rule.effects?.length > 0
        ? rule.effects.map((effect: any) => effectToRow(effect))
        : [{ ...emptyRuleEffect }],
    form: {
      name: rule.name ?? emptyRuleForm.name,
      description: rule.description ?? emptyRuleForm.description,
      severity: rule.severity ?? emptyRuleForm.severity,
      reason: rule.reason ?? emptyRuleForm.reason,
      priority: rule.priority ?? emptyRuleForm.priority,
      enabled: rule.enabled ?? emptyRuleForm.enabled,
    },
  };
};

const nextPublishedVersionNumber = (policy: any) =>
  Math.max(
    0,
    ...(policy?.versions ?? [])
      .map((version: any) => version.versionNumber)
      .filter((value: unknown): value is number => typeof value === "number"),
  ) + 1;

const policyVersionLabel = (version: any) =>
  typeof version?.versionNumber === "number"
    ? `v${version.versionNumber}`
    : version?.status === "IN_REVIEW"
      ? "Awaiting approval"
      : "Draft";

const toRequestPayload = (form: any, mode: "draft" | "submit") => ({
  ...form,
  mode,
  annualCost: Number(form.annualCost),
  // vendorRisk is optional; leave it unset so the schema default (UNKNOWN) applies when not chosen.
  vendorRisk: form.vendorRisk || undefined,
  processesPersonalData: Boolean(form.processesPersonalData),
  hasDpa: Boolean(form.hasDpa),
  transfersOutsideEea: Boolean(form.transfersOutsideEea),
  requiresSecurityQuestionnaire: Boolean(form.requiresSecurityQuestionnaire),
  dataCategories:
    typeof form.dataCategories === "string"
      ? form.dataCategories
          .split(",")
          .map((item: string) => item.trim())
          .filter(Boolean)
      : form.dataCategories,
});

// Hydrates the intake form from an existing request so a requester can edit a DRAFT or
// resubmit a NEEDS_INFORMATION request (UC-4, role 5.1).
const requestToForm = (request: any) => {
  const inputData = (request?.inputData && typeof request.inputData === "object" ? request.inputData : {}) as Record<string, unknown>;
  return {
    title: request?.title ?? "",
    description: request?.description ?? "",
    type: request?.type ?? "NEW_SOFTWARE",
    category: request?.category ?? "SAAS",
    annualCost: request?.annualCost ?? 0,
    currency: request?.currency ?? "EUR",
    vendorName: request?.vendorName ?? "",
    vendorCountry: request?.vendorCountry ?? "",
    department: request?.department ?? "MARKETING",
    urgency: request?.urgency ?? "NORMAL",
    businessOwnerId: request?.businessOwnerId ?? "",
    budgetOwnerId: request?.budgetOwnerId ?? "",
    processesPersonalData: Boolean(request?.processesPersonalData),
    hasDpa: Boolean(request?.hasDpa),
    dataCategories: Array.isArray(request?.dataCategories)
      ? request.dataCategories.join(", ")
      : request?.dataCategories ?? "",
    dataClassification: request?.dataClassification ?? "NONE",
    transfersOutsideEea: Boolean(request?.transfersOutsideEea),
    requiresSecurityQuestionnaire: Boolean(request?.requiresSecurityQuestionnaire),
    vendorRisk: request?.vendorRisk ?? "UNKNOWN",
    justification: request?.justification ?? "",
    emergencyJustification: (inputData.emergencyJustification as string) ?? "",
    dpaDocument: (inputData.dpaDocument as string) ?? "",
    requesterId: request?.requesterId ?? "",
  };
};

const editableRequestStatuses = ["DRAFT", "NEEDS_INFORMATION"];
const isEditableRequest = (request?: any) => editableRequestStatuses.includes(request?.status ?? "");

// Reviewer decision intents map UC-3 / UC-9 onto the state machine. "Exception" is the audited
// manual override (APPROVED_WITH_EXCEPTION) that needs a dedicated exception approver.
type ReviewIntentId = "APPROVE" | "EXCEPTION" | "REJECT" | "INFO";
const reviewIntents: Record<ReviewIntentId, {
  label: string;
  newDecision: string;
  exception: boolean;
  needsApprover: boolean;
  tone: "primary" | "danger" | "secondary";
  reason: string;
  comment: string;
  helper: string;
}> = {
  APPROVE: {
    label: "Approve",
    newDecision: "APPROVED",
    exception: false,
    needsApprover: false,
    tone: "primary",
    reason: "Reviewer accepts the request — policy requirements are satisfied.",
    comment: "Checked the rule trace and supporting data, no outstanding concerns.",
    helper: "Marks the request APPROVED and closes the review.",
  },
  EXCEPTION: {
    label: "Approve as exception",
    newDecision: "APPROVED",
    exception: true,
    needsApprover: true,
    tone: "secondary",
    reason: "Business exception approved despite an outstanding policy concern.",
    comment: "Reviewer accepts the residual risk with a compensating control.",
    helper: "Records an audited manual override (APPROVED_WITH_EXCEPTION). Keeps the original system decision intact.",
  },
  REJECT: {
    label: "Reject",
    newDecision: "REJECTED",
    exception: false,
    needsApprover: false,
    tone: "danger",
    reason: "The request does not meet policy requirements and cannot be approved.",
    comment: "Rejecting based on the identified policy violations.",
    helper: "Marks the request REJECTED.",
  },
  INFO: {
    label: "Request more info",
    newDecision: "MISSING_INFORMATION",
    exception: false,
    needsApprover: false,
    tone: "secondary",
    reason: "Additional information is required before a decision can be made.",
    comment: "Sending the request back to the requester for the missing details.",
    helper: "Sends the request back to NEEDS_INFORMATION for the requester.",
  },
};

const formatDate = (value?: string | null) => {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const wrappingBadgeClassName =
  "h-auto max-w-full whitespace-normal break-words py-1 text-left leading-tight";

const TableScroll = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-full overflow-x-auto">{children}</div>
);

const SelectField = ({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Choose option",
  disabled,
}: {
  label: string;
  value?: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) => (
  <div className="flex flex-col gap-y-1.5">
    <Label size="small" weight="plus">
      {label}
    </Label>
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger>
        <Select.Value placeholder={placeholder} />
      </Select.Trigger>
      <Select.Content>
        {options.map(option => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  </div>
);

const TextField = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) => (
  <div className="flex flex-col gap-y-1.5">
    <Label size="small" weight="plus">
      {label}
    </Label>
    <Input value={value} type={type} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
  </div>
);

const TextareaField = ({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) => (
  <div className="flex flex-col gap-y-1.5">
    <Label size="small" weight="plus">
      {label}
    </Label>
    <Textarea value={value} rows={rows} onChange={event => onChange(event.target.value)} />
  </div>
);

const SwitchField = ({
  label,
  checked,
  onCheckedChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  hint?: string;
}) => (
  <div className="flex items-center justify-between gap-x-4 rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2">
    <div className="min-w-0">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {hint && (
        <Text size="xsmall" className="mt-0.5 text-ui-fg-muted">
          {hint}
        </Text>
      )}
    </div>
    <Switch checked={checked} onCheckedChange={value => onCheckedChange(Boolean(value))} />
  </div>
);

const FormSection = ({
  title,
  description,
  icon: Icon,
  highlight = false,
  badge,
  children,
}: {
  title: string;
  description?: string;
  icon?: any;
  highlight?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div
    className={`rounded-xl border p-4 sm:p-5 ${
      highlight
        ? "border-ui-tag-blue-border bg-ui-tag-blue-bg/40"
        : "border-ui-border-base bg-ui-bg-subtle"
    }`}
  >
    <div className="flex items-start justify-between gap-x-3">
      <div className="flex items-start gap-x-3">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ui-bg-base">
            <Icon className="h-4 w-4 text-ui-fg-subtle" />
          </div>
        )}
        <div className="min-w-0">
          <Text weight="plus">{title}</Text>
          {description && (
            <Text size="small" className="text-ui-fg-subtle">
              {description}
            </Text>
          )}
        </div>
      </div>
      {badge}
    </div>
    <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
  </div>
);

const DecisionBadge = ({ value }: { value?: string | null }) => (
  <StatusBadge className="shrink-0 whitespace-nowrap" color={decisionColor(value) as any}>
    {value ? decisionLabels[value] ?? value : "No decision"}
  </StatusBadge>
);

const StatusPill = ({ value }: { value?: string | null }) => (
  <StatusBadge className="shrink-0 whitespace-nowrap" color={statusColor(value) as any}>
    {value ? statusLabels[value] ?? value : "No status"}
  </StatusBadge>
);

const PolicyStatusPill = ({ value }: { value?: string | null }) => (
  <StatusBadge className="shrink-0 whitespace-nowrap" color={policyStatusColor(value) as any}>
    {value ? policyStatusLabels[value] ?? value : "No status"}
  </StatusBadge>
);

const ConditionRow = ({ condition }: { condition: any }) => (
  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
    <Badge size="2xsmall" className={wrappingBadgeClassName}>
      {fieldLabels[condition?.field] ?? condition?.field}
    </Badge>
    <Text size="small" className="text-ui-fg-subtle">
      {operatorLabels[condition?.operator] ?? condition?.operator}
    </Text>
    {condition?.value !== undefined && condition?.value !== "" && (
      <Badge size="2xsmall" color="blue" className={wrappingBadgeClassName}>
        {formatConditionValue(condition.value)}
      </Badge>
    )}
  </div>
);

const ConditionSummary = ({ condition }: { condition: any }) => {
  if (!condition) {
    return <Text size="small" className="text-ui-fg-subtle">No conditions defined — the rule always matches.</Text>;
  }
  if (Array.isArray(condition.conditions)) {
    const combinatorLabel = condition.combinator === "ANY" ? "any" : "all";
    return (
      <div className="space-y-1.5">
        <Text size="small" className="text-ui-fg-subtle">
          Matches when {combinatorLabel} of the following are true:
        </Text>
        <div className="space-y-1.5 border-l-2 border-ui-border-base pl-3">
          {condition.conditions.map((item: any, index: number) => (
            <ConditionRow key={index} condition={item} />
          ))}
        </div>
      </div>
    );
  }
  return <ConditionRow condition={condition} />;
};

const EffectSummary = ({ effects }: { effects: any[] }) => {
  if (!effects || effects.length === 0) {
    return <Text size="small" className="text-ui-fg-subtle">No effects defined.</Text>;
  }
  return (
    <div className="space-y-1.5">
      {effects.map((effect: any, index: number) => (
        <div key={index} className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <Badge
              size="2xsmall"
              color={effectTypeColor(effect?.type) as any}
              className={wrappingBadgeClassName}
            >
              {effectTypeLabels[effect?.type] ?? effect?.type}
            </Badge>
            <Text size="small" className="text-ui-fg-subtle">
              {describeEffect(effect)}
            </Text>
          </div>
          {effect?.nextStep && (
            <Text size="xsmall" className="pl-1 text-ui-fg-muted">
              Next step: {effect.nextStep}
            </Text>
          )}
        </div>
      ))}
    </div>
  );
};

const RuleDetailCard = ({ rule }: { rule: any }) => {
  const [showJson, setShowJson] = useState(false);

  return (
    <Container className="space-y-3 bg-ui-bg-subtle p-4">
      <div className="flex items-start justify-between gap-x-3">
        <Text weight="plus" size="small" className="min-w-0 break-words">{rule.name}</Text>
        <Badge size="2xsmall" className="shrink-0">{rule.severity}</Badge>
      </div>
      <Text size="small" className="text-ui-fg-subtle">{rule.description}</Text>
      <Text size="small">{rule.reason}</Text>
      <div className="space-y-3 rounded-lg border border-ui-border-base bg-ui-bg-base p-3">
        <div className="space-y-1.5">
          <Text size="xsmall" weight="plus" className="uppercase text-ui-fg-muted">
            Conditions
          </Text>
          <ConditionSummary condition={rule.condition} />
        </div>
        <div className="space-y-1.5 border-t border-ui-border-base pt-3">
          <Text size="xsmall" weight="plus" className="uppercase text-ui-fg-muted">
            Effects
          </Text>
          <EffectSummary effects={rule.effects} />
        </div>
      </div>
      <div>
        <Button type="button" variant="transparent" size="small" onClick={() => setShowJson(current => !current)}>
          <Brackets className="h-4 w-4" />
          {showJson ? "Hide raw JSON" : "Show raw JSON"}
        </Button>
      </div>
      {showJson && (
        <CodeBlock
          className="rounded-lg"
          snippets={[
            { label: "condition", language: "json", code: JSON.stringify(rule.condition, null, 2), hideLineNumbers: true },
            { label: "effects", language: "json", code: JSON.stringify(rule.effects, null, 2), hideLineNumbers: true },
          ]}
        >
          <CodeBlock.Header />
          <CodeBlock.Body />
        </CodeBlock>
      )}
    </Container>
  );
};

const inputSnapshotFieldLabels: Record<string, string> = {
  title: "Title",
  vendorName: "Vendor name",
  type: "Type",
  category: "Category",
  annualCost: "Annual cost",
  currency: "Currency",
  department: "Department",
  urgency: "Urgency",
  vendorCountry: "Vendor country",
  vendorRisk: "Vendor risk",
  processesPersonalData: "Processes personal data",
  dataClassification: "Data classification",
  hasDpa: "Has DPA",
  transfersOutsideEea: "Transfers outside EEA",
  requiresSecurityQuestionnaire: "Security questionnaire required",
};

const inputSnapshotFieldOrder = Object.keys(inputSnapshotFieldLabels);

const FactRow = ({ fact }: { fact: any }) => (
  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
    <Badge size="2xsmall" className={wrappingBadgeClassName}>
      {fieldLabels[fact.field] ?? fact.field}
    </Badge>
    <Text size="small" className="text-ui-fg-subtle">
      {operatorLabels[fact.operator] ?? fact.operator}
    </Text>
    <Badge size="2xsmall" color="blue" className={wrappingBadgeClassName}>
      {formatConditionValue(fact.expected)}
    </Badge>
    <Text size="xsmall" className="text-ui-fg-muted">→ actual:</Text>
    <Badge
      size="2xsmall"
      color={fact.matched ? "green" : "red"}
      className={wrappingBadgeClassName}
    >
      {formatConditionValue(fact.actual)}
    </Badge>
  </div>
);

const RuleResultCard = ({ rule }: { rule: any }) => {
  const [showJson, setShowJson] = useState(false);
  return (
    <Container className={`space-y-3 p-4 ${rule.matched ? "bg-ui-bg-subtle" : "bg-ui-bg-base"}`}>
      <div className="flex items-start justify-between gap-x-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge color={rule.matched ? "green" : "grey"}>
            {rule.matched ? "Matched" : "No match"}
          </StatusBadge>
          <Text weight="plus" size="small" className="min-w-0 break-words">
            {rule.ruleName}
          </Text>
        </div>
        <Badge size="2xsmall" className="shrink-0">{rule.severity}</Badge>
      </div>
      <Text size="xsmall" className="text-ui-fg-muted">
        {rule.policyName} v{rule.policyVersionNumber}
      </Text>
      {rule.matched && rule.reason && (
        <Text size="small">{rule.reason}</Text>
      )}
      {(rule.facts ?? []).length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-ui-border-base bg-ui-bg-base p-3">
          <Text size="xsmall" weight="plus" className="uppercase text-ui-fg-muted">
            Facts
          </Text>
          <div className="space-y-1.5 border-t border-ui-border-base pt-2">
            {rule.facts.map((fact: any, i: number) => (
              <FactRow key={i} fact={fact} />
            ))}
          </div>
        </div>
      )}
      {rule.matched && (rule.effects ?? []).length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-ui-border-base bg-ui-bg-base p-3">
          <Text size="xsmall" weight="plus" className="uppercase text-ui-fg-muted">
            Effects
          </Text>
          <div className="border-t border-ui-border-base pt-2">
            <EffectSummary effects={rule.effects} />
          </div>
        </div>
      )}
      <div>
        <Button type="button" variant="transparent" size="small" onClick={() => setShowJson(c => !c)}>
          <Brackets className="h-4 w-4" />
          {showJson ? "Hide raw JSON" : "Show raw JSON"}
        </Button>
      </div>
      {showJson && (
        <CodeBlock
          className="rounded-lg"
          snippets={[
            { label: "facts", language: "json", code: JSON.stringify(rule.facts, null, 2), hideLineNumbers: true },
            { label: "effects", language: "json", code: JSON.stringify(rule.effects, null, 2), hideLineNumbers: true },
          ]}
        >
          <CodeBlock.Header />
          <CodeBlock.Body />
        </CodeBlock>
      )}
    </Container>
  );
};

const EvaluationDetail = ({ evaluation }: { evaluation: any }) => {
  const [showRaw, setShowRaw] = useState(false);
  const input: Record<string, unknown> = evaluation.inputSnapshot ?? {};
  const result = evaluation.resultSnapshot ?? {};
  const allRules: any[] = result.ruleResults ?? [];
  const matched = allRules.filter(r => r.matched);
  const unmatched = allRules.filter(r => !r.matched);

  return (
    <div className="space-y-6">
      <div>
        <Text weight="plus" className="mb-3">Request snapshot</Text>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {inputSnapshotFieldOrder.map(field => {
            const val = input[field];
            if (val === undefined || val === null || val === "") return null;
            return (
              <div key={field} className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2">
                <Text size="xsmall" className="text-ui-fg-muted">
                  {inputSnapshotFieldLabels[field]}
                </Text>
                <Text size="small" weight="plus" className="mt-0.5 break-words">
                  {formatConditionValue(val)}
                </Text>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Text weight="plus" className="mb-3">
          Rule results{" "}
          <Badge size="2xsmall" color="green">{matched.length} matched</Badge>
          {unmatched.length > 0 && (
            <Badge size="2xsmall" color="grey" className="ml-1">{unmatched.length} not matched</Badge>
          )}
        </Text>
        <div className="space-y-3">
          {matched.map((rule: any, i: number) => <RuleResultCard key={i} rule={rule} />)}
          {unmatched.map((rule: any, i: number) => <RuleResultCard key={`u-${i}`} rule={rule} />)}
          {allRules.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">No rules evaluated.</Text>
          )}
        </div>
      </div>

      <div>
        <Button type="button" variant="transparent" size="small" onClick={() => setShowRaw(c => !c)}>
          <Brackets className="h-4 w-4" />
          {showRaw ? "Hide raw JSON" : "Show raw JSON"}
        </Button>
      </div>
      {showRaw && (
        <CodeBlock
          className="rounded-lg"
          snippets={[
            { label: "inputSnapshot", language: "json", code: JSON.stringify(input, null, 2), hideLineNumbers: true },
            { label: "resultSnapshot", language: "json", code: JSON.stringify(result, null, 2), hideLineNumbers: true },
          ]}
        >
          <CodeBlock.Header />
          <CodeBlock.Body />
        </CodeBlock>
      )}
    </div>
  );
};

const PolicyDetailDrawer = ({
  policy,
  open,
  onOpenChange,
}: {
  policy: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const version = policy?.versions?.find((item: any) => item.id === policy.currentVersionId) ?? policy?.versions?.[0];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="z-50" overlayProps={{ className: "z-50" }}>
        <Drawer.Header>
          <Drawer.Title>{policy?.name ?? "Policy details"}</Drawer.Title>
          <Drawer.Description>{policy?.description ?? "Szczegóły polityki i reguł aktywnej wersji."}</Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="space-y-5 overflow-y-auto">
          {policy && (
            <>
              <div className="flex items-center gap-x-2">
                <PolicyStatusPill value={policy.status} />
                <Badge size="2xsmall">{policy.domain}</Badge>
              </div>
              {version ? (
                <>
                  <div>
                    <Text weight="plus">{policyVersionLabel(version)}</Text>
                    <Text size="small" className="text-ui-fg-subtle">{version.changeSummary}</Text>
                  </div>
                  <div className="space-y-3">
                    <Text weight="plus">Rules</Text>
                    {(version.rules ?? []).map((rule: any) => (
                      <RuleDetailCard key={rule.id} rule={rule} />
                    ))}
                    {(version.rules ?? []).length === 0 && <Text size="small">No rules in this version.</Text>}
                  </div>
                </>
              ) : (
                <Text size="small">This policy has no versions yet.</Text>
              )}
            </>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};

const EmptyState = ({ title, body }: { title: string; body: string }) => (
  <Container className="flex min-h-[180px] flex-col items-center justify-center gap-y-2 border border-dashed border-ui-border-base bg-ui-bg-subtle text-center">
    <Text weight="plus">{title}</Text>
    <Text size="small" className="max-w-[48ch] text-ui-fg-subtle">
      {body}
    </Text>
  </Container>
);

const SectionHeader = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex flex-col justify-between gap-3 border-b border-ui-border-base px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-center">
    <div className="min-w-0">
      <Heading level="h2">{title}</Heading>
      {description && (
        <Text size="small" className="mt-1 text-ui-fg-subtle">
          {description}
        </Text>
      )}
    </div>
    {action && <div className="flex flex-wrap gap-2">{action}</div>}
  </div>
);

const RequestSummary = ({ request, compact = false }: { request: any; compact?: boolean }) => {
  const latest = request?.latestEvaluation ?? request?.evaluations?.[0];
  const result = latest?.resultSnapshot;

  if (!request) {
    return <EmptyState title="No request selected" body="Choose a request from the list to inspect decision details." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading level="h2">{request.title}</Heading>
          <Text size="small" className="mt-1 text-ui-fg-subtle">
            {request.vendorName} - {request.annualCost} {request.currency}
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <DecisionBadge value={request.effectiveDecision ?? request.decision} />
          <StatusPill value={request.status} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Category", request.category],
          ["Department", request.department],
          ["Vendor country", request.vendorCountry],
          ["Evaluated", latest ? formatDate(latest.evaluatedAt) : "Not evaluated"],
        ].map(([label, value]) => (
          <Container key={label} className="bg-ui-bg-subtle p-4">
            <Text size="xsmall" className="text-ui-fg-muted">
              {label}
            </Text>
            <Text weight="plus" className="mt-1 break-words">
              {value}
            </Text>
          </Container>
        ))}
      </div>

      <Container className="p-0">
        <div className="grid divide-y divide-ui-border-base md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="p-4">
            <Text weight="plus">Reasons</Text>
            <div className="mt-3 space-y-2">
              {(result?.reasons ?? []).map((reason: string) => (
                <div key={reason} className="flex gap-x-2">
                  <BellAlert className="mt-0.5 h-4 w-4 shrink-0 text-ui-fg-interactive" />
                  <Text size="small">{reason}</Text>
                </div>
              ))}
              {(result?.reasons ?? []).length === 0 && <Text size="small">No reasons recorded.</Text>}
            </div>
          </div>
          <div className="p-4">
            <Text weight="plus">Next steps</Text>
            <div className="mt-3 space-y-2">
              {(result?.nextSteps ?? []).map((step: string) => (
                <div key={step} className="flex gap-x-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-ui-fg-interactive" />
                  <Text size="small">{step}</Text>
                </div>
              ))}
              {(result?.nextSteps ?? []).length === 0 && <Text size="small">No next steps.</Text>}
            </div>
          </div>
        </div>
      </Container>

      {!compact && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Container className="p-4">
              <Text weight="plus">Missing information</Text>
              <div className="mt-3 flex flex-wrap gap-2">
                {(result?.missingFields ?? []).map((field: any) => (
                  <Badge key={field.field} color="orange" className={wrappingBadgeClassName}>
                    {field.label}
                  </Badge>
                ))}
                {(result?.missingFields ?? []).length === 0 && <Badge color="green">Complete</Badge>}
              </div>
            </Container>
            <Container className="p-4">
              <Text weight="plus">Required approvers</Text>
              <div className="mt-3 flex flex-wrap gap-2">
                {(result?.requiredApprovers ?? []).map((approver: string) => (
                  <Badge key={approver} color="blue" className={wrappingBadgeClassName}>
                    {approver}
                  </Badge>
                ))}
                {(result?.requiredApprovers ?? []).length === 0 && <Badge color="grey">None</Badge>}
              </div>
            </Container>
            <Container className="p-4">
              <Text weight="plus">Matched policies</Text>
              <div className="mt-3 flex flex-wrap gap-2">
                {(result?.matchedPolicyVersions ?? []).map((policy: any) => (
                  <Badge key={policy.policyVersionId} color="purple" className={wrappingBadgeClassName}>
                    {policy.policyName} v{policy.versionNumber}
                  </Badge>
                ))}
              </div>
            </Container>
          </div>

          <Container className="overflow-hidden p-0">
            <div className="border-b border-ui-border-base px-4 py-3">
              <Text weight="plus">Rule trace</Text>
            </div>
            <TableScroll>
              <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Match</Table.HeaderCell>
                  <Table.HeaderCell>Rule</Table.HeaderCell>
                  <Table.HeaderCell>Policy</Table.HeaderCell>
                  <Table.HeaderCell>Reason</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(result?.ruleResults ?? []).map((rule: any) => (
                  <Table.Row key={`${rule.ruleName}-${rule.policyVersionId}`}>
                    <Table.Cell>
                      <StatusBadge color={rule.matched ? "green" : "grey"}>{rule.matched ? "Matched" : "No match"}</StatusBadge>
                    </Table.Cell>
                    <Table.Cell>{rule.ruleName}</Table.Cell>
                    <Table.Cell>
                      {rule.policyName} v{rule.policyVersionNumber}
                    </Table.Cell>
                    <Table.Cell>{rule.reason}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
              </Table>
            </TableScroll>
          </Container>
        </>
      )}
    </div>
  );
};

const Home: NextPage = () => {
  const [actorId, setActorId] = useState("user-requester");
  const [activeScreen, setActiveScreen] = useState<ScreenId>("dashboard");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [requestForm, setRequestForm] = useState<any>(blankRequestForm);
  // "new" = blank editable form, "edit" = editing a DRAFT/NEEDS_INFORMATION request,
  // "view" = read-only snapshot of an existing request opened from "My requests".
  const [formMode, setFormMode] = useState<"new" | "edit" | "view">("new");
  const [formRequestId, setFormRequestId] = useState("");
  const [requesterStatusFilter, setRequesterStatusFilter] = useState("__ALL__");
  const [requesterSort, setRequesterSort] = useState<"newest" | "oldest">("newest");
  const [filters, setFilters] = useState({ search: "__ALL__", status: "__ALL__", decision: "__ALL__", category: "__ALL__" });
  const [commentBody, setCommentBody] = useState("");
  const [commentVisibility, setCommentVisibility] = useState("PUBLIC");
  const [attachmentType, setAttachmentType] = useState("DPA");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [decisionForm, setDecisionForm] = useState<{
    intent: ReviewIntentId;
    reason: string;
    comment: string;
    approverId: string;
  }>({
    intent: "APPROVE",
    reason: reviewIntents.APPROVE.reason,
    comment: reviewIntents.APPROVE.comment,
    approverId: "user-policy-owner",
  });
  const [policyForm, setPolicyForm] = useState({
    name: "Polityka testowa",
    description: "Nowa polityka robocza do demonstracji kreatora reguł.",
    domain: "PROCUREMENT",
    changeSummary: "Pierwsza wersja polityki testowej.",
  });
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [selectedApprovalVersionId, setSelectedApprovalVersionId] = useState("");
  const [rejectForm, setRejectForm] = useState({
    reason: "Próg kosztowy wymaga dodatkowego uzasadnienia biznesowego przed publikacją.",
  });
  const [ruleRows, setRuleRows] = useState<RuleRow[]>([]);
  const [ruleCombinator, setRuleCombinator] = useState("ALL");
  const [ruleEffects, setRuleEffects] = useState<RuleEffectRow[]>([{ ...emptyRuleEffect }]);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [testInput, setTestInput] = useState({
    annualCost: "8000",
    category: "SAAS",
    currency: "EUR",
    vendorCountry: "US",
    processesPersonalData: true,
    hasDpa: false,
    vendorRisk: "UNKNOWN",
    urgency: "NORMAL",
  });
  const [testResult, setTestResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const listQuery = useMemo(() => {
    const params = new URLSearchParams({ page: "1", pageSize: "20" });
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "__ALL__") params.set(key, value);
    });
    if (activeScreen === "requester") {
      params.set("requesterId", actorId);
      if (requesterStatusFilter !== "__ALL__") params.set("status", requesterStatusFilter);
    }
    if (activeScreen === "reviewer") {
      params.set("status", "IN_REVIEW");
      params.set("decision", "REQUIRES_REVIEW");
    }
    return `/api/requests?${params.toString()}`;
  }, [activeScreen, actorId, filters, requesterStatusFilter]);

  const { data: bootstrap } = useSWR("/api/bootstrap", fetcher);
  const { data: dashboard } = useSWR("/api/dashboard", fetcher);
  const { data: requestList } = useSWR(listQuery, fetcher);
  const { data: policiesData } = useSWR("/api/policies", fetcher);
  const { data: selectedRequestData } = useSWR(selectedRequestId ? `/api/requests/${selectedRequestId}` : null, fetcher);

  const users = bootstrap?.users ?? [];
  const dictionaries = bootstrap?.dictionaries ?? {};
  const requests = requestList?.requests ?? [];
  const sortedRequesterRequests = useMemo(() => {
    const copy = [...requests];
    copy.sort((left: any, right: any) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return requesterSort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
    return copy;
  }, [requests, requesterSort]);
  const policies = policiesData?.policies ?? [];
  const selectedRequest = selectedRequestData?.request;
  const selectedActor = users.find((user: any) => user.id === actorId);
  const actorRoles = selectedActor?.roleAssignments?.map((item: any) => item.role.code) ?? ["REQUESTER"];
  const availableScreens = screenCatalog.filter(screen => screen.roles.some(role => actorRoles.includes(role)));
  const selectedEvaluation = selectedRequest?.latestEvaluation ?? selectedRequest?.evaluations?.[0];
  const selectedResult = selectedEvaluation?.resultSnapshot;
  const versions = useMemo(
    () =>
      policies.flatMap((policy: any) =>
        (policy.versions ?? []).map((version: any) => ({ ...version, policy })),
      ),
    [policies],
  );
  const editablePolicyVersions = useMemo(() => versions.filter(isEditablePolicyVersion), [versions]);
  const openPolicyVersions = useMemo(() => versions.filter(isOpenPolicyVersion), [versions]);
  const publishedPolicies = useMemo(
    () => policies.filter((policy: any) => Boolean(policy.currentVersionId)),
    [policies],
  );
  const approvedPolicyVersions = useMemo(
    () =>
      versions
        .filter(
          (version: any) =>
            ["PUBLISHED", "ARCHIVED"].includes(version.status) &&
            typeof version.versionNumber === "number",
        )
        .sort(
          (left: any, right: any) =>
            new Date(right.approvedAt ?? right.effectiveFrom ?? right.createdAt).getTime() -
            new Date(left.approvedAt ?? left.effectiveFrom ?? left.createdAt).getTime(),
        ),
    [versions],
  );
  const pendingApprovalVersions = versions.filter((version: any) => version.status === "IN_REVIEW");
  const selectedApprovalVersion = pendingApprovalVersions.find((version: any) => version.id === selectedApprovalVersionId);
  const currentApprovalBaseVersion = selectedApprovalVersion?.policy?.versions?.find(
    (version: any) => version.id === selectedApprovalVersion.policy.currentVersionId,
  );
  const selectedPolicyDetail = policies.find((policy: any) => policy.id === selectedPolicyId);
  const selectedVersion = versions.find((version: any) => version.id === selectedVersionId);
  const selectedRule = selectedVersion?.rules?.find((rule: any) => rule.id === selectedRuleId);
  const applyRuleBuilderState = (versionId: string, ruleId?: string) => {
    const version = versions.find((item: any) => item.id === versionId);
    const rule =
      version?.rules?.find((item: any) => item.id === ruleId) ??
      version?.rules?.[0];
    const builderState = ruleToBuilderState(rule);
    setSelectedRuleId(rule?.id ?? "");
    setRuleRows(builderState.rows);
    setRuleCombinator(builderState.combinator);
    setRuleEffects(builderState.effects);
    setRuleForm(builderState.form);
  };

  const startNewRule = () => {
    const builderState = ruleToBuilderState();
    setSelectedRuleId("");
    setRuleRows(builderState.rows);
    setRuleCombinator(builderState.combinator);
    setRuleEffects(builderState.effects);
    setRuleForm(builderState.form);
  };

  useEffect(() => {
    if (!requests.some((request: any) => request.id === selectedRequestId)) {
      setSelectedRequestId(requests[0]?.id ?? "");
    }
  }, [requests, selectedRequestId]);

  useEffect(() => {
    if (!availableScreens.some(screen => screen.id === activeScreen)) {
      setActiveScreen(availableScreens[0]?.id ?? "dashboard");
    }
  }, [activeScreen, availableScreens]);

  useEffect(() => {
    if (selectedVersionId && isEditablePolicyVersion(selectedVersion)) return;
    setSelectedVersionId(editablePolicyVersions[0]?.id ?? "");
  }, [editablePolicyVersions, selectedVersion, selectedVersionId]);

  useEffect(() => {
    const rule =
      selectedVersion?.rules?.find((item: any) => item.id === selectedRuleId) ??
      selectedVersion?.rules?.[0];
    const builderState = ruleToBuilderState(rule);
    setSelectedRuleId(rule?.id ?? "");
    setRuleRows(builderState.rows);
    setRuleCombinator(builderState.combinator);
    setRuleEffects(builderState.effects);
    setRuleForm(builderState.form);
  }, [selectedVersionId]);

  useEffect(() => {
    if (!pendingApprovalVersions.some((version: any) => version.id === selectedApprovalVersionId)) {
      setSelectedApprovalVersionId(pendingApprovalVersions[0]?.id ?? "");
    }
  }, [pendingApprovalVersions, selectedApprovalVersionId]);

  const options = (items: string[] = [], includeAll = false) => [
    ...(includeAll ? [{ value: "__ALL__", label: "All" }] : []),
    ...items.map(item => ({ value: item, label: item })),
  ];

  const userOptions = (includeNone = false) => [
    ...(includeNone ? [{ value: "__NONE__", label: "Not assigned" }] : []),
    ...users.map((user: any) => ({ value: user.id, label: user.name })),
  ];

  const userHasRole = (user: any, roleCode: string) =>
    (user.roleAssignments ?? []).some((assignment: any) => assignment.role?.code === roleCode);

  // Restricts the business / budget owner pickers to users who actually hold that role.
  const roleUserOptions = (roleCode: string, includeNone = false, currentValue = "") => {
    const matching = users.filter((user: any) => userHasRole(user, roleCode));
    // Keep an already-selected user visible even if their role assignment changed.
    const current = currentValue && !matching.some((user: any) => user.id === currentValue)
      ? users.filter((user: any) => user.id === currentValue)
      : [];
    return [
      ...(includeNone ? [{ value: "__NONE__", label: "Not assigned" }] : []),
      ...[...current, ...matching].map((user: any) => ({ value: user.id, label: user.name })),
    ];
  };

  const approverOptions = (currentValue = "", includeNone = false) => {
    const configuredApprovers = dictionaries.approvers ?? [];
    const values = currentValue && !configuredApprovers.includes(currentValue)
      ? [currentValue, ...configuredApprovers]
      : configuredApprovers;

    return [
      ...(includeNone ? [{ value: "__NONE__", label: "No additional reviewer" }] : []),
      ...values.map((value: string) => ({ value, label: value })),
    ];
  };

  const refreshWorkspace = async () => {
    await Promise.all([
      mutate("/api/bootstrap"),
      mutate("/api/dashboard"),
      mutate("/api/policies"),
      mutate(listQuery),
      selectedRequestId ? mutate(`/api/requests/${selectedRequestId}`) : Promise.resolve(),
    ]);
  };

  const runAction = async (action: () => Promise<void>, message: string) => {
    setErrorMessage("");
    try {
      await action();
      toast.success(message);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setErrorMessage(message);
      toast.error(message);
    }
  };

  const resetDemo = () =>
    runAction(async () => {
      const data = await postJson("/api/demo/seed", {});
      setSelectedRequestId(data.request.id);
    }, "Demo data reset");

  const startNewRequest = () => {
    setRequestForm(blankRequestForm);
    setFormMode("new");
    setFormRequestId("");
  };

  // Opens an existing request as a read-only snapshot in the main form (greyed, not editable).
  const viewRequestInForm = (request: any) => {
    if (!request) return;
    setRequestForm(requestToForm(request));
    setFormMode("view");
    setFormRequestId(request.id);
    setSelectedRequestId(request.id);
  };

  // Loads a DRAFT / NEEDS_INFORMATION request into the form for editing and resubmission (UC-4).
  const editRequestInForm = (request: any) => {
    if (!request) return;
    setRequestForm(requestToForm(request));
    setFormMode("edit");
    setFormRequestId(request.id);
    setSelectedRequestId(request.id);
    setActiveScreen("requester");
  };

  const submitRequest = (mode: "draft" | "submit") =>
    runAction(async () => {
      const isEdit = formMode === "edit" && formRequestId;
      const payload = toRequestPayload({ ...requestForm, requesterId: actorId }, mode);
      const data = isEdit
        ? await postJson(`/api/requests/${formRequestId}`, payload, "PATCH")
        : await postJson("/api/requests", payload);
      setSelectedRequestId(data.request.id);
      setActiveScreen("requester");
      // A successful submit moves the request out of an editable status, so return the form to a
      // clean "new request" state; a saved draft stays open for further edits.
      if (mode === "submit") {
        startNewRequest();
      } else {
        setFormMode("edit");
        setFormRequestId(data.request.id);
      }
    }, mode === "draft"
      ? formMode === "edit"
        ? "Draft updated"
        : "Draft saved"
      : formMode === "edit"
        ? "Request resubmitted and re-evaluated"
        : "Request submitted and evaluated");

  // Row click in "My requests" opens the request read-only in the form.
  const selectRequesterRow = (id: string) => {
    const request = requests.find((item: any) => item.id === id);
    if (request) {
      viewRequestInForm(request);
    } else {
      setSelectedRequestId(id);
    }
  };

  const addComment = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRequestId) return;
    return runAction(async () => {
      await postJson(`/api/requests/${selectedRequestId}/comments`, {
        authorId: actorId,
        visibility: commentVisibility,
        body: commentBody,
      });
      setCommentBody("");
    }, "Comment added");
  };

  const addRequesterComment = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRequestId || !commentBody.trim()) return;
    return runAction(async () => {
      await postJson(`/api/requests/${selectedRequestId}/comments`, {
        authorId: actorId,
        visibility: "PUBLIC",
        body: commentBody,
      });
      setCommentBody("");
    }, "Comment added");
  };

  const addAttachment = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRequestId || !attachmentFile) return;
    return runAction(async () => {
      const mimeType = attachmentFile.type || "application/octet-stream";

      const { uploadUrl, storageKey } = await postJson("/api/upload/presign", {
        fileName: attachmentFile.name,
        mimeType,
        requestId: selectedRequestId,
      });

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: attachmentFile,
        headers: { "Content-Type": mimeType },
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);

      await postJson(`/api/requests/${selectedRequestId}/attachments`, {
        uploadedById: actorId,
        attachmentType,
        fileName: attachmentFile.name,
        mimeType,
        sizeBytes: attachmentFile.size,
        storageKey,
      });
      setAttachmentFile(null);
    }, "Attachment uploaded");
  };

  const setDecisionIntent = (intent: ReviewIntentId) =>
    setDecisionForm(current => ({
      ...current,
      intent,
      reason: reviewIntents[intent].reason,
      comment: reviewIntents[intent].comment,
    }));

  const submitReviewDecision = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRequestId) return;
    const intent = reviewIntents[decisionForm.intent];
    return runAction(async () => {
      await postJson(`/api/requests/${selectedRequestId}/overrides`, {
        createdById: actorId,
        // A plain reviewer decision is attributed to the reviewer; an exception needs a dedicated
        // exception approver (FR-17 / UC-9).
        approverId: intent.needsApprover ? decisionForm.approverId : actorId,
        newDecision: intent.newDecision,
        exception: intent.exception,
        reason: decisionForm.reason,
        comment: decisionForm.comment,
      });
    }, `${intent.label} recorded`);
  };

  const createPolicy = (event: FormEvent) => {
    event.preventDefault();
    return runAction(async () => {
      const data = await postJson("/api/policies", {
        ...policyForm,
        ownerId: actorId,
      });
      const version = data.policy.versions?.find((item: any) => item.status === "DRAFT");
      const builderState = ruleToBuilderState(version?.rules?.[0]);
      setSelectedVersionId(version?.id ?? "");
      setSelectedRuleId(version?.rules?.[0]?.id ?? "");
      setRuleRows(builderState.rows);
      setRuleCombinator(builderState.combinator);
      setRuleEffects(builderState.effects);
      setRuleForm(builderState.form);
    }, "Policy version created");
  };

  const createDraftVersion = (policy: any) =>
    runAction(async () => {
      const data = await postJson(`/api/policies/${policy.id}/versions`, {
        authorId: actorId,
        changeSummary: `Draft update for ${policy.name}`,
        copyCurrentRules: true,
      });
      const version = data.policy.versions?.find((item: any) => item.status === "DRAFT") ?? data.policy.versions?.[0];
      const builderState = ruleToBuilderState(version?.rules?.[0]);
      setSelectedVersionId(version?.id ?? "");
      setSelectedRuleId(version?.rules?.[0]?.id ?? "");
      setRuleRows(builderState.rows);
      setRuleCombinator(builderState.combinator);
      setRuleEffects(builderState.effects);
      setRuleForm(builderState.form);
    }, "Draft policy version created");

  const buildCondition = () => {
    if (ruleRows.length === 0) {
      throw new Error("Dodaj co najmniej jeden warunek przed zapisaniem albo testem reguły draftowej.");
    }

    const conditions = ruleRows.map(row => ({
      field: row.field,
      operator: row.operator,
      value: ["is_empty", "is_not_empty"].includes(row.operator) ? undefined : parseRuleValue(row.value),
    }));
    return conditions.length === 1 ? conditions[0] : { combinator: ruleCombinator, conditions };
  };

  const buildEffects = () =>
    ruleEffects.map(effect => {
      if (effect.type === "REQUIRE_REVIEW" && !effect.approver.trim()) {
        throw new Error("Wskaż rolę lub zespół zatwierdzający dla efektu REQUIRE_REVIEW.");
      }
      if (effect.type === "REQUIRE_FIELD" && (!effect.field.trim() || !effect.label.trim())) {
        throw new Error("Efekt REQUIRE_FIELD wymaga klucza pola i czytelnej etykiety.");
      }
      if (effect.type === "ADD_REASON_CODE" && !effect.code.trim()) {
        throw new Error("Efekt ADD_REASON_CODE wymaga kodu powodu.");
      }
      if (
        effect.type === "ADD_RISK_POINTS" &&
        (!effect.points.trim() || !Number.isFinite(Number(effect.points)) || Number(effect.points) < 0)
      ) {
        throw new Error("Efekt ADD_RISK_POINTS wymaga poprawnej, nieujemnej liczby punktów.");
      }

      return {
        type: effect.type,
        approver: effect.approver.trim() || undefined,
        field: effect.field.trim() || undefined,
        label: effect.label.trim() || undefined,
        code: effect.code.trim() || undefined,
        points: effect.type === "ADD_RISK_POINTS" ? Number(effect.points) : undefined,
        nextStep: effect.nextStep.trim() || undefined,
      };
    });

  const createRule = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedVersionId) return;
    return runAction(async () => {
      const version = versions.find((item: any) => item.id === selectedVersionId);
      if (!isEditablePolicyVersion(version)) {
        throw new Error("Reguły można dodawać tylko do wersji DRAFT. Wersja przekazana do zatwierdzenia jest niemutowalna.");
      }

      const payload = {
        policyVersionId: selectedVersionId,
        name: ruleForm.name,
        description: ruleForm.description,
        severity: ruleForm.severity,
        condition: buildCondition(),
        effects: buildEffects(),
        reason: ruleForm.reason,
        enabled: ruleForm.enabled,
        priority: Number(ruleForm.priority),
      };
      const data = selectedRuleId
        ? await postJson(
            `/api/rules/${selectedRuleId}`,
            {
              name: payload.name,
              description: payload.description,
              severity: payload.severity,
              condition: payload.condition,
              effects: payload.effects,
              reason: payload.reason,
              enabled: payload.enabled,
              priority: payload.priority,
            },
            "PATCH",
          )
        : await postJson("/api/rules", payload);
      const builderState = ruleToBuilderState(data.rule);
      setSelectedRuleId(data.rule.id);
      setRuleRows(builderState.rows);
      setRuleCombinator(builderState.combinator);
      setRuleEffects(builderState.effects);
      setRuleForm(builderState.form);
    }, selectedRuleId ? "Draft rule updated" : "Rule added to draft version");
  };

  const submitVersionForApproval = () =>
    runAction(async () => {
      const version = versions.find((item: any) => item.id === selectedVersionId);
      if (!version) throw new Error("Choose a policy version first");
      if (version.status !== "DRAFT") throw new Error("Tylko wersję DRAFT można przekazać do zatwierdzenia.");
      if ((version.rules ?? []).length === 0) {
        throw new Error("Dodaj i zapisz co najmniej jedną regułę przed wysłaniem wersji do zatwierdzenia.");
      }
      await postJson(`/api/policies/${version.policyId}/submit-for-approval`, {
        versionId: selectedVersionId,
        actorId,
      });
    }, "Version submitted for approval");

  const approveAndPublishVersion = (versionId: string) =>
    runAction(async () => {
      const version = pendingApprovalVersions.find((item: any) => item.id === versionId);
      if (!version) throw new Error("Choose a version awaiting approval first");
      await postJson(`/api/policies/${version.policyId}/publish`, {
        versionId,
        actorId,
      });
      setSelectedApprovalVersionId("");
    }, "Policy version approved and published");

  const rejectVersion = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedApprovalVersion) return;
    return runAction(async () => {
      await postJson(`/api/policies/${selectedApprovalVersion.policyId}/reject`, {
        versionId: selectedApprovalVersion.id,
        actorId,
        reason: rejectForm.reason,
      });
      setSelectedApprovalVersionId("");
    }, "Policy version rejected");
  };

  const runRuleTest = (mode: "active" | "version" | "rule") =>
    runAction(async () => {
      const payload: any = {
        input: {
          ...testInput,
          annualCost: Number(testInput.annualCost),
        },
      };
      if (mode === "version") {
        if (!selectedVersionId) throw new Error("Wybierz wersję roboczą do testu.");
        payload.policyVersionId = selectedVersionId;
      }
      if (mode === "rule") {
        payload.draftRule = {
          name: ruleForm.name.trim() || undefined,
          description: ruleForm.description.trim() || undefined,
          severity: ruleForm.severity,
          condition: buildCondition(),
          effects: buildEffects(),
          reason: ruleForm.reason.trim() || undefined,
          enabled: ruleForm.enabled,
          priority: Number(ruleForm.priority),
        };
      }
      const data = await postJson("/api/test-rules", payload);
      setTestResult(data.result);
    }, "Rule test completed");

  const updateFormField = (field: string, value: unknown) =>
    setRequestForm((current: any) => ({ ...current, [field]: value }));

  return (
    <div className="min-h-screen bg-ui-bg-subtle text-ui-fg-base">
      <Head>
        <title>Policy Checker MVP</title>
        <meta
          name="description"
          content="Policy Checker MVP with deterministic rule evaluation, audit snapshots and role-based workflows."
        />
      </Head>
      <Toaster />

      <header className="sticky top-0 z-20 border-b border-ui-border-base bg-ui-bg-base/95 backdrop-blur">
        <div className="flex w-full flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 xl:px-10 2xl:px-12">
          <div>
            <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
              SKILL AND CHILL case study
            </Text>
            <Heading level="h1">Policy Checker</Heading>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {users.length > 0 && (
              <SelectField
                label="Demo actor"
                value={actorId}
                onValueChange={setActorId}
                options={userOptions()}
              />
            )}
            <Button variant="secondary" onClick={resetDemo}>
              <ArrowPath className="h-4 w-4" />
              Reset demo
            </Button>
          </div>
        </div>
      </header>

      <main className="grid w-full items-start lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-ui-border-base bg-ui-bg-base lg:sticky lg:top-[92px] lg:h-[calc(100dvh-92px)] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="overflow-hidden">
            <div className="border-b border-ui-border-base p-4">
              <Text weight="plus">{selectedActor?.name ?? "Loading actor"}</Text>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {actorRoles.map((role: string) => (
                  <Badge key={role} size="xsmall" color="grey">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
            <nav className="p-2">
              {availableScreens.map(screen => {
                const Icon = screen.icon;
                const isActive = screen.id === activeScreen;
                return (
                  <button
                    key={screen.id}
                    className={`flex w-full items-start gap-x-3 rounded-lg px-3 py-3 text-left transition-fg ${
                      isActive ? "bg-ui-bg-component text-ui-fg-base" : "text-ui-fg-subtle hover:bg-ui-bg-subtle-hover"
                    }`}
                    onClick={() => setActiveScreen(screen.id)}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <Text as="span" weight="plus">
                        {screen.label}
                      </Text>
                      <Text size="xsmall" className="mt-0.5 text-ui-fg-muted">
                        {screen.description}
                      </Text>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-6 xl:px-10 2xl:px-12">
          {errorMessage && (
            <Alert variant="error" dismissible>
              {errorMessage}
            </Alert>
          )}

          {activeScreen === "dashboard" && (
            <div className="space-y-4">
              <Container className="p-0">
                <SectionHeader
                  title="Operational overview"
                  description="Najpierw scenariusze pracy, potem metryki. Każda rola ma osobny ekran i własne akcje."
                  action={<DecisionBadge value="MISSING_INFORMATION" />}
                />
                <div className="grid gap-3 p-6 md:grid-cols-4">
                  {[
                    ["Total requests", dashboard?.totalRequests ?? 0],
                    ["Needs information", dashboard?.missingInformation ?? 0],
                    ["In review", dashboard?.requiresReview ?? 0],
                    ["Rejected", dashboard?.rejected ?? 0],
                  ].map(([label, value]) => (
                    <Container key={label} className="bg-ui-bg-subtle p-4">
                      <Text size="small" className="text-ui-fg-subtle">
                        {label}
                      </Text>
                      <Text size="xlarge" weight="plus" family="mono" className="mt-2">
                        {value}
                      </Text>
                    </Container>
                  ))}
                </div>
              </Container>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Container className="p-0">
                  <SectionHeader title="Primary UX scenarios" description="Ekrany wynikają bezpośrednio z ról i przypadków użycia z PDF." />
                  <div className="grid gap-3 p-6 md:grid-cols-2">
                    {scenarioCards.map(item => {
                      const Icon = item.icon;
                      return (
                        <Container key={item.title} className="bg-ui-bg-base p-4">
                          <div className="flex items-center gap-x-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ui-bg-component">
                              <Icon className="h-4 w-4" />
                            </div>
                            <Text weight="plus">{item.title}</Text>
                          </div>
                          <div className="mt-4 space-y-2">
                            {item.steps.map(step => (
                              <div key={step} className="flex items-center gap-x-2">
                                <CheckMiniSafe />
                                <Text size="small">{step}</Text>
                              </div>
                            ))}
                          </div>
                        </Container>
                      );
                    })}
                  </div>
                </Container>

                <Container className="p-0">
                  <SectionHeader title="Top rule hits" description="Reguły, które najczęściej sterują decyzją." />
                  <div className="divide-y divide-ui-border-base">
                    {(dashboard?.topRuleHits ?? []).map((item: any) => (
                      <div key={item.name} className="flex items-center justify-between gap-x-4 px-6 py-4">
                        <Text size="small">{item.name}</Text>
                        <Badge color="blue">{item.count}</Badge>
                      </div>
                    ))}
                    {(dashboard?.topRuleHits ?? []).length === 0 && (
                      <div className="p-6">
                        <EmptyState title="No rule hits yet" body="Submit a request or reset demo data to populate this panel." />
                      </div>
                    )}
                  </div>
                </Container>
              </div>
            </div>
          )}

          {activeScreen === "requester" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
              <Container className="p-0">
                <SectionHeader
                  title={
                    formMode === "view"
                      ? "Request details"
                      : formMode === "edit"
                        ? "Edit purchase request"
                        : "Submit purchase request"
                  }
                  description={
                    formMode === "view"
                      ? "Podgląd złożonego wniosku, tylko do odczytu. Kliknij „Add new”, aby zacząć nowy."
                      : formMode === "edit"
                        ? "Uzupełnij dane i złóż wniosek ponownie — system oceni go od nowa (UC-4)."
                        : "Wniosek podzielony na czytelne sekcje. Dodatkowe pytania pojawiają się tylko, gdy są potrzebne."
                  }
                  action={
                    <div className="flex flex-wrap gap-2">
                      {formMode === "view" ? (
                        <>
                          <Button onClick={startNewRequest}>
                            <Plus className="h-4 w-4" />
                            Add new
                          </Button>
                          {isEditableRequest(selectedRequest) && selectedRequest?.id === formRequestId && (
                            <Button variant="secondary" onClick={() => editRequestInForm(selectedRequest)}>
                              <PencilSquare className="h-4 w-4" />
                              Edit
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          {formMode === "edit" && (
                            <Button variant="transparent" onClick={startNewRequest}>
                              <Plus className="h-4 w-4" />
                              New request
                            </Button>
                          )}
                          <Button variant="secondary" onClick={() => submitRequest("draft")}>
                            Save draft
                          </Button>
                          <Button onClick={() => submitRequest("submit")}>
                            <FilePlus className="h-4 w-4" />
                            {formMode === "edit" ? "Resubmit" : "Submit"}
                          </Button>
                        </>
                      )}
                    </div>
                  }
                />
                <div className="space-y-4 p-6">
                  {formMode === "view" && (
                    <InlineTip label="Read-only request" variant="info">
                      Oglądasz istniejący wniosek „{requestForm.title || "bez tytułu"}”. Pola są zablokowane — użyj „Add new”, aby utworzyć nowy, lub „Edit”, jeśli wniosek jest edytowalny.
                    </InlineTip>
                  )}
                  {formMode === "edit" && (
                    <InlineTip label="Editing an existing request" variant="info">
                      Zmieniasz wniosek „{requestForm.title || "bez tytułu"}”. Ponowne złożenie uruchomi ocenę reguł.
                    </InlineTip>
                  )}
                  <fieldset disabled={formMode === "view"} className="m-0 min-w-0 space-y-4 border-0 p-0 disabled:opacity-70">

                  <FormSection title="Request basics" description="Co kupujesz i dlaczego." icon={FilePlus}>
                    <div className="md:col-span-2">
                      <TextField label="Title" value={requestForm.title} onChange={value => updateFormField("title", value)} />
                    </div>
                    <div className="md:col-span-2">
                      <TextareaField label="Description" value={requestForm.description} onChange={value => updateFormField("description", value)} />
                    </div>
                    <SelectField label="Request type" value={requestForm.type} onValueChange={value => updateFormField("type", value)} options={options(dictionaries.requestTypes)} />
                    <SelectField label="Category" value={requestForm.category} onValueChange={value => updateFormField("category", value)} options={options(dictionaries.categories)} />
                    <SelectField label="Urgency" value={requestForm.urgency} onValueChange={value => updateFormField("urgency", value)} options={options(dictionaries.urgency)} />
                    <SelectField label="Vendor risk (if known)" value={requestForm.vendorRisk} onValueChange={value => updateFormField("vendorRisk", value)} options={options(dictionaries.vendorRisks)} />
                    {requestForm.urgency === "EMERGENCY" && (
                      <div className="md:col-span-2">
                        <TextareaField
                          label="Emergency justification"
                          value={requestForm.emergencyJustification ?? ""}
                          onChange={value => updateFormField("emergencyJustification", value)}
                          rows={2}
                        />
                        <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                          Zakup awaryjny wymaga dodatkowego uzasadnienia (Reguła 4).
                        </Text>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <TextareaField label="Business justification" value={requestForm.justification} onChange={value => updateFormField("justification", value)} />
                    </div>
                  </FormSection>

                  <FormSection title="Commercials & owners" description="Koszt, dział i osoby odpowiedzialne." icon={ChartBar}>
                    <TextField label="Annual cost" type="number" value={requestForm.annualCost} onChange={value => updateFormField("annualCost", value)} />
                    <SelectField label="Currency" value={requestForm.currency} onValueChange={value => updateFormField("currency", value)} options={options(dictionaries.currencies)} />
                    <SelectField label="Department" value={requestForm.department} onValueChange={value => updateFormField("department", value)} options={options(dictionaries.departments)} />
                    <SelectField
                      label="Business owner"
                      value={requestForm.businessOwnerId}
                      onValueChange={value => updateFormField("businessOwnerId", value)}
                      options={roleUserOptions("BUSINESS_OWNER", false, requestForm.businessOwnerId)}
                    />
                    <div className="md:col-span-2">
                      <SelectField
                        label="Budget owner (optional)"
                        value={requestForm.budgetOwnerId ? requestForm.budgetOwnerId : "__NONE__"}
                        onValueChange={value => updateFormField("budgetOwnerId", value === "__NONE__" ? "" : value)}
                        options={roleUserOptions("BUDGET_OWNER", true, requestForm.budgetOwnerId)}
                      />
                    </div>
                  </FormSection>

                  <FormSection title="Vendor & data" description="Dane dostawcy i przetwarzanie danych osobowych." icon={DecisionProcess}>
                    <TextField label="Vendor name" value={requestForm.vendorName} onChange={value => updateFormField("vendorName", value)} />
                    <TextField label="Vendor country (ISO code)" value={requestForm.vendorCountry} onChange={value => updateFormField("vendorCountry", value.toUpperCase())} placeholder="np. US, PL, DE" />
                    <div className="md:col-span-2">
                      <SwitchField
                        label="Vendor processes personal data"
                        hint="Po włączeniu pojawi się sekcja ochrony danych."
                        checked={requestForm.processesPersonalData}
                        onCheckedChange={value => updateFormField("processesPersonalData", value)}
                      />
                    </div>
                  </FormSection>

                  {requestForm.processesPersonalData && (
                    <FormSection
                      title="Data protection"
                      description="Pytania wymagane, gdy dostawca przetwarza dane osobowe (FR-2)."
                      icon={BellAlert}
                      highlight
                    >
                      <div className="md:col-span-2">
                        <InlineTip label="Dlaczego te pytania?" variant="info">
                          Dane osobowe uruchamiają politykę przetwarzania danych. Brak DPA zablokuje wniosek do czasu dostarczenia dokumentu.
                        </InlineTip>
                      </div>
                      <TextField label="Data categories" value={requestForm.dataCategories} onChange={value => updateFormField("dataCategories", value)} placeholder="np. PERSONAL_DATA, EMAIL" />
                      <SelectField
                        label="Data classification"
                        value={requestForm.dataClassification}
                        onValueChange={value => updateFormField("dataClassification", value)}
                        options={options(["PERSONAL_DATA", "SENSITIVE_PERSONAL_DATA", "CONFIDENTIAL", "INTERNAL", "PUBLIC", "NONE"])}
                      />
                      <SwitchField label="Has DPA in place" hint="Umowa powierzenia przetwarzania danych (DPA)." checked={requestForm.hasDpa} onCheckedChange={value => updateFormField("hasDpa", value)} />
                      <SwitchField label="Transfers data outside EEA" checked={requestForm.transfersOutsideEea} onCheckedChange={value => updateFormField("transfersOutsideEea", value)} />
                      <div className="md:col-span-2">
                        <SwitchField label="Security questionnaire required" checked={requestForm.requiresSecurityQuestionnaire} onCheckedChange={value => updateFormField("requiresSecurityQuestionnaire", value)} />
                      </div>
                    </FormSection>
                  )}
                  </fieldset>
                </div>
              </Container>

              <div className="space-y-4">
                <Container className="p-0">
                  <SectionHeader title="My requests" description="Twoje wnioski. Kliknij wiersz, aby otworzyć podgląd." />
                  <div className="grid gap-3 border-b border-ui-border-base p-4 sm:grid-cols-2">
                    <SelectField
                      label="Status filter"
                      value={requesterStatusFilter}
                      onValueChange={setRequesterStatusFilter}
                      options={[
                        { value: "__ALL__", label: "All statuses" },
                        ...Object.keys(statusLabels).map(status => ({ value: status, label: statusLabels[status] })),
                      ]}
                    />
                    <SelectField
                      label="Sort by date"
                      value={requesterSort}
                      onValueChange={value => setRequesterSort(value as "newest" | "oldest")}
                      options={[
                        { value: "newest", label: "Newest first" },
                        { value: "oldest", label: "Oldest first" },
                      ]}
                    />
                  </div>
                  <RequestTable requests={sortedRequesterRequests} selectedRequestId={selectedRequestId} onSelect={selectRequesterRow} />
                </Container>

                <Container className="p-6">
                  {!selectedRequest ? (
                    <EmptyState title="No request selected" body="Wybierz wniosek z listy, aby zobaczyć decyzję, braki i wymaganych akceptujących." />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Heading level="h2">{selectedRequest.title}</Heading>
                          <Text size="small" className="mt-1 text-ui-fg-subtle">
                            {selectedRequest.vendorName} · {selectedRequest.annualCost} {selectedRequest.currency}
                          </Text>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <DecisionBadge value={selectedRequest.effectiveDecision ?? selectedRequest.decision} />
                          <StatusPill value={selectedRequest.status} />
                        </div>
                      </div>

                      {isEditableRequest(selectedRequest) && (
                        <Button variant="secondary" onClick={() => editRequestInForm(selectedRequest)}>
                          <PencilSquare className="h-4 w-4" />
                          {selectedRequest.status === "NEEDS_INFORMATION" ? "Complete & resubmit" : "Edit draft"}
                        </Button>
                      )}

                      {selectedResult ? (
                        <>
                          <div>
                            <Text weight="plus" size="small">Why this decision</Text>
                            <div className="mt-2 space-y-2">
                              {(selectedResult.reasons ?? []).map((reason: string) => (
                                <div key={reason} className="flex gap-x-2">
                                  <BellAlert className="mt-0.5 h-4 w-4 shrink-0 text-ui-fg-interactive" />
                                  <Text size="small">{reason}</Text>
                                </div>
                              ))}
                            </div>
                          </div>
                          {(selectedResult.nextSteps ?? []).length > 0 && (
                            <div>
                              <Text weight="plus" size="small">Next steps</Text>
                              <div className="mt-2 space-y-2">
                                {selectedResult.nextSteps.map((step: string) => (
                                  <div key={step} className="flex gap-x-2">
                                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-ui-fg-interactive" />
                                    <Text size="small">{step}</Text>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                              <Text size="xsmall" className="text-ui-fg-muted">Missing information</Text>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {(selectedResult.missingFields ?? []).map((field: any) => (
                                  <Badge key={field.field} color="orange" className={wrappingBadgeClassName}>{field.label}</Badge>
                                ))}
                                {(selectedResult.missingFields ?? []).length === 0 && <Badge color="green">Complete</Badge>}
                              </div>
                            </div>
                            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                              <Text size="xsmall" className="text-ui-fg-muted">Required approvers</Text>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {(selectedResult.requiredApprovers ?? []).map((approver: string) => (
                                  <Badge key={approver} color="blue" className={wrappingBadgeClassName}>{approver}</Badge>
                                ))}
                                {(selectedResult.requiredApprovers ?? []).length === 0 && <Badge color="grey">None</Badge>}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <InlineTip label="Draft not submitted" variant="info">
                          Ten wniosek nie został jeszcze złożony. Edytuj go i kliknij „Resubmit”, aby uruchomić ocenę reguł.
                        </InlineTip>
                      )}

                      {selectedResult?.missingFields?.length > 0 && (
                        <form className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4" onSubmit={addAttachment}>
                          <Text weight="plus" size="small">Upload supporting document</Text>
                          <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                            Dodanie dokumentu (np. DPA) automatycznie ponownie oceni wniosek.
                          </Text>
                          <div className="mt-3 grid gap-3">
                            <SelectField label="Document type" value={attachmentType} onValueChange={setAttachmentType} options={options(["DPA", "CONTRACT", "OFFER", "APPROVAL_MAIL", "SECURITY_QUESTIONNAIRE", "VENDOR_ASSESSMENT", "OTHER"])} />
                            <Input type="file" onChange={event => setAttachmentFile(event.target.files?.[0] ?? null)} />
                            <Button type="submit" variant="secondary">
                              <PaperClip className="h-4 w-4" />
                              Upload file
                            </Button>
                          </div>
                        </form>
                      )}

                      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
                        <Text weight="plus" size="small">Discussion</Text>
                        <div className="mt-3 space-y-3">
                          {(selectedRequest.comments ?? [])
                            .filter((comment: any) => comment.visibility === "PUBLIC")
                            .map((comment: any) => (
                              <div key={comment.id}>
                                <Text size="xsmall" weight="plus">{comment.author?.name ?? "User"}</Text>
                                <Text size="small" className="text-ui-fg-subtle">{comment.body}</Text>
                              </div>
                            ))}
                          {(selectedRequest.comments ?? []).filter((comment: any) => comment.visibility === "PUBLIC").length === 0 && (
                            <Text size="small" className="text-ui-fg-subtle">No public comments yet.</Text>
                          )}
                        </div>
                        <form onSubmit={addRequesterComment} className="mt-3 space-y-2">
                          <Textarea value={commentBody} rows={2} onChange={event => setCommentBody(event.target.value)} placeholder="Dodaj publiczny komentarz" />
                          <Button type="submit" variant="secondary" size="small">
                            <ChatBubbleLeftRight className="h-4 w-4" />
                            Comment
                          </Button>
                        </form>
                      </div>
                    </div>
                  )}
                </Container>
              </div>
            </div>
          )}

          {activeScreen === "reviewer" && (
            <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <Container className="p-0">
                <SectionHeader title="Review queue" description="Reviewer pracuje na sprawach wymagających człowieka." />
                <div className="grid gap-3 border-b border-ui-border-base p-4">
                  <TextField label="Search" value={filters.search === "__ALL__" ? "" : filters.search} onChange={value => setFilters(current => ({ ...current, search: value || "__ALL__" }))} placeholder="Vendor or title" />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    Kolejka pokazuje wyłącznie wnioski ze statusem IN_REVIEW i decyzją REQUIRES_REVIEW.
                  </Text>
                </div>
                <RequestTable requests={requests} selectedRequestId={selectedRequestId} onSelect={setSelectedRequestId} compact />
              </Container>

              <Container className="p-0">
                <SectionHeader title="Review workspace" description="Przeczytaj uzasadnienie, podejmij decyzję i współpracuj — w jednym miejscu." />
                <div className="p-6">
                  <Tabs defaultValue="summary">
                    <Tabs.List>
                      <Tabs.Trigger value="summary">Decision &amp; rules</Tabs.Trigger>
                      <Tabs.Trigger value="decide">Make decision</Tabs.Trigger>
                      <Tabs.Trigger value="collaboration">Collaboration</Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="summary" className="pt-5">
                      <RequestSummary request={selectedRequest} />
                    </Tabs.Content>
                    <Tabs.Content value="decide" className="pt-5">
                      {!selectedRequest ? (
                        <EmptyState title="No request selected" body="Wybierz wniosek z kolejki, aby podjąć decyzję." />
                      ) : (
                        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,0.85fr)]">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Text weight="plus" className="min-w-0 break-words">{selectedRequest.title}</Text>
                              <div className="flex flex-wrap gap-2">
                                <DecisionBadge value={selectedRequest.effectiveDecision ?? selectedRequest.decision} />
                                <StatusPill value={selectedRequest.status} />
                              </div>
                            </div>
                            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                              <Text size="xsmall" weight="plus" className="uppercase text-ui-fg-muted">System reasons</Text>
                              <div className="mt-2 space-y-1.5">
                                {(selectedResult?.reasons ?? []).map((reason: string) => (
                                  <Text key={reason} size="small">• {reason}</Text>
                                ))}
                                {(selectedResult?.reasons ?? []).length === 0 && (
                                  <Text size="small" className="text-ui-fg-subtle">No system reasons recorded.</Text>
                                )}
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                                <Text size="xsmall" className="text-ui-fg-muted">Missing information</Text>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {(selectedResult?.missingFields ?? []).map((field: any) => (
                                    <Badge key={field.field} color="orange" className={wrappingBadgeClassName}>{field.label}</Badge>
                                  ))}
                                  {(selectedResult?.missingFields ?? []).length === 0 && <Badge color="green">Complete</Badge>}
                                </div>
                              </div>
                              <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                                <Text size="xsmall" className="text-ui-fg-muted">Required approvers</Text>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {(selectedResult?.requiredApprovers ?? []).map((approver: string) => (
                                    <Badge key={approver} color="blue" className={wrappingBadgeClassName}>{approver}</Badge>
                                  ))}
                                  {(selectedResult?.requiredApprovers ?? []).length === 0 && <Badge color="grey">None</Badge>}
                                </div>
                              </div>
                            </div>
                          </div>

                          <form onSubmit={submitReviewDecision} className="space-y-4 rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
                            <div>
                              <Text weight="plus" size="small">Reviewer decision</Text>
                              <Text size="xsmall" className="text-ui-fg-muted">
                                Wybierz wynik oceny. „Approve as exception” zapisuje audytowany override.
                              </Text>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {(Object.keys(reviewIntents) as ReviewIntentId[]).map(key => {
                                const intent = reviewIntents[key];
                                const active = decisionForm.intent === key;
                                return (
                                  <button
                                    type="button"
                                    key={key}
                                    onClick={() => setDecisionIntent(key)}
                                    className={`rounded-lg border px-3 py-2 text-left transition-fg ${
                                      active
                                        ? "border-ui-border-interactive bg-ui-bg-highlight"
                                        : "border-ui-border-base hover:bg-ui-bg-subtle-hover"
                                    }`}
                                  >
                                    <Text size="small" weight="plus">{intent.label}</Text>
                                    <Text size="xsmall" className="text-ui-fg-muted">{intent.helper}</Text>
                                  </button>
                                );
                              })}
                            </div>
                            {reviewIntents[decisionForm.intent].needsApprover && (
                              <SelectField
                                label="Exception approver"
                                value={decisionForm.approverId}
                                onValueChange={value => setDecisionForm(current => ({ ...current, approverId: value }))}
                                options={userOptions()}
                              />
                            )}
                            <TextField label="Reason" value={decisionForm.reason} onChange={value => setDecisionForm(current => ({ ...current, reason: value }))} />
                            <TextareaField label="Comment" value={decisionForm.comment} onChange={value => setDecisionForm(current => ({ ...current, comment: value }))} />
                            <Button
                              type="submit"
                              variant={
                                reviewIntents[decisionForm.intent].tone === "danger"
                                  ? "danger"
                                  : reviewIntents[decisionForm.intent].tone === "secondary"
                                    ? "secondary"
                                    : "primary"
                              }
                            >
                              <BadgeCheck className="h-4 w-4" />
                              {reviewIntents[decisionForm.intent].label}
                            </Button>
                            {reviewIntents[decisionForm.intent].exception && (
                              <InlineTip label="Audited exception" variant="warning">
                                Oryginalna decyzja systemu pozostaje nienaruszona; wyjątek zapisuje się jako osobny wpis audytowy (NFR-7).
                              </InlineTip>
                            )}
                          </form>
                        </div>
                      )}
                    </Tabs.Content>
                    <Tabs.Content value="collaboration" className="pt-5">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <form onSubmit={addComment} className="space-y-4">
                          <Text weight="plus">Add comment</Text>
                          <SelectField label="Visibility" value={commentVisibility} onValueChange={setCommentVisibility} options={options(["PUBLIC", "INTERNAL"])} />
                          <TextareaField label="Comment" value={commentBody} onChange={setCommentBody} />
                          <Button type="submit" variant="secondary">
                            <ChatBubbleLeftRight className="h-4 w-4" />
                            Add comment
                          </Button>
                        </form>
                        <form onSubmit={addAttachment} className="space-y-4">
                          <Text weight="plus">Add attachment</Text>
                          <SelectField label="Type" value={attachmentType} onValueChange={setAttachmentType} options={options(["DPA", "CONTRACT", "OFFER", "APPROVAL_MAIL", "SECURITY_QUESTIONNAIRE", "VENDOR_ASSESSMENT", "OTHER"])} />
                          <Input type="file" onChange={event => setAttachmentFile(event.target.files?.[0] ?? null)} />
                          <Button type="submit" variant="secondary">
                            <PaperClip className="h-4 w-4" />
                            Upload file
                          </Button>
                        </form>
                      </div>
                      <ActivityLists request={selectedRequest} />
                    </Tabs.Content>
                  </Tabs>
                </div>
              </Container>
            </div>
          )}

          {activeScreen === "policies" && (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                <Container className="p-0">
                  <SectionHeader title="Policies" description="Policy Owner zarządza wersjami bez wchodzenia w kolejkę review." />
                  <div className="p-6">
                    <form className="grid gap-4" onSubmit={createPolicy}>
                      <TextField label="Policy name" value={policyForm.name} onChange={value => setPolicyForm(current => ({ ...current, name: value }))} />
                      <SelectField label="Domain" value={policyForm.domain} onValueChange={value => setPolicyForm(current => ({ ...current, domain: value }))} options={options(["PROCUREMENT", "VENDOR_RISK", "DATA_SECURITY", "FINANCE"])} />
                      <TextareaField label="Description" value={policyForm.description} onChange={value => setPolicyForm(current => ({ ...current, description: value }))} />
                      <TextField label="Change summary" value={policyForm.changeSummary} onChange={value => setPolicyForm(current => ({ ...current, changeSummary: value }))} />
                      <Button type="submit" variant="secondary">
                        <Plus className="h-4 w-4" />
                        Create draft policy
                      </Button>
                    </form>
                  </div>
                </Container>

                <Container className="overflow-hidden p-0">
                  <SectionHeader title="Policy registry" description="Opublikowane wersje i oczekujące drafty są rozdzielone, aby ich status i numeracja były jednoznaczne." />
                  <Tabs defaultValue="published">
                    <Tabs.List className="mx-4 mt-4 sm:mx-6">
                      <Tabs.Trigger value="published">Published {publishedPolicies.length}</Tabs.Trigger>
                      <Tabs.Trigger value="drafts">Drafts {openPolicyVersions.length}</Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="published" className="pt-3">
                      {publishedPolicies.length === 0 ? (
                        <div className="p-6">
                          <EmptyState
                            title="No published policies"
                            body="Utwórz politykę, dodaj reguły i prześlij ją do zatwierdzenia."
                          />
                        </div>
                      ) : (
                        <TableScroll>
                          <Table>
                            <Table.Header>
                              <Table.Row>
                                <Table.HeaderCell>Policy</Table.HeaderCell>
                                <Table.HeaderCell>Domain</Table.HeaderCell>
                                <Table.HeaderCell>Current version</Table.HeaderCell>
                                <Table.HeaderCell>Published</Table.HeaderCell>
                                <Table.HeaderCell>Next change</Table.HeaderCell>
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
                              {publishedPolicies.map((policy: any) => {
                                const currentVersion = (policy.versions ?? []).find(
                                  (version: any) => version.id === policy.currentVersionId,
                                );
                                const hasOpenVersion = (policy.versions ?? []).some(isOpenPolicyVersion);

                                return (
                                  <Table.Row
                                    key={policy.id}
                                    className="cursor-pointer"
                                    onClick={() => setSelectedPolicyId(policy.id)}
                                  >
                                    <Table.Cell>
                                      <Text weight="plus" size="small">{policy.name}</Text>
                                    </Table.Cell>
                                    <Table.Cell>{policy.domain}</Table.Cell>
                                    <Table.Cell>
                                      <Badge color="green">{policyVersionLabel(currentVersion)}</Badge>
                                    </Table.Cell>
                                    <Table.Cell>{formatDate(currentVersion?.effectiveFrom)}</Table.Cell>
                                    <Table.Cell>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="small"
                                        disabled={hasOpenVersion}
                                        onClick={event => {
                                          event.stopPropagation();
                                          createDraftVersion(policy);
                                        }}
                                      >
                                        <Plus className="h-4 w-4" />
                                        {hasOpenVersion ? "Draft in progress" : "New draft"}
                                      </Button>
                                    </Table.Cell>
                                  </Table.Row>
                                );
                              })}
                            </Table.Body>
                          </Table>
                        </TableScroll>
                      )}
                    </Tabs.Content>
                    <Tabs.Content value="drafts" className="pt-3">
                      {openPolicyVersions.length === 0 ? (
                        <div className="p-6">
                          <EmptyState
                            title="No drafts"
                            body="Nowa wersja robocza pojawi się tutaj bez numeru wersji."
                          />
                        </div>
                      ) : (
                        <TableScroll>
                          <Table>
                            <Table.Header>
                              <Table.Row>
                                <Table.HeaderCell>Policy</Table.HeaderCell>
                                <Table.HeaderCell>Change</Table.HeaderCell>
                                <Table.HeaderCell>Status</Table.HeaderCell>
                                <Table.HeaderCell>Planned version</Table.HeaderCell>
                                <Table.HeaderCell>Rules</Table.HeaderCell>
                                <Table.HeaderCell>Action</Table.HeaderCell>
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
                              {openPolicyVersions.map((version: any) => (
                                <Table.Row key={version.id}>
                                  <Table.Cell>
                                    <Text weight="plus" size="small">{version.policy.name}</Text>
                                    <Text size="xsmall" className="text-ui-fg-muted">{version.policy.domain}</Text>
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Text size="small" className="max-w-[34ch] break-words">
                                      {version.changeSummary}
                                    </Text>
                                  </Table.Cell>
                                  <Table.Cell><PolicyStatusPill value={version.status} /></Table.Cell>
                                  <Table.Cell>
                                    <Text size="small">v{nextPublishedVersionNumber(version.policy)} after approval</Text>
                                  </Table.Cell>
                                  <Table.Cell>{version.rules?.length ?? 0}</Table.Cell>
                                  <Table.Cell>
                                    {version.status === "DRAFT" ? (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="small"
                                        onClick={() => {
                                          setSelectedVersionId(version.id);
                                          applyRuleBuilderState(version.id);
                                        }}
                                      >
                                        <TablePen className="h-4 w-4" />
                                        Edit rules
                                      </Button>
                                    ) : (
                                      <Text size="xsmall" className="text-ui-fg-muted">Locked during review</Text>
                                    )}
                                  </Table.Cell>
                                </Table.Row>
                              ))}
                            </Table.Body>
                          </Table>
                        </TableScroll>
                      )}
                    </Tabs.Content>
                  </Tabs>
                </Container>
              </div>

              <PolicyDetailDrawer
                policy={selectedPolicyDetail}
                open={Boolean(selectedPolicyId)}
                onOpenChange={open => {
                  if (!open) setSelectedPolicyId("");
                }}
              />

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <Container className="p-0">
                  <SectionHeader
                    title="Rule builder"
                    description="Condition builder zamiast surowego JSON albo eval."
                    action={
                      <Button onClick={submitVersionForApproval}>
                        <BadgeCheck className="h-4 w-4" />
                        Submit for approval
                      </Button>
                    }
                  />
                  <form className="space-y-5 p-6" onSubmit={createRule}>
                    <SelectField
                      label="Target version"
                      value={selectedVersionId || "__NONE__"}
                      onValueChange={value => {
                        const versionId = value === "__NONE__" ? "" : value;
                        setSelectedVersionId(versionId);
                        applyRuleBuilderState(versionId);
                      }}
                      options={[
                        { value: "__NONE__", label: "Choose draft version" },
                        ...editablePolicyVersions.map((version: any) => ({
                          value: version.id,
                          label: `${version.policy.name} · Draft → v${nextPublishedVersionNumber(version.policy)}`,
                        })),
                      ]}
                    />
                    {selectedVersion && (
                      <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <div>
                            <Text weight="plus">{selectedVersion.policy.name}</Text>
                            <Text size="small" className="text-ui-fg-subtle">
                              {selectedVersion.changeSummary} · {selectedVersion.rules?.length ?? 0} saved rules
                            </Text>
                          </div>
                          <Button type="button" variant="secondary" size="small" onClick={startNewRule}>
                            <Plus className="h-4 w-4" />
                            New rule
                          </Button>
                        </div>
                        {(selectedVersion.rules ?? []).length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {(selectedVersion.rules ?? []).map((rule: any) => (
                              <Button
                                key={rule.id}
                                type="button"
                                variant={selectedRuleId === rule.id ? "primary" : "secondary"}
                                size="small"
                                onClick={() => applyRuleBuilderState(selectedVersion.id, rule.id)}
                              >
                                {rule.name}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField
                        label="Rule name"
                        value={ruleForm.name}
                        onChange={value => setRuleForm(current => ({ ...current, name: value }))}
                      />
                      <SelectField
                        label="Severity"
                        value={ruleForm.severity}
                        onValueChange={value => setRuleForm(current => ({ ...current, severity: value }))}
                        options={options(["INFO", "WARNING", "BLOCKER"])}
                      />
                      <div className="md:col-span-2">
                        <TextareaField
                          label="Description"
                          value={ruleForm.description}
                          onChange={value => setRuleForm(current => ({ ...current, description: value }))}
                        />
                      </div>
                      <TextField
                        label="Priority"
                        type="number"
                        value={String(ruleForm.priority)}
                        onChange={value => setRuleForm(current => ({ ...current, priority: Number(value) }))}
                      />
                      <SwitchField
                        label="Rule enabled"
                        checked={ruleForm.enabled}
                        onCheckedChange={value => setRuleForm(current => ({ ...current, enabled: value }))}
                      />
                    </div>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                      <div>
                        <Text weight="plus">Conditions</Text>
                        <Text size="small" className="text-ui-fg-subtle">
                          Wybierz, czy reguła wymaga wszystkich warunków, czy dowolnego z nich.
                        </Text>
                      </div>
                      <div className="w-full sm:w-56">
                        <SelectField
                          label="Match logic"
                          value={ruleCombinator}
                          onValueChange={setRuleCombinator}
                          options={[
                            { value: "ALL", label: "ALL · all conditions" },
                            { value: "ANY", label: "ANY · any condition" },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      {ruleRows.length === 0 && (
                        <div className="rounded-lg border border-dashed border-ui-border-base bg-ui-bg-subtle px-4 py-5">
                          <Text size="small" className="text-ui-fg-subtle">
                            Brak warunków. Dodaj warunek, żeby określić kiedy reguła ma się uruchomić.
                          </Text>
                        </div>
                      )}
                      {ruleRows.map((row, index) => (
                        <div key={index} className="relative grid gap-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 pr-12 md:grid-cols-3">
                          <Button
                            type="button"
                            variant="transparent"
                            size="small"
                            className="absolute right-2 top-2"
                            aria-label="Usuń warunek"
                            title="Usuń warunek"
                            onClick={() => setRuleRows(current => current.filter((_, i) => i !== index))}
                          >
                            <XMarkMini className="h-4 w-4" />
                          </Button>
                          <SelectField
                            label="Field"
                            value={row.field}
                            onValueChange={value => setRuleRows(current => current.map((item, i) => (i === index ? { ...item, field: value } : item)))}
                            options={options(fieldOptions)}
                          />
                          <SelectField
                            label="Operator"
                            value={row.operator}
                            onValueChange={value => setRuleRows(current => current.map((item, i) => (i === index ? { ...item, operator: value } : item)))}
                            options={options(operatorOptions)}
                          />
                          {["is_empty", "is_not_empty"].includes(row.operator) ? (
                            <div className="flex flex-col gap-y-1.5">
                              <Label size="small" weight="plus">Value</Label>
                              <div className="flex min-h-[40px] items-center rounded-md border border-ui-border-base bg-ui-bg-base px-3">
                                <Text size="small" className="text-ui-fg-muted">Not used by this operator</Text>
                              </div>
                            </div>
                          ) : (
                            <TextField
                              label="Value"
                              value={row.value}
                              onChange={value => setRuleRows(current => current.map((item, i) => (i === index ? { ...item, value } : item)))}
                            />
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setRuleRows(current => [...current, { ...emptyRuleRow }])}
                      >
                        <Plus className="h-4 w-4" />
                        Add condition
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Text weight="plus">Effects</Text>
                        <Text size="small" className="text-ui-fg-subtle">
                          Reguła może wykonać jeden lub kilka efektów zgodnie z FR-15.
                        </Text>
                      </div>
                      {ruleEffects.map((effect, index) => (
                        <div
                          key={index}
                          className="relative space-y-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4"
                        >
                          {ruleEffects.length > 1 && (
                            <Button
                              type="button"
                              variant="transparent"
                              size="small"
                              className="absolute right-2 top-2"
                              aria-label="Usuń efekt"
                              title="Usuń efekt"
                              onClick={() => setRuleEffects(current => current.filter((_, itemIndex) => itemIndex !== index))}
                            >
                              <XMarkMini className="h-4 w-4" />
                            </Button>
                          )}
                          <div className="grid gap-4 pr-8 md:grid-cols-2">
                            <SelectField
                              label="Effect type"
                              value={effect.type}
                              onValueChange={value =>
                                setRuleEffects(current =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index ? { ...emptyRuleEffect, type: value } : item,
                                  ),
                                )
                              }
                              options={options([
                                "REQUIRE_REVIEW",
                                "REQUIRE_FIELD",
                                "REJECT",
                                "APPROVE",
                                "ADD_REASON_CODE",
                                "ADD_RISK_POINTS",
                              ])}
                            />
                            {effect.type === "REQUIRE_REVIEW" && (
                              <SelectField
                                label="Required approver"
                                value={effect.approver}
                                placeholder="Choose approver"
                                options={approverOptions(effect.approver)}
                                onValueChange={value =>
                                  setRuleEffects(current =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, approver: value } : item,
                                    ),
                                  )
                                }
                              />
                            )}
                            {effect.type === "REQUIRE_FIELD" && (
                              <>
                                <TextField
                                  label="Required field key"
                                  value={effect.field}
                                  onChange={value =>
                                    setRuleEffects(current =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, field: value } : item,
                                      ),
                                    )
                                  }
                                />
                                <TextField
                                  label="Business label"
                                  value={effect.label}
                                  onChange={value =>
                                    setRuleEffects(current =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, label: value } : item,
                                      ),
                                    )
                                  }
                                />
                                <SelectField
                                  label="Reviewer after completion (optional)"
                                  value={effect.approver || "__NONE__"}
                                  options={approverOptions(effect.approver, true)}
                                  onValueChange={value =>
                                    setRuleEffects(current =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, approver: value === "__NONE__" ? "" : value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </>
                            )}
                            {effect.type === "ADD_REASON_CODE" && (
                              <TextField
                                label="Reason code"
                                value={effect.code}
                                onChange={value =>
                                  setRuleEffects(current =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, code: value } : item,
                                    ),
                                  )
                                }
                              />
                            )}
                            {effect.type === "ADD_RISK_POINTS" && (
                              <TextField
                                label="Risk points"
                                type="number"
                                value={effect.points}
                                onChange={value =>
                                  setRuleEffects(current =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, points: value } : item,
                                    ),
                                  )
                                }
                              />
                            )}
                            {["REQUIRE_REVIEW", "REQUIRE_FIELD", "REJECT", "APPROVE"].includes(effect.type) && (
                              <div className="md:col-span-2">
                                <TextField
                                  label="Recommended next step (optional)"
                                  value={effect.nextStep}
                                  onChange={value =>
                                    setRuleEffects(current =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, nextStep: value } : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setRuleEffects(current => [...current, { ...emptyRuleEffect }])}
                      >
                        <Plus className="h-4 w-4" />
                        Add effect
                      </Button>
                    </div>
                    <TextareaField
                      label="Business reason"
                      value={ruleForm.reason}
                      onChange={value => setRuleForm(current => ({ ...current, reason: value }))}
                    />
                    <div className="flex flex-wrap items-center gap-3 border-t border-ui-border-base pt-5">
                      <Button type="submit" variant="secondary" disabled={!selectedVersionId}>
                        <TablePen className="h-4 w-4" />
                        {selectedRule ? "Update rule" : "Save rule"}
                      </Button>
                      <Text size="xsmall" className="text-ui-fg-muted">
                        Zapis jest wymagany, aby reguła weszła do wersji wysyłanej do zatwierdzenia.
                      </Text>
                    </div>
                  </form>
                </Container>

                <Container className="p-0">
                  <SectionHeader title="Rule console" description="Test aktywnych polityk, całej zapisanej wersji roboczej albo reguły jeszcze otwartej w edytorze." />
                  <div className="space-y-5 p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField label="Annual cost" type="number" value={testInput.annualCost} onChange={value => setTestInput(current => ({ ...current, annualCost: value }))} />
                      <SelectField label="Category" value={testInput.category} onValueChange={value => setTestInput(current => ({ ...current, category: value }))} options={options(dictionaries.categories)} />
                      <SelectField label="Currency" value={testInput.currency} onValueChange={value => setTestInput(current => ({ ...current, currency: value }))} options={options(dictionaries.currencies)} />
                      <TextField label="Vendor country" value={testInput.vendorCountry} onChange={value => setTestInput(current => ({ ...current, vendorCountry: value.toUpperCase() }))} />
                      <SelectField label="Vendor risk" value={testInput.vendorRisk} onValueChange={value => setTestInput(current => ({ ...current, vendorRisk: value }))} options={options(dictionaries.vendorRisks)} />
                      <SelectField label="Urgency" value={testInput.urgency} onValueChange={value => setTestInput(current => ({ ...current, urgency: value }))} options={options(dictionaries.urgency)} />
                      <SwitchField label="Personal data" checked={testInput.processesPersonalData} onCheckedChange={value => setTestInput(current => ({ ...current, processesPersonalData: value }))} />
                      <SwitchField label="Has DPA" checked={testInput.hasDpa} onCheckedChange={value => setTestInput(current => ({ ...current, hasDpa: value }))} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => runRuleTest("active")}>
                        <Beaker className="h-4 w-4" />
                        Test active policies
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!selectedVersionId}
                        onClick={() => runRuleTest("version")}
                      >
                        <Beaker className="h-4 w-4" />
                        Test saved draft version
                      </Button>
                      <Button onClick={() => runRuleTest("rule")}>
                        <Beaker className="h-4 w-4" />
                        Test rule in editor
                      </Button>
                    </div>
                    {testResult && (
                      <Container className="space-y-5 bg-ui-bg-subtle p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <Text weight="plus">Test result</Text>
                          <DecisionBadge value={testResult.decision} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <Text size="xsmall" className="text-ui-fg-muted">Matched rules</Text>
                            <Text family="mono" weight="plus">{testResult.matchedRules?.length ?? 0}</Text>
                          </div>
                          <div>
                            <Text size="xsmall" className="text-ui-fg-muted">Risk points</Text>
                            <Text family="mono" weight="plus">{testResult.riskPoints ?? 0}</Text>
                          </div>
                          <div>
                            <Text size="xsmall" className="text-ui-fg-muted">Required approvers</Text>
                            <Text family="mono" weight="plus">{testResult.requiredApprovers?.length ?? 0}</Text>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Text weight="plus" size="small">Reasons</Text>
                          {testResult.reasons.map((reason: string) => (
                            <Text key={reason} size="small">
                              {reason}
                            </Text>
                          ))}
                        </div>
                        <div className="space-y-3">
                          <Text weight="plus" size="small">Matched rules and effects</Text>
                          {(testResult.matchedRules ?? []).map((rule: any) => (
                            <div key={`${rule.policyVersionId}-${rule.ruleId ?? rule.ruleName}`} className="rounded-lg border border-ui-border-base bg-ui-bg-base p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <Text weight="plus" size="small">{rule.ruleName}</Text>
                                  <Text size="xsmall" className="text-ui-fg-muted">
                                    {rule.policyName} · v{rule.policyVersionNumber}
                                  </Text>
                                </div>
                                <Badge size="2xsmall">{rule.severity}</Badge>
                              </div>
                              <div className="mt-3">
                                <EffectSummary effects={rule.effects ?? []} />
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(rule.facts ?? []).map((fact: any, factIndex: number) => (
                                  <Badge key={`${fact.field}-${factIndex}`} size="2xsmall" color={fact.matched ? "green" : "grey"} className={wrappingBadgeClassName}>
                                    {fieldLabels[fact.field] ?? fact.field}: {String(fact.actual)} → {String(fact.expected)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                          {(testResult.matchedRules ?? []).length === 0 && (
                            <Text size="small" className="text-ui-fg-subtle">
                              Żadna reguła nie została dopasowana do danych testowych.
                            </Text>
                          )}
                        </div>
                      </Container>
                    )}
                  </div>
                </Container>
              </div>
            </div>
          )}

          {activeScreen === "approvals" && (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <Container className="p-0">
                <SectionHeader title="Pending approvals" description="Wersje przekazane przez Policy Ownera i czekające na decyzję." />
                {pendingApprovalVersions.length === 0 && (
                  <div className="p-6">
                    <EmptyState title="No versions awaiting approval" body="Policy Owner nie przekazał jeszcze żadnej wersji do publikacji." />
                  </div>
                )}
                {pendingApprovalVersions.length > 0 && (
                  <TableScroll>
                    <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Policy</Table.HeaderCell>
                        <Table.HeaderCell>Candidate</Table.HeaderCell>
                        <Table.HeaderCell>Author</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {pendingApprovalVersions.map((version: any) => (
                        <Table.Row
                          key={version.id}
                          className={selectedApprovalVersionId === version.id ? "bg-ui-bg-highlight" : "cursor-pointer"}
                          onClick={() => setSelectedApprovalVersionId(version.id)}
                        >
                          <Table.Cell>{version.policy.name}</Table.Cell>
                          <Table.Cell>
                            <Text size="small">Draft → v{nextPublishedVersionNumber(version.policy)}</Text>
                          </Table.Cell>
                          <Table.Cell>{version.author?.name ?? "—"}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                    </Table>
                  </TableScroll>
                )}
              </Container>

              <Container className="p-0">
                <SectionHeader
                  title="Approval workspace"
                  description="Przegląd reguł oraz akceptacja, publikacja albo odrzucenie wersji."
                  action={
                    selectedApprovalVersion ? (
                      <Button onClick={() => approveAndPublishVersion(selectedApprovalVersion.id)}>
                        <BadgeCheck className="h-4 w-4" />
                        Approve &amp; publish
                      </Button>
                    ) : undefined
                  }
                />
                <div className="space-y-5 p-6">
                  {!selectedApprovalVersion && (
                    <EmptyState title="Choose a version" body="Wybierz wersję z listy, aby zobaczyć jej reguły i podjąć decyzję." />
                  )}
                  {selectedApprovalVersion && (
                    <>
                       <div className="flex items-center justify-between gap-x-3">
                        <div>
                          <Text weight="plus">
                            {selectedApprovalVersion.policy.name} · Draft candidate
                          </Text>
                          <Text size="small" className="text-ui-fg-subtle">
                            {selectedApprovalVersion.changeSummary}
                          </Text>
                          <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                            Po zatwierdzeniu zostanie opublikowana jako v{nextPublishedVersionNumber(selectedApprovalVersion.policy)}.
                          </Text>
                        </div>
                         <PolicyStatusPill value={selectedApprovalVersion.status} />
                       </div>
                       <div className="grid gap-3 sm:grid-cols-3">
                         <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                           <Text size="xsmall" className="text-ui-fg-muted">Current publication</Text>
                           <Text weight="plus">
                             {currentApprovalBaseVersion
                               ? policyVersionLabel(currentApprovalBaseVersion)
                               : "First publication"}
                           </Text>
                         </div>
                         <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                           <Text size="xsmall" className="text-ui-fg-muted">Candidate publication</Text>
                           <Text weight="plus">
                             v{nextPublishedVersionNumber(selectedApprovalVersion.policy)}
                           </Text>
                         </div>
                         <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                           <Text size="xsmall" className="text-ui-fg-muted">Rules to review</Text>
                           <Text weight="plus">{selectedApprovalVersion.rules?.length ?? 0}</Text>
                         </div>
                       </div>
                      <div className="space-y-3">
                        <Text weight="plus">Rules in this version</Text>
                        {(selectedApprovalVersion.rules ?? []).map((rule: any) => (
                          <RuleDetailCard key={rule.id} rule={rule} />
                        ))}
                        {(selectedApprovalVersion.rules ?? []).length === 0 && <Text size="small">No rules in this version.</Text>}
                      </div>
                      <form onSubmit={rejectVersion} className="space-y-3 border-t border-ui-border-base pt-5">
                        <Text weight="plus">Reject version</Text>
                        <TextareaField label="Reason" value={rejectForm.reason} onChange={value => setRejectForm({ reason: value })} />
                        <Button type="submit" variant="secondary">
                          <ArrowPath className="h-4 w-4" />
                          Reject and send back to draft
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </Container>
              </div>

              <Container className="overflow-hidden p-0">
                <SectionHeader
                  title="Published change history"
                  description="Historia zatwierdzonych publikacji wraz z autorem zmiany, approverem i datą publikacji."
                />
                {approvedPolicyVersions.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      title="No published changes"
                      body="Historia pojawi się po zatwierdzeniu pierwszej wersji polityki."
                    />
                  </div>
                ) : (
                  <TableScroll>
                    <Table>
                      <Table.Header>
                        <Table.Row>
                          <Table.HeaderCell>Policy</Table.HeaderCell>
                          <Table.HeaderCell>Version</Table.HeaderCell>
                          <Table.HeaderCell>Change summary</Table.HeaderCell>
                          <Table.HeaderCell>Author</Table.HeaderCell>
                          <Table.HeaderCell>Approved by</Table.HeaderCell>
                          <Table.HeaderCell>Published at</Table.HeaderCell>
                          <Table.HeaderCell>Status</Table.HeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {approvedPolicyVersions.map((version: any) => (
                          <Table.Row key={version.id}>
                            <Table.Cell>
                              <Text weight="plus" size="small">{version.policy.name}</Text>
                            </Table.Cell>
                            <Table.Cell><Badge color="green">v{version.versionNumber}</Badge></Table.Cell>
                            <Table.Cell>
                              <Text size="small" className="max-w-[42ch] break-words">
                                {version.changeSummary}
                              </Text>
                            </Table.Cell>
                            <Table.Cell>{version.author?.name ?? "—"}</Table.Cell>
                            <Table.Cell>{version.approvedBy?.name ?? "Initial publication"}</Table.Cell>
                            <Table.Cell>{formatDate(version.approvedAt ?? version.effectiveFrom)}</Table.Cell>
                            <Table.Cell><PolicyStatusPill value={version.status} /></Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  </TableScroll>
                )}
              </Container>
            </div>
          )}

          {activeScreen === "audit" && (
            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <Container className="p-0">
                <SectionHeader title="Audit index" description="Auditor wybiera historyczny wniosek, nie edytuje go." />
                <RequestTable requests={requests} selectedRequestId={selectedRequestId} onSelect={setSelectedRequestId} compact />
              </Container>
              <Container className="p-0">
                <SectionHeader title="Decision reconstruction" description="Snapshoty pozostają powiązane z wersją polityki z momentu oceny." />
                <div className="space-y-5 p-6">
                  <RequestSummary request={selectedRequest} />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Container className="p-0">
                      <div className="border-b border-ui-border-base px-4 py-3">
                        <Text weight="plus">Evaluation history</Text>
                      </div>
                      <div className="divide-y divide-ui-border-base">
                        {(selectedRequest?.evaluations ?? []).map((evaluation: any) => (
                          <div key={evaluation.id} className="flex items-center justify-between gap-x-4 px-4 py-3">
                            <div>
                              <Text size="small" weight="plus">
                                {formatDate(evaluation.evaluatedAt)}
                              </Text>
                              <Text size="xsmall" className="text-ui-fg-muted">
                                {evaluation.ruleMatches?.length ?? 0} rule records
                              </Text>
                            </div>
                            <DecisionBadge value={evaluation.decision} />
                          </div>
                        ))}
                      </div>
                    </Container>
                    <Container className="p-0">
                      <div className="border-b border-ui-border-base px-4 py-3">
                        <Text weight="plus">Manual overrides</Text>
                      </div>
                      <div className="divide-y divide-ui-border-base">
                        {(selectedRequest?.manualOverrides ?? []).map((override: any) => (
                          <div key={override.id} className="px-4 py-3">
                            <div className="flex items-center justify-between">
                              <DecisionBadge value={override.newDecision} />
                              <Text size="xsmall" className="text-ui-fg-muted">
                                {formatDate(override.createdAt)}
                              </Text>
                            </div>
                            <Text size="small" className="mt-2">
                              {override.reason}
                            </Text>
                          </div>
                        ))}
                        {(selectedRequest?.manualOverrides ?? []).length === 0 && (
                          <div className="p-4">
                            <Text size="small" className="text-ui-fg-subtle">
                              No manual overrides recorded.
                            </Text>
                          </div>
                        )}
                      </div>
                    </Container>
                  </div>
                  {selectedEvaluation && (
                    <EvaluationDetail evaluation={selectedEvaluation} />
                  )}
                </div>
              </Container>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const RequestTable = ({
  requests,
  selectedRequestId,
  onSelect,
  compact = false,
}: {
  requests: any[];
  selectedRequestId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}) => {
  if (!requests.length) {
    return (
      <div className="p-6">
        <EmptyState title="No requests" body="Create a request or reset demo data to populate the queue." />
      </div>
    );
  }

  return (
    <TableScroll>
      <Table>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Request</Table.HeaderCell>
          {!compact && <Table.HeaderCell>Vendor</Table.HeaderCell>}
          <Table.HeaderCell>Decision</Table.HeaderCell>
          {!compact && <Table.HeaderCell>Status</Table.HeaderCell>}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {requests.map(request => (
          <Table.Row
            key={request.id}
            className={selectedRequestId === request.id ? "bg-ui-bg-highlight" : "cursor-pointer"}
            onClick={() => onSelect(request.id)}
          >
            <Table.Cell>
              <button className="block text-left" onClick={() => onSelect(request.id)}>
                <Text size="small" weight="plus">
                  {request.title}
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted">
                  {formatDate(request.createdAt)}
                </Text>
              </button>
            </Table.Cell>
            {!compact && <Table.Cell>{request.vendorName}</Table.Cell>}
            <Table.Cell>
              <DecisionBadge value={request.effectiveDecision ?? request.decision} />
            </Table.Cell>
            {!compact && (
              <Table.Cell>
                <StatusPill value={request.status} />
              </Table.Cell>
            )}
          </Table.Row>
        ))}
      </Table.Body>
      </Table>
    </TableScroll>
  );
};

const ActivityLists = ({ request }: { request: any }) => (
  <div className="mt-6 grid gap-4 lg:grid-cols-2">
    <Container className="p-0">
      <div className="border-b border-ui-border-base px-4 py-3">
        <Text weight="plus">Comments</Text>
      </div>
      <div className="divide-y divide-ui-border-base">
        {(request?.comments ?? []).map((comment: any) => (
          <div key={comment.id} className="px-4 py-3">
            <Text size="small" weight="plus">
              {comment.author?.name} <Badge size="2xsmall">{comment.visibility}</Badge>
            </Text>
            <Text size="small" className="mt-1 text-ui-fg-subtle">
              {comment.body}
            </Text>
          </div>
        ))}
        {(request?.comments ?? []).length === 0 && (
          <div className="p-4">
            <Text size="small" className="text-ui-fg-subtle">
              No comments yet.
            </Text>
          </div>
        )}
      </div>
    </Container>
    <Container className="p-0">
      <div className="border-b border-ui-border-base px-4 py-3">
        <Text weight="plus">Attachments</Text>
      </div>
      <div className="divide-y divide-ui-border-base">
        {(request?.attachments ?? []).map((attachment: any) => (
          <div key={attachment.id} className="flex items-center justify-between gap-x-3 px-4 py-3">
            <div>
              <Text size="small" weight="plus">
                {attachment.fileName}
              </Text>
              <Text size="xsmall" className="text-ui-fg-muted">
                {attachment.attachmentType}
              </Text>
            </div>
            {attachment.storageKey && !attachment.storageKey.startsWith("metadata:") ? (
              <Button
                variant="transparent"
                size="small"
                onClick={async () => {
                  try {
                    const data = await fetcher(`/api/upload/download-url?key=${encodeURIComponent(attachment.storageKey)}`);
                    window.open(data.downloadUrl, "_blank");
                  } catch {
                    toast.error("Could not generate download link");
                  }
                }}
              >
                <PaperClip className="h-4 w-4" />
                Download
              </Button>
            ) : (
              <PaperClip className="h-4 w-4 text-ui-fg-muted" />
            )}
          </div>
        ))}
        {(request?.attachments ?? []).length === 0 && (
          <div className="p-4">
            <Text size="small" className="text-ui-fg-subtle">
              No attachments yet.
            </Text>
          </div>
        )}
      </div>
    </Container>
  </div>
);

const CheckMiniSafe = () => <BadgeCheck className="h-4 w-4 shrink-0 text-ui-fg-interactive" />;

export default Home;
