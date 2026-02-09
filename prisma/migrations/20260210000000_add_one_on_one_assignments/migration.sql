-- Add 1:1 assignment fields to StaffAssignment
ALTER TABLE "StaffAssignment" ADD COLUMN "is1on1" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StaffAssignment" ADD COLUMN "studentName" TEXT;

-- Create partial index for efficient 1:1 queries
CREATE INDEX "StaffAssignment_is1on1_idx" ON "StaffAssignment"("is1on1") WHERE "is1on1" = true;

-- Add check constraint: studentName required when is1on1=true
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_studentName_check"
    CHECK ("is1on1" = false OR "studentName" IS NOT NULL);
