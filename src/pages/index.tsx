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
} from "@medusajs/icons";
import { NextPage } from "next";
import Head from "next/head";
import { FormEvent, useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { demoRequestInput } from "../domain/policy/demoData";

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
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
};

const decisionLabels: Record<string, string> = {
  APPROVED: "Approved",
  REQUIRES_REVIEW: "Requires review",
  REJECTED: "Rejected",
  MISSING_INFORMATION: "Missing information",
};

const overrideDefaults: Record<string, { reason: string; comment: string }> = {
  APPROVED: {
    reason: "Business exception approved for this request.",
    comment: "Reviewer accepts the risk with compensating control.",
  },
  REQUIRES_REVIEW: {
    reason: "Additional review is required before a final decision can be made.",
    comment: "Escalating to the reviewer for further assessment of the outstanding concerns.",
  },
  REJECTED: {
    reason: "The request does not meet policy requirements and cannot be approved.",
    comment: "Reviewer rejects the request based on the identified policy violations.",
  },
  MISSING_INFORMATION: {
    reason: "Required information is missing and must be provided before a decision can be made.",
    comment: "Requesting additional details from the requester to complete the review.",
  },
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

const emptyRequestForm = {
  ...demoRequestInput,
  dataCategories: demoRequestInput.dataCategories.join(", "),
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
    roles: ["REQUESTER", "REVIEWER", "POLICY_OWNER", "POLICY_APPROVER", "AUDITOR", "ADMIN"],
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

const toRequestPayload = (form: any, mode: "draft" | "submit") => ({
  ...form,
  mode,
  annualCost: Number(form.annualCost),
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

const formatDate = (value?: string | null) => {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const SelectField = ({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select",
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
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
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
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-x-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2">
    <Label size="small" weight="plus">
      {label}
    </Label>
    <Switch checked={checked} onCheckedChange={value => onCheckedChange(Boolean(value))} />
  </div>
);

const DecisionBadge = ({ value }: { value?: string | null }) => (
  <StatusBadge color={decisionColor(value) as any}>{value ? decisionLabels[value] ?? value : "No decision"}</StatusBadge>
);

const StatusPill = ({ value }: { value?: string | null }) => (
  <StatusBadge color={statusColor(value) as any}>{value ? statusLabels[value] ?? value : "No status"}</StatusBadge>
);

const PolicyStatusPill = ({ value }: { value?: string | null }) => (
  <StatusBadge color={policyStatusColor(value) as any}>{value ? policyStatusLabels[value] ?? value : "No status"}</StatusBadge>
);

const ConditionRow = ({ condition }: { condition: any }) => (
  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
    <Badge size="2xsmall">{fieldLabels[condition?.field] ?? condition?.field}</Badge>
    <Text size="small" className="text-ui-fg-subtle">
      {operatorLabels[condition?.operator] ?? condition?.operator}
    </Text>
    {condition?.value !== undefined && condition?.value !== "" && (
      <Badge size="2xsmall" color="blue">
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
            <Badge size="2xsmall" color={effectTypeColor(effect?.type) as any}>
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
      <div className="flex items-center justify-between gap-x-3">
        <Text weight="plus" size="small">{rule.name}</Text>
        <Badge size="2xsmall">{rule.severity}</Badge>
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
                    <Text weight="plus">Version {version.versionNumber}</Text>
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
  <div className="flex flex-col justify-between gap-3 border-b border-ui-border-base px-6 py-5 md:flex-row md:items-center">
    <div>
      <Heading level="h2">{title}</Heading>
      {description && (
        <Text size="small" className="mt-1 text-ui-fg-subtle">
          {description}
        </Text>
      )}
    </div>
    {action}
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
            <Text weight="plus" className="mt-1">
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
                  <Badge key={field.field} color="orange">
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
                  <Badge key={approver} color="blue">
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
                  <Badge key={policy.policyVersionId} color="purple">
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
  const [requestForm, setRequestForm] = useState<any>(emptyRequestForm);
  const [filters, setFilters] = useState({ search: "__ALL__", status: "__ALL__", decision: "__ALL__", category: "__ALL__" });
  const [commentBody, setCommentBody] = useState("");
  const [commentVisibility, setCommentVisibility] = useState("PUBLIC");
  const [attachmentType, setAttachmentType] = useState("DPA");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [overrideForm, setOverrideForm] = useState({
    newDecision: "APPROVED",
    reason: "Business exception approved for this request.",
    comment: "Reviewer accepts the risk with compensating control.",
    approverId: "user-policy-owner",
    attachmentName: "",
  });
  const [policyForm, setPolicyForm] = useState({
    name: "Polityka testowa",
    description: "Nowa polityka robocza do demonstracji kreatora reguł.",
    domain: "PROCUREMENT",
    changeSummary: "Pierwsza wersja polityki testowej.",
    publish: false,
  });
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [selectedApprovalVersionId, setSelectedApprovalVersionId] = useState("");
  const [rejectForm, setRejectForm] = useState({
    reason: "Próg kosztowy wymaga dodatkowego uzasadnienia biznesowego przed publikacją.",
  });
  const [ruleRows, setRuleRows] = useState([{ field: "annualCost", operator: "greater_than", value: "10000" }]);
  const [ruleForm, setRuleForm] = useState({
    name: "Koszt powyżej 10 000 EUR wymaga review",
    description: "Przykładowa reguła utworzona w kreatorze.",
    severity: "WARNING",
    effectType: "REQUIRE_REVIEW",
    approver: "Procurement",
    field: "",
    label: "",
    reason: "Wniosek przekracza próg kosztowy polityki testowej.",
    priority: 90,
  });
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
    return `/api/requests?${params.toString()}`;
  }, [filters]);

  const { data: bootstrap } = useSWR("/api/bootstrap", fetcher);
  const { data: dashboard } = useSWR("/api/dashboard", fetcher);
  const { data: requestList } = useSWR(listQuery, fetcher);
  const { data: policiesData } = useSWR("/api/policies", fetcher);
  const { data: selectedRequestData } = useSWR(selectedRequestId ? `/api/requests/${selectedRequestId}` : null, fetcher);

  const users = bootstrap?.users ?? [];
  const dictionaries = bootstrap?.dictionaries ?? {};
  const requests = requestList?.requests ?? [];
  const policies = policiesData?.policies ?? [];
  const selectedRequest = selectedRequestData?.request;
  const selectedActor = users.find((user: any) => user.id === actorId);
  const actorRoles = selectedActor?.roleAssignments?.map((item: any) => item.role.code) ?? ["REQUESTER"];
  const availableScreens = screenCatalog.filter(screen => screen.roles.some(role => actorRoles.includes(role)));
  const selectedEvaluation = selectedRequest?.latestEvaluation ?? selectedRequest?.evaluations?.[0];
  const selectedResult = selectedEvaluation?.resultSnapshot;
  const versions = policies.flatMap((policy: any) =>
    (policy.versions ?? []).map((version: any) => ({ ...version, policy })),
  );
  const pendingApprovalVersions = versions.filter((version: any) => version.status === "IN_REVIEW");
  const selectedApprovalVersion = pendingApprovalVersions.find((version: any) => version.id === selectedApprovalVersionId);
  const selectedPolicyDetail = policies.find((policy: any) => policy.id === selectedPolicyId);

  useEffect(() => {
    if (!selectedRequestId && requests[0]) setSelectedRequestId(requests[0].id);
  }, [requests, selectedRequestId]);

  useEffect(() => {
    if (!availableScreens.some(screen => screen.id === activeScreen)) {
      setActiveScreen(availableScreens[0]?.id ?? "dashboard");
    }
  }, [activeScreen, availableScreens]);

  useEffect(() => {
    const draft = versions.find((version: any) => ["DRAFT", "IN_REVIEW"].includes(version.status));
    if (!selectedVersionId && draft) setSelectedVersionId(draft.id);
  }, [selectedVersionId, versions]);

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

  const submitRequest = (mode: "draft" | "submit") =>
    runAction(async () => {
      const payload = toRequestPayload({ ...requestForm, requesterId: actorId }, mode);
      const data = await postJson("/api/requests", payload);
      setSelectedRequestId(data.request.id);
      setActiveScreen("requester");
    }, mode === "draft" ? "Draft saved" : "Request submitted and evaluated");

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

  const addAttachment = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRequestId || !attachmentFile) return;
    return runAction(async () => {
      await postJson(`/api/requests/${selectedRequestId}/attachments`, {
        uploadedById: actorId,
        attachmentType,
        fileName: attachmentFile.name,
        mimeType: attachmentFile.type || "application/octet-stream",
        sizeBytes: attachmentFile.size,
      });
      setAttachmentFile(null);
    }, "Attachment metadata added");
  };

  const addOverride = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRequestId) return;
    return runAction(async () => {
      await postJson(`/api/requests/${selectedRequestId}/overrides`, {
        ...overrideForm,
        createdById: actorId,
      });
    }, "Manual override recorded");
  };

  const createPolicy = (event: FormEvent) => {
    event.preventDefault();
    return runAction(async () => {
      const data = await postJson("/api/policies", {
        ...policyForm,
        ownerId: actorId,
      });
      setSelectedVersionId(data.policy.versions?.[0]?.id ?? "");
    }, "Policy version created");
  };

  const buildCondition = () => {
    const conditions = ruleRows.map(row => ({
      field: row.field,
      operator: row.operator,
      value: ["is_empty", "is_not_empty"].includes(row.operator) ? undefined : parseRuleValue(row.value),
    }));
    return conditions.length === 1 ? conditions[0] : { combinator: "ALL", conditions };
  };

  const buildEffects = () => [
    {
      type: ruleForm.effectType,
      approver: ruleForm.approver || undefined,
      field: ruleForm.field || undefined,
      label: ruleForm.label || undefined,
    },
  ];

  const createRule = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedVersionId) return;
    return runAction(async () => {
      await postJson("/api/rules", {
        policyVersionId: selectedVersionId,
        name: ruleForm.name,
        description: ruleForm.description,
        severity: ruleForm.severity,
        condition: buildCondition(),
        effects: buildEffects(),
        reason: ruleForm.reason,
        enabled: true,
        priority: Number(ruleForm.priority),
      });
    }, "Rule added to draft version");
  };

  const submitVersionForApproval = () =>
    runAction(async () => {
      const version = versions.find((item: any) => item.id === selectedVersionId);
      if (!version) throw new Error("Choose a policy version first");
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

  const runRuleTest = (includeDraftRule: boolean) =>
    runAction(async () => {
      const payload: any = {
        input: {
          ...testInput,
          annualCost: Number(testInput.annualCost),
        },
      };
      if (includeDraftRule) {
        payload.draftRule = {
          name: ruleForm.name,
          description: ruleForm.description,
          severity: ruleForm.severity,
          condition: buildCondition(),
          effects: buildEffects(),
          reason: ruleForm.reason,
          enabled: true,
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
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
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

      <main className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[92px] lg:h-[calc(100dvh-112px)]">
          <Container className="overflow-hidden p-0">
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
          </Container>
        </aside>

        <div className="min-w-0 space-y-4">
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
                  title="Submit purchase request"
                  description="Requester widzi tylko intake, wynik i uzupełnienie braków."
                  action={
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => submitRequest("draft")}>
                        Save draft
                      </Button>
                      <Button onClick={() => submitRequest("submit")}>
                        <FilePlus className="h-4 w-4" />
                        Submit
                      </Button>
                    </div>
                  }
                />
                <div className="grid gap-4 p-6 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <TextField label="Title" value={requestForm.title} onChange={value => updateFormField("title", value)} />
                  </div>
                  <div className="md:col-span-2">
                    <TextareaField label="Description" value={requestForm.description} onChange={value => updateFormField("description", value)} />
                  </div>
                  <SelectField label="Type" value={requestForm.type} onValueChange={value => updateFormField("type", value)} options={options(dictionaries.requestTypes)} />
                  <SelectField label="Category" value={requestForm.category} onValueChange={value => updateFormField("category", value)} options={options(dictionaries.categories)} />
                  <TextField label="Annual cost" type="number" value={requestForm.annualCost} onChange={value => updateFormField("annualCost", value)} />
                  <SelectField label="Currency" value={requestForm.currency} onValueChange={value => updateFormField("currency", value)} options={options(dictionaries.currencies)} />
                  <TextField label="Vendor" value={requestForm.vendorName} onChange={value => updateFormField("vendorName", value)} />
                  <TextField label="Vendor country" value={requestForm.vendorCountry} onChange={value => updateFormField("vendorCountry", value.toUpperCase())} />
                  <SelectField label="Department" value={requestForm.department} onValueChange={value => updateFormField("department", value)} options={options(dictionaries.departments)} />
                  <SelectField label="Urgency" value={requestForm.urgency} onValueChange={value => updateFormField("urgency", value)} options={options(dictionaries.urgency)} />
                  <SelectField label="Business owner" value={requestForm.businessOwnerId} onValueChange={value => updateFormField("businessOwnerId", value)} options={userOptions()} />
                  <SelectField
                    label="Budget owner"
                    value={requestForm.budgetOwnerId ?? "__NONE__"}
                    onValueChange={value => updateFormField("budgetOwnerId", value === "__NONE__" ? "" : value)}
                    options={userOptions(true)}
                  />
                  <SwitchField label="Processes personal data" checked={requestForm.processesPersonalData} onCheckedChange={value => updateFormField("processesPersonalData", value)} />
                  <SwitchField label="Has DPA" checked={requestForm.hasDpa} onCheckedChange={value => updateFormField("hasDpa", value)} />
                  {requestForm.processesPersonalData && (
                    <>
                      <TextField label="Data categories" value={requestForm.dataCategories} onChange={value => updateFormField("dataCategories", value)} />
                      <SelectField
                        label="Data classification"
                        value={requestForm.dataClassification}
                        onValueChange={value => updateFormField("dataClassification", value)}
                        options={options(["PERSONAL_DATA", "SENSITIVE_PERSONAL_DATA", "CONFIDENTIAL", "INTERNAL", "PUBLIC", "NONE"])}
                      />
                      <SwitchField label="Transfers outside EEA" checked={requestForm.transfersOutsideEea} onCheckedChange={value => updateFormField("transfersOutsideEea", value)} />
                      <SwitchField label="Security questionnaire needed" checked={requestForm.requiresSecurityQuestionnaire} onCheckedChange={value => updateFormField("requiresSecurityQuestionnaire", value)} />
                    </>
                  )}
                  <SelectField label="Vendor risk" value={requestForm.vendorRisk} onValueChange={value => updateFormField("vendorRisk", value)} options={options(dictionaries.vendorRisks)} />
                  <div className="md:col-span-2">
                    <TextareaField label="Business justification" value={requestForm.justification} onChange={value => updateFormField("justification", value)} />
                  </div>
                </div>
              </Container>

              <div className="space-y-4">
                <Container className="p-0">
                  <SectionHeader title="My requests" description="Lista jest oddzielona od formularza, żeby łatwo wrócić do wyniku." />
                  <RequestTable requests={requests} selectedRequestId={selectedRequestId} onSelect={setSelectedRequestId} />
                </Container>
                <Container className="p-6">
                  <RequestSummary request={selectedRequest} compact />
                  {selectedResult?.missingFields?.length > 0 && (
                    <form className="mt-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4" onSubmit={addAttachment}>
                      <Text weight="plus">Add missing attachment</Text>
                      <Text size="small" className="mt-1 text-ui-fg-subtle">
                        For the demo, adding a DPA attachment metadata re-evaluates the request.
                      </Text>
                      <div className="mt-4 grid gap-3">
                        <SelectField label="Type" value={attachmentType} onValueChange={setAttachmentType} options={options(["DPA", "CONTRACT", "OFFER", "APPROVAL_MAIL", "SECURITY_QUESTIONNAIRE", "VENDOR_ASSESSMENT", "OTHER"])} />
                        <Input type="file" onChange={event => setAttachmentFile(event.target.files?.[0] ?? null)} />
                        <Button type="submit" variant="secondary">
                          <PaperClip className="h-4 w-4" />
                          Add metadata
                        </Button>
                      </div>
                    </form>
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
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Status" value={filters.status} onValueChange={value => setFilters(current => ({ ...current, status: value }))} options={options(Object.keys(statusLabels), true)} />
                    <SelectField label="Decision" value={filters.decision} onValueChange={value => setFilters(current => ({ ...current, decision: value }))} options={options(Object.keys(decisionLabels), true)} />
                  </div>
                </div>
                <RequestTable requests={requests} selectedRequestId={selectedRequestId} onSelect={setSelectedRequestId} compact />
              </Container>

              <Container className="p-0">
                <SectionHeader title="Review workspace" description="Ocena, komentarz, załącznik i manual override są teraz jednym przepływem." />
                <div className="p-6">
                  <Tabs defaultValue="decision">
                    <Tabs.List>
                      <Tabs.Trigger value="decision">Decision</Tabs.Trigger>
                      <Tabs.Trigger value="collaboration">Collaboration</Tabs.Trigger>
                      <Tabs.Trigger value="override">Override</Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="decision" className="pt-5">
                      <RequestSummary request={selectedRequest} />
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
                          <Text weight="plus">Add attachment metadata</Text>
                          <SelectField label="Type" value={attachmentType} onValueChange={setAttachmentType} options={options(["DPA", "CONTRACT", "OFFER", "APPROVAL_MAIL", "SECURITY_QUESTIONNAIRE", "VENDOR_ASSESSMENT", "OTHER"])} />
                          <Input type="file" onChange={event => setAttachmentFile(event.target.files?.[0] ?? null)} />
                          <Button type="submit" variant="secondary">
                            <PaperClip className="h-4 w-4" />
                            Add metadata
                          </Button>
                        </form>
                      </div>
                      <ActivityLists request={selectedRequest} />
                    </Tabs.Content>
                    <Tabs.Content value="override" className="pt-5">
                      <form onSubmit={addOverride} className="max-w-2xl space-y-4">
                        <InlineTip label="Manual override is audited" variant="warning">
                          The original system decision stays intact. The manual decision is stored as a separate audit entry.
                        </InlineTip>
                        <SelectField label="New decision" value={overrideForm.newDecision} onValueChange={value => setOverrideForm(current => ({ ...current, newDecision: value, reason: overrideDefaults[value]?.reason ?? current.reason, comment: overrideDefaults[value]?.comment ?? current.comment }))} options={options(Object.keys(decisionLabels))} />
                        <SelectField label="Exception approver" value={overrideForm.approverId} onValueChange={value => setOverrideForm(current => ({ ...current, approverId: value }))} options={userOptions()} />
                        <TextField label="Reason" value={overrideForm.reason} onChange={value => setOverrideForm(current => ({ ...current, reason: value }))} />
                        <TextareaField label="Comment" value={overrideForm.comment} onChange={value => setOverrideForm(current => ({ ...current, comment: value }))} />
                        <Button type="submit">
                          <PencilSquare className="h-4 w-4" />
                          Record override
                        </Button>
                      </form>
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
                      <SwitchField label="Publish immediately" checked={policyForm.publish} onCheckedChange={value => setPolicyForm(current => ({ ...current, publish: value }))} />
                      <Button type="submit" variant="secondary">
                        <Plus className="h-4 w-4" />
                        Create policy version
                      </Button>
                    </form>
                  </div>
                </Container>

                <Container className="overflow-hidden p-0">
                  <SectionHeader title="Policy registry" description="Opublikowana wersja jest używana przy nowych ocenach. Kliknij wiersz, aby zobaczyć szczegóły reguł." />
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Policy</Table.HeaderCell>
                        <Table.HeaderCell>Domain</Table.HeaderCell>
                        <Table.HeaderCell>Status</Table.HeaderCell>
                        <Table.HeaderCell>Versions</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {policies.map((policy: any) => (
                        <Table.Row key={policy.id} className="cursor-pointer" onClick={() => setSelectedPolicyId(policy.id)}>
                          <Table.Cell>{policy.name}</Table.Cell>
                          <Table.Cell>{policy.domain}</Table.Cell>
                          <Table.Cell><PolicyStatusPill value={policy.status} /></Table.Cell>
                          <Table.Cell>{policy.versions?.length ?? 0}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
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
                      onValueChange={value => setSelectedVersionId(value === "__NONE__" ? "" : value)}
                      options={[
                        { value: "__NONE__", label: "Choose draft version" },
                        ...versions.map((version: any) => ({
                          value: version.id,
                          label: `${version.policy.name} v${version.versionNumber} [${version.status}]`,
                        })),
                      ]}
                    />
                    <div className="space-y-3">
                      {ruleRows.map((row, index) => (
                        <div key={index} className="grid gap-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 md:grid-cols-3">
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
                          <TextField
                            label="Value"
                            value={row.value}
                            onChange={value => setRuleRows(current => current.map((item, i) => (i === index ? { ...item, value } : item)))}
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setRuleRows(current => [...current, { field: "category", operator: "equals", value: "SAAS" }])}
                      >
                        <Plus className="h-4 w-4" />
                        Add condition
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField label="Rule name" value={ruleForm.name} onChange={value => setRuleForm(current => ({ ...current, name: value }))} />
                      <SelectField label="Severity" value={ruleForm.severity} onValueChange={value => setRuleForm(current => ({ ...current, severity: value }))} options={options(["INFO", "WARNING", "BLOCKER"])} />
                      <SelectField label="Effect" value={ruleForm.effectType} onValueChange={value => setRuleForm(current => ({ ...current, effectType: value }))} options={options(["REQUIRE_REVIEW", "REQUIRE_FIELD", "REJECT", "APPROVE", "ADD_REASON_CODE", "ADD_RISK_POINTS"])} />
                      <TextField label="Approver" value={ruleForm.approver} onChange={value => setRuleForm(current => ({ ...current, approver: value }))} />
                      <TextField label="Required field" value={ruleForm.field} onChange={value => setRuleForm(current => ({ ...current, field: value }))} />
                      <TextField label="Field label" value={ruleForm.label} onChange={value => setRuleForm(current => ({ ...current, label: value }))} />
                      <div className="md:col-span-2">
                        <TextareaField label="Reason" value={ruleForm.reason} onChange={value => setRuleForm(current => ({ ...current, reason: value }))} />
                      </div>
                    </div>
                    <Button type="submit" variant="secondary">
                      <TablePen className="h-4 w-4" />
                      Save rule
                    </Button>
                  </form>
                </Container>

                <Container className="p-0">
                  <SectionHeader title="Rule console" description="Test aktywnych polityk albo pojedynczej reguły draftowej." />
                  <div className="space-y-5 p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField label="Annual cost" type="number" value={testInput.annualCost} onChange={value => setTestInput(current => ({ ...current, annualCost: value }))} />
                      <SelectField label="Category" value={testInput.category} onValueChange={value => setTestInput(current => ({ ...current, category: value }))} options={options(dictionaries.categories)} />
                      <SelectField label="Vendor risk" value={testInput.vendorRisk} onValueChange={value => setTestInput(current => ({ ...current, vendorRisk: value }))} options={options(dictionaries.vendorRisks)} />
                      <SwitchField label="Personal data" checked={testInput.processesPersonalData} onCheckedChange={value => setTestInput(current => ({ ...current, processesPersonalData: value }))} />
                      <SwitchField label="Has DPA" checked={testInput.hasDpa} onCheckedChange={value => setTestInput(current => ({ ...current, hasDpa: value }))} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => runRuleTest(false)}>
                        <Beaker className="h-4 w-4" />
                        Test active policies
                      </Button>
                      <Button onClick={() => runRuleTest(true)}>
                        <Beaker className="h-4 w-4" />
                        Test draft rule
                      </Button>
                    </div>
                    {testResult && (
                      <Container className="bg-ui-bg-subtle p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <Text weight="plus">Test result</Text>
                          <DecisionBadge value={testResult.decision} />
                        </div>
                        <div className="space-y-2">
                          {testResult.reasons.map((reason: string) => (
                            <Text key={reason} size="small">
                              {reason}
                            </Text>
                          ))}
                        </div>
                      </Container>
                    )}
                  </div>
                </Container>
              </div>
            </div>
          )}

          {activeScreen === "approvals" && (
            <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <Container className="p-0">
                <SectionHeader title="Pending approvals" description="Wersje przekazane przez Policy Ownera i czekające na decyzję." />
                {pendingApprovalVersions.length === 0 && (
                  <div className="p-6">
                    <EmptyState title="No versions awaiting approval" body="Policy Owner nie przekazał jeszcze żadnej wersji do publikacji." />
                  </div>
                )}
                {pendingApprovalVersions.length > 0 && (
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Policy</Table.HeaderCell>
                        <Table.HeaderCell>Version</Table.HeaderCell>
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
                          <Table.Cell>v{version.versionNumber}</Table.Cell>
                          <Table.Cell>{version.author?.name ?? "—"}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table>
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
                            {selectedApprovalVersion.policy.name} · v{selectedApprovalVersion.versionNumber}
                          </Text>
                          <Text size="small" className="text-ui-fg-subtle">
                            {selectedApprovalVersion.changeSummary}
                          </Text>
                        </div>
                        <PolicyStatusPill value={selectedApprovalVersion.status} />
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
                    <CodeBlock
                      className="rounded-lg"
                      snippets={[
                        {
                          label: "inputSnapshot",
                          language: "json",
                          code: JSON.stringify(selectedEvaluation.inputSnapshot, null, 2),
                          hideLineNumbers: true,
                        },
                        {
                          label: "resultSnapshot",
                          language: "json",
                          code: JSON.stringify(selectedEvaluation.resultSnapshot, null, 2),
                          hideLineNumbers: true,
                        },
                      ]}
                    >
                      <CodeBlock.Header />
                      <CodeBlock.Body />
                    </CodeBlock>
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
            <PaperClip className="h-4 w-4 text-ui-fg-muted" />
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
