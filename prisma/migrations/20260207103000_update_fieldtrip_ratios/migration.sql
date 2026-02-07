-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Create a new FieldTripType table with the updated schema
CREATE TABLE "new_FieldTripType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adultRatioAdults" INTEGER NOT NULL,
    "adultRatioStudents" INTEGER NOT NULL,
    "leaderRatioAdults" INTEGER NOT NULL,
    "leaderRatioStudents" INTEGER NOT NULL,
    "policyCitationId" TEXT,
    "notes" TEXT,
    CONSTRAINT "FieldTripType_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate data from old table to new table
-- Convert Float ratios to integers: adultRatioAdults = 1, adultRatioStudents = 1 / minAdultStudentRatio
-- If minAdultStudentRatio is 0, set both to 0. Otherwise convert the decimal ratio.
INSERT INTO "new_FieldTripType" 
SELECT 
    "id",
    "schoolId",
    "name",
    CASE WHEN "minAdultStudentRatio" = 0 THEN 0 ELSE 1 END as "adultRatioAdults",
    CASE 
        WHEN "minAdultStudentRatio" = 0 THEN 0
        WHEN "minAdultStudentRatio" >= 1 THEN CAST(ROUND("minAdultStudentRatio") AS INTEGER)
        ELSE CAST(ROUND(1.0 / "minAdultStudentRatio") AS INTEGER)
    END as "adultRatioStudents",
    CASE WHEN "minLeaderStudentRatio" = 0 THEN 0 ELSE 1 END as "leaderRatioAdults",
    CASE 
        WHEN "minLeaderStudentRatio" = 0 THEN 0
        WHEN "minLeaderStudentRatio" >= 1 THEN CAST(ROUND("minLeaderStudentRatio") AS INTEGER)
        ELSE CAST(ROUND(1.0 / "minLeaderStudentRatio") AS INTEGER)
    END as "leaderRatioStudents",
    "policyCitationId",
    "notes"
FROM "FieldTripType";

-- Drop the old table
DROP TABLE "FieldTripType";

-- Rename the new table to the original name
ALTER TABLE "new_FieldTripType" RENAME TO "FieldTripType";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
