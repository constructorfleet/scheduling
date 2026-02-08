-- Add field trip window settings to schools
ALTER TABLE "School"
ADD COLUMN "fieldTripStartTime" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN "fieldTripEndTime" TEXT NOT NULL DEFAULT '15:00';