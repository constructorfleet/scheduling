-- CreateTable
CREATE TABLE "ScheduleTypeTimeWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleTypeId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "ratioAdults" INTEGER NOT NULL,
    "ratioStudents" INTEGER NOT NULL,
    CONSTRAINT "ScheduleTypeTimeWindow_scheduleTypeId_fkey" FOREIGN KEY ("scheduleTypeId") REFERENCES "ScheduleType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ScheduleTypeTimeWindow_scheduleTypeId_idx" ON "ScheduleTypeTimeWindow"("scheduleTypeId");
