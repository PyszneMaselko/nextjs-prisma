const requestAuditRoles = ["REVIEWER", "AUDITOR", "POLICY_OWNER", "ADMIN"];

export const canReadRequest = (
  roleCodes: string[],
  actorId: string,
  requesterId: string,
) =>
  roleCodes.some(role => requestAuditRoles.includes(role)) ||
  (roleCodes.includes("REQUESTER") && actorId === requesterId);

export const canModifyRequestFiles = (
  roleCodes: string[],
  actorId: string,
  requesterId: string,
) =>
  roleCodes.some(role => ["REVIEWER", "ADMIN"].includes(role)) ||
  (roleCodes.includes("REQUESTER") && actorId === requesterId);

export const canViewInternalComments = (roleCodes: string[]) =>
  roleCodes.some(role => requestAuditRoles.includes(role));

export const canListRequests = (roleCodes: string[]) =>
  roleCodes.some(role => role === "REQUESTER" || requestAuditRoles.includes(role));

export const hideInternalComments = <T extends { comments?: any[] }>(
  request: T,
  roleCodes: string[],
) => {
  if (canViewInternalComments(roleCodes) || !request.comments) return request;
  return {
    ...request,
    comments: request.comments.filter(comment => comment.visibility === "PUBLIC"),
  };
};
