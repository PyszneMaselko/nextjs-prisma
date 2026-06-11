-- Dedicated roles so the request form can restrict the business/budget owner pickers
-- to users who actually hold those roles.
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'BUSINESS_OWNER';
ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'BUDGET_OWNER';
