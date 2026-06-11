import { z } from "zod";
import { conditionSchema, ruleEffectSchema } from "../domain/policy/types";

export const requestInputSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3),
  type: z.enum([
    "NEW_VENDOR",
    "NEW_SOFTWARE",
    "SOFTWARE_RENEWAL",
    "CONSULTING_SERVICE",
    "HARDWARE_PURCHASE",
    "EXCEPTION_REQUEST",
  ]),
  category: z.enum([
    "SAAS",
    "HARDWARE",
    "CONSULTING",
    "MARKETING_SERVICE",
    "CLOUD_SERVICE",
    "DATA_PROVIDER",
    "OTHER",
  ]),
  annualCost: z.coerce.number().nonnegative(),
  currency: z.enum(["EUR", "PLN", "USD", "GBP"]),
  vendorName: z.string().min(2),
  vendorCountry: z.string().min(2).max(3),
  department: z.enum([
    "MARKETING",
    "ENGINEERING",
    "FINANCE",
    "PROCUREMENT",
    "SECURITY",
    "LEGAL",
    "HR",
    "OPERATIONS",
  ]),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "EMERGENCY"]),
  justification: z.string().min(3),
  processesPersonalData: z.coerce.boolean(),
  dataCategories: z.array(z.string()).default([]),
  dataClassification: z
    .enum(["NONE", "PUBLIC", "INTERNAL", "CONFIDENTIAL", "PERSONAL_DATA", "SENSITIVE_PERSONAL_DATA"])
    .default("NONE"),
  hasDpa: z.coerce.boolean().optional(),
  transfersOutsideEea: z.coerce.boolean().default(false),
  requiresSecurityQuestionnaire: z.coerce.boolean().default(false),
  vendorRisk: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]).default("UNKNOWN"),
  requesterId: z.string().min(1),
  businessOwnerId: z.string().min(1),
  budgetOwnerId: z.string().optional().nullable(),
  dpaDocument: z.string().optional().default(""),
  emergencyJustification: z.string().optional().default(""),
});

export const createRequestSchema = requestInputSchema.extend({
  mode: z.enum(["draft", "submit"]).default("submit"),
});

export const updateRequestSchema = requestInputSchema.partial().extend({
  mode: z.enum(["draft", "submit"]).optional(),
});

export const commentSchema = z.object({
  authorId: z.string().min(1),
  visibility: z.enum(["PUBLIC", "INTERNAL"]).default("PUBLIC"),
  body: z.string().min(1),
});

export const attachmentSchema = z.object({
  uploadedById: z.string().min(1),
  attachmentType: z
    .enum(["DPA", "CONTRACT", "OFFER", "APPROVAL_MAIL", "SECURITY_QUESTIONNAIRE", "VENDOR_ASSESSMENT", "OTHER"])
    .default("OTHER"),
  fileName: z.string().min(1),
  mimeType: z.string().min(1).default("application/octet-stream"),
  sizeBytes: z.coerce.number().int().nonnegative(),
  storageKey: z.string().optional(),
});

export const manualOverrideSchema = z.object({
  createdById: z.string().min(1),
  approverId: z.string().min(1),
  newDecision: z.enum(["APPROVED", "REQUIRES_REVIEW", "REJECTED", "MISSING_INFORMATION"]),
  // When true the approval is recorded as a documented exception (status APPROVED_WITH_EXCEPTION,
  // UC-9). A plain reviewer decision (UC-3) leaves it false.
  exception: z.coerce.boolean().optional().default(false),
  reason: z.string().min(3),
  comment: z.string().min(3),
  attachmentName: z.string().optional(),
});

export const ruleCreateSchema = z.object({
  policyVersionId: z.string().min(1),
  name: z.string().min(3),
  description: z.string().min(3),
  severity: z.enum(["INFO", "WARNING", "BLOCKER"]).default("WARNING"),
  condition: conditionSchema,
  effects: z.array(ruleEffectSchema).min(1),
  reason: z.string().min(3),
  enabled: z.boolean().default(true),
  priority: z.coerce.number().int().default(100),
});

export const ruleUpdateSchema = ruleCreateSchema.omit({ policyVersionId: true });

const draftRuleTestSchema = ruleCreateSchema.omit({ policyVersionId: true }).extend({
  name: z.string().min(1).default("Test rule"),
  description: z.string().min(1).default("Temporary rule tested in the rule console."),
  reason: z.string().min(1).default("The temporary test rule matched."),
});

export const policyCreateSchema = z.object({
  ownerId: z.string().min(1),
  name: z.string().min(3),
  description: z.string().min(3),
  domain: z.enum(["PROCUREMENT", "VENDOR_RISK", "DATA_SECURITY", "FINANCE"]),
  changeSummary: z.string().min(3),
});

export const ruleTestSchema = z.object({
  input: requestInputSchema.partial().passthrough(),
  draftRule: draftRuleTestSchema.optional(),
  policyVersionId: z.string().min(1).optional(),
}).refine(input => !(input.draftRule && input.policyVersionId), {
  message: "Test either one draft rule or one saved policy version, not both.",
});
