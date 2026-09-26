ALTER TABLE "Team" ADD COLUMN "noyraWorkspaceId" TEXT;

CREATE UNIQUE INDEX "Team_noyraWorkspaceId_key" ON "Team"("noyraWorkspaceId");

ALTER TABLE "Email" ADD COLUMN "sentAt" TIMESTAMP(3);

UPDATE "Email" AS email
SET "sentAt" = first_sent."sentAt"
FROM (
  SELECT "emailId", MIN("createdAt") AS "sentAt"
  FROM "EmailEvent"
  WHERE "status" = 'SENT'
  GROUP BY "emailId"
) AS first_sent
WHERE email."id" = first_sent."emailId";

CREATE INDEX "Email_teamId_sentAt_idx" ON "Email"("teamId", "sentAt");
