-- Draft and review versions remain unnumbered until they are published.
ALTER TABLE "PolicyVersion"
ALTER COLUMN "versionNumber" DROP NOT NULL;

ALTER TABLE "PolicyVersion"
ADD COLUMN "approvedById" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3);

UPDATE "PolicyVersion"
SET "versionNumber" = NULL
WHERE "status" IN ('DRAFT', 'IN_REVIEW');

UPDATE "PolicyVersion"
SET "approvedAt" = COALESCE("effectiveFrom", "createdAt")
WHERE "status" IN ('PUBLISHED', 'ARCHIVED');

CREATE INDEX "PolicyVersion_approvedById_idx" ON "PolicyVersion"("approvedById");

ALTER TABLE "PolicyVersion"
ADD CONSTRAINT "PolicyVersion_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
