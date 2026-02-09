-- Add jobTitleId column to Employee
ALTER TABLE "Employee"
ADD COLUMN "jobTitleId" TEXT NULL;

-- Backfill jobTitleId based on matching job title in the same school
UPDATE "Employee" AS e
SET
    "jobTitleId" = jt."id"
FROM
    "JobTitle" AS jt
WHERE
    jt."schoolId" = e."schoolId"
    AND LOWER(TRIM(jt."title")) = LOWER(TRIM(e."jobTitle"));

-- Add foreign key constraint
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "JobTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Optional index for faster lookups
CREATE INDEX "Employee_jobTitleId_idx" ON "Employee" ("jobTitleId");