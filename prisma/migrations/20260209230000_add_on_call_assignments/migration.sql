-- Add isOnCall column to StaffAssignment
ALTER TABLE "StaffAssignment" ADD COLUMN "isOnCall" BOOLEAN NOT NULL DEFAULT false;

-- Create partial index for efficient on-call queries
CREATE INDEX "StaffAssignment_isOnCall_idx" ON "StaffAssignment"("isOnCall") WHERE "isOnCall" = true;
