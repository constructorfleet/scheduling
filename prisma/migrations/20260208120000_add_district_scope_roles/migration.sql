-- CreateTable
CREATE TABLE "District" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Seed a default district for existing schools
INSERT INTO "District" ("id", "name", "createdAt", "updatedAt")
VALUES ('district-default', 'Default District', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- AlterTable: School and User
ALTER TABLE "School" ADD COLUMN "districtId" TEXT;
ALTER TABLE "User" ADD COLUMN "isSuperUser" BOOLEAN NOT NULL DEFAULT false;

UPDATE "School" SET "districtId" = 'district-default' WHERE "districtId" IS NULL;
ALTER TABLE "School" ALTER COLUMN "districtId" SET NOT NULL;

-- Foreign key for School -> District
ALTER TABLE "School"
  ADD CONSTRAINT "School_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "District"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Convert Role enum values.
CREATE TYPE "Role_new" AS ENUM ('super_user', 'district_admin', 'district_user', 'school_admin', 'school_user');

ALTER TABLE "SchoolMembership" ADD COLUMN "role_new" "Role_new";

UPDATE "SchoolMembership"
SET "role_new" = CASE "role"
  WHEN 'owner' THEN 'school_admin'::"Role_new"
  WHEN 'director' THEN 'school_admin'::"Role_new"
  WHEN 'scheduler' THEN 'school_user'::"Role_new"
  WHEN 'viewer' THEN 'school_user'::"Role_new"
  ELSE 'school_user'::"Role_new"
END;

ALTER TABLE "SchoolMembership" DROP COLUMN "role";
ALTER TABLE "SchoolMembership" RENAME COLUMN "role_new" TO "role";

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- CreateTable: DistrictMembership
CREATE TABLE "DistrictMembership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DistrictMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DistrictMembership_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DistrictMembership_userId_districtId_key"
  ON "DistrictMembership"("userId", "districtId");
