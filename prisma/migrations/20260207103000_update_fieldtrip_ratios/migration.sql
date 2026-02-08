-- Add replacement ratio columns
ALTER TABLE "FieldTripType" ADD COLUMN "adultRatioAdults" INTEGER;
ALTER TABLE "FieldTripType" ADD COLUMN "adultRatioStudents" INTEGER;
ALTER TABLE "FieldTripType" ADD COLUMN "leaderRatioAdults" INTEGER;
ALTER TABLE "FieldTripType" ADD COLUMN "leaderRatioStudents" INTEGER;

-- Migrate float ratios into integer ratio pairs.
UPDATE "FieldTripType"
SET
  "adultRatioAdults" = CASE
    WHEN "minAdultStudentRatio" = 0 THEN 0
    ELSE 1
  END,
  "adultRatioStudents" = CASE
    WHEN "minAdultStudentRatio" = 0 THEN 0
    WHEN "minAdultStudentRatio" >= 1 THEN ROUND("minAdultStudentRatio")::INTEGER
    ELSE ROUND(1.0 / "minAdultStudentRatio")::INTEGER
  END,
  "leaderRatioAdults" = CASE
    WHEN "minLeaderStudentRatio" = 0 THEN 0
    ELSE 1
  END,
  "leaderRatioStudents" = CASE
    WHEN "minLeaderStudentRatio" = 0 THEN 0
    WHEN "minLeaderStudentRatio" >= 1 THEN ROUND("minLeaderStudentRatio")::INTEGER
    ELSE ROUND(1.0 / "minLeaderStudentRatio")::INTEGER
  END;

ALTER TABLE "FieldTripType" ALTER COLUMN "adultRatioAdults" SET NOT NULL;
ALTER TABLE "FieldTripType" ALTER COLUMN "adultRatioStudents" SET NOT NULL;
ALTER TABLE "FieldTripType" ALTER COLUMN "leaderRatioAdults" SET NOT NULL;
ALTER TABLE "FieldTripType" ALTER COLUMN "leaderRatioStudents" SET NOT NULL;

ALTER TABLE "FieldTripType" DROP COLUMN "minAdultStudentRatio";
ALTER TABLE "FieldTripType" DROP COLUMN "minLeaderStudentRatio";
