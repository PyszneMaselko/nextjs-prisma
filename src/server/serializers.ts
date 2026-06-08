export const serializeDate = (value?: Date | string | null) => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
};

export const serializeRequest = (request: any) => {
  const latestEvaluation = request.evaluations?.[0] ?? null;
  const latestOverride = request.manualOverrides?.[0] ?? null;

  return {
    ...request,
    annualCost: Number(request.annualCost),
    createdAt: serializeDate(request.createdAt),
    updatedAt: serializeDate(request.updatedAt),
    effectiveDecision: latestOverride?.newDecision ?? request.decision,
    latestEvaluation: latestEvaluation
      ? {
          ...latestEvaluation,
          evaluatedAt: serializeDate(latestEvaluation.evaluatedAt),
        }
      : null,
    evaluations: request.evaluations?.map((evaluation: any) => ({
      ...evaluation,
      evaluatedAt: serializeDate(evaluation.evaluatedAt),
    })),
    comments: request.comments?.map((comment: any) => ({
      ...comment,
      createdAt: serializeDate(comment.createdAt),
    })),
    attachments: request.attachments?.map((attachment: any) => ({
      ...attachment,
      createdAt: serializeDate(attachment.createdAt),
    })),
    manualOverrides: request.manualOverrides?.map((override: any) => ({
      ...override,
      createdAt: serializeDate(override.createdAt),
    })),
  };
};

export const serializePolicy = (policy: any) => ({
  ...policy,
  createdAt: serializeDate(policy.createdAt),
  updatedAt: serializeDate(policy.updatedAt),
  versions: policy.versions?.map((version: any) => ({
    ...version,
    createdAt: serializeDate(version.createdAt),
    effectiveFrom: serializeDate(version.effectiveFrom),
    effectiveTo: serializeDate(version.effectiveTo),
  })),
});
