ALTER TABLE "ManualOverride"
ADD COLUMN "isException" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ManualOverride"
SET "isException" = true
WHERE "newDecision" = 'APPROVED'
  AND "approverId" <> "createdById";
