-- Backfill any missing jobTitleId based on matching job title in the same school
UPDATE "Employee" AS e
SET "jobTitleId" = jt."id"
FROM "JobTitle" AS jt
WHERE jt."schoolId" = e."schoolId"
  AND e."jobTitleId" IS NULL
  AND LOWER(TRIM(jt."title")) = LOWER(TRIM(e."jobTitle"));

-- Reassign Staff titles to a non-Staff job title per school
WITH fallback AS (
  SELECT DISTINCT ON (jt."schoolId")
    jt."schoolId",
    jt."id",
    jt."title"
  FROM "JobTitle" jt
  WHERE LOWER(TRIM(jt."title")) <> 'staff'
  ORDER BY jt."schoolId", jt."title"
)
UPDATE "Employee" AS e
SET
  "jobTitleId" = fallback."id",
  "jobTitle" = fallback."title"
FROM fallback
WHERE fallback."schoolId" = e."schoolId"
  AND (e."jobTitleId" IS NULL OR LOWER(TRIM(e."jobTitle")) = 'staff');

-- Remove Staff job titles from the catalog
DELETE FROM "JobTitle" WHERE LOWER(TRIM("title")) = 'staff';

-- Enforce NOT NULL on jobTitleId
ALTER TABLE "Employee" ALTER COLUMN "jobTitleId" SET NOT NULL;
