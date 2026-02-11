-- Add school role settings catalog
CREATE TABLE "RoleSetting" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoleSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoleSetting_schoolId_name_key" ON "RoleSetting"("schoolId", "name");

ALTER TABLE "RoleSetting"
ADD CONSTRAINT "RoleSetting_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add optional role assignment on each staff block
ALTER TABLE "StaffAssignment"
ADD COLUMN "role" TEXT;

-- Add multi-role support on employees
ALTER TABLE "Employee"
ADD COLUMN "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill existing employees with empty roles arrays (represents "no roles")
UPDATE "Employee"
SET "roles" = ARRAY[]::TEXT[]
WHERE "roles" IS NULL;

ALTER TABLE "Employee"
ALTER COLUMN "roles" SET DEFAULT ARRAY[]::TEXT[];
