-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "closedDays" JSONB NOT NULL,
    "openerCount" INTEGER NOT NULL,
    "closerCount" INTEGER NOT NULL,
    "minimumMedicalDelegated" INTEGER NOT NULL,
    "requireCurrentCpr" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScheduleType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ratioAdults" INTEGER NOT NULL,
    "ratioStudents" INTEGER NOT NULL,
    "description" TEXT,
    CONSTRAINT "ScheduleType_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobTitle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "leaderQualified" BOOLEAN NOT NULL,
    "requiresLeaderForOpenClose" BOOLEAN NOT NULL,
    CONSTRAINT "JobTitle_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "maxHoursPerDay" INTEGER NOT NULL,
    "maxHoursPerWeek" INTEGER NOT NULL,
    "employmentStatus" TEXT NOT NULL,
    "medicallyDelegated" BOOLEAN NOT NULL,
    "cprCurrent" BOOLEAN NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Employee_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperatingHours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "scheduleType" TEXT NOT NULL,
    "daysOfWeek" JSONB NOT NULL,
    "open" TEXT NOT NULL,
    "close" TEXT NOT NULL,
    CONSTRAINT "OperatingHours_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldTripType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAdultStudentRatio" REAL NOT NULL,
    "minLeaderStudentRatio" REAL NOT NULL,
    "policyCitationId" TEXT,
    "notes" TEXT,
    CONSTRAINT "FieldTripType_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL,
    "startDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleWeek_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleWeekId" TEXT NOT NULL,
    "date" DATETIME,
    "dayOfWeek" TEXT NOT NULL,
    "scheduleType" TEXT,
    "enrollmentCount" INTEGER,
    "enrollmentSource" TEXT,
    "fieldTripEventId" TEXT,
    "operatingCapacityOverride" INTEGER,
    "notes" TEXT,
    "dayScheduleType" TEXT,
    CONSTRAINT "ScheduleDay_scheduleWeekId_fkey" FOREIGN KEY ("scheduleWeekId") REFERENCES "ScheduleWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldTripEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleWeekId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "scheduleDayId" TEXT,
    "fieldTripTypeId" TEXT,
    "isNoFieldTrip" BOOLEAN NOT NULL,
    "approverId" TEXT,
    "signedOffAt" DATETIME,
    "notes" TEXT,
    CONSTRAINT "FieldTripEvent_scheduleWeekId_fkey" FOREIGN KEY ("scheduleWeekId") REFERENCES "ScheduleWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SegmentBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleWeekId" TEXT NOT NULL,
    "scheduleDayId" TEXT,
    "dayOfWeek" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "childCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "SegmentBlock_scheduleWeekId_fkey" FOREIGN KEY ("scheduleWeekId") REFERENCES "ScheduleWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleWeekId" TEXT NOT NULL,
    "segmentBlockId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignmentSource" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "StaffAssignment_scheduleWeekId_fkey" FOREIGN KEY ("scheduleWeekId") REFERENCES "ScheduleWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffAssignment_segmentBlockId_fkey" FOREIGN KEY ("segmentBlockId") REFERENCES "SegmentBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleType_schoolId_value_key" ON "ScheduleType"("schoolId", "value");
