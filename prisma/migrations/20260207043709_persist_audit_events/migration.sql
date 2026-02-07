-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleWeekId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "user" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "citationId" TEXT,
    "citationName" TEXT,
    "citationDoc" TEXT,
    "citationSection" TEXT,
    "notes" TEXT,
    CONSTRAINT "AuditEvent_scheduleWeekId_fkey" FOREIGN KEY ("scheduleWeekId") REFERENCES "ScheduleWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
