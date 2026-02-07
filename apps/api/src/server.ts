import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { getPrisma } from "./db";
import { applyDbEnv, isDebugEnabled } from "./config";
import { backupBeforeWrite, startPeriodicBackups } from "./backups";
import { openapiPath } from "./openapi";
import path from "node:path";
import { readFileSync } from "node:fs";
import type { Prisma as CorePrisma } from "../generated/prisma-client";
import type {
  DayOfWeek,
  EmployeeAvailabilityBlock,
  EmployeeAvailabilityDay,
  EmployeeTimeOffRequest,
  PolicyCitation
} from "@core/domain/types";

type DbTransaction = CorePrisma.TransactionClient;
const toJsonValue = (value: unknown): CorePrisma.InputJsonValue => value as CorePrisma.InputJsonValue;
const DAY_VALUES: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const isDayOfWeek = (value: unknown): value is DayOfWeek =>
  typeof value === "string" && DAY_VALUES.includes(value as DayOfWeek);
const asObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const normalizeAvailability = (value: unknown): EmployeeAvailabilityDay[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const rawDay = asObject(entry);
      if (!rawDay || !isDayOfWeek(rawDay.dayOfWeek)) {
        return null;
      }
      const blocksRaw = Array.isArray(rawDay.blocks) ? rawDay.blocks : [];
      const blocks = blocksRaw
        .map((block): EmployeeAvailabilityBlock | null => {
          const rawBlock = asObject(block);
          if (!rawBlock) return null;
          const startTime = typeof rawBlock.startTime === "string" ? rawBlock.startTime : "";
          const endTime = typeof rawBlock.endTime === "string" ? rawBlock.endTime : "";
          return startTime && endTime ? { startTime, endTime } : null;
        })
        .filter((block): block is EmployeeAvailabilityBlock => Boolean(block))
        .slice(0, 3);
      return {
        dayOfWeek: rawDay.dayOfWeek,
        blocks
      };
    })
    .filter((entry): entry is EmployeeAvailabilityDay => Boolean(entry));
};

const normalizeRequestedDaysOff = (value: unknown): EmployeeTimeOffRequest[] => {
  if (!Array.isArray(value)) return [];
  const normalized: EmployeeTimeOffRequest[] = [];
  value.forEach((entry) => {
    const raw = asObject(entry);
    if (!raw) return;
    const id = typeof raw.id === "string" && raw.id ? raw.id : `timeoff-${Date.now()}`;
    const startDate = typeof raw.startDate === "string" ? raw.startDate : "";
    const endDate = typeof raw.endDate === "string" ? raw.endDate : "";
    if (!startDate || !endDate) return;
    const note = typeof raw.note === "string" ? raw.note : undefined;
    const start = startDate <= endDate ? startDate : endDate;
    const end = startDate <= endDate ? endDate : startDate;
    normalized.push(note ? { id, startDate: start, endDate: end, note } : { id, startDate: start, endDate: end });
  });
  return normalized;
};

const normalizeDayList = (days: string[]) =>
  [...days].map((day) => day.toLowerCase()).sort();

const dayListKey = (days: string[]) => JSON.stringify(normalizeDayList(days));

type ScheduleWeekPayload = {
  schoolId: string;
  label?: string;
  status: string;
  startDate?: string;
};

type ScheduleDayPayload = {
  id: string;
  date?: string;
  dayOfWeek: string;
  scheduleType?: string;
  enrollmentCount?: number;
  enrollmentSource?: string;
  fieldTripEventId?: string;
  operatingCapacityOverride?: number;
  notes?: string;
  dayScheduleType?: string;
};

type FieldTripEventPayload = {
  id: string;
  dayOfWeek: string;
  segment: string;
  scheduleDayId?: string;
  fieldTripTypeId?: string;
  isNoFieldTrip?: boolean;
  approverId?: string;
  signedOffAt?: string;
  notes?: string;
};

type SegmentBlockPayload = {
  id: string;
  scheduleDayId?: string;
  dayOfWeek: string;
  segment: string;
  startTime: string;
  endTime: string;
  childCount: number;
  status: string;
};

type StaffAssignmentPayload = {
  id: string;
  segmentBlockId: string;
  employeeId: string;
  assignmentSource: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
};

type AuditEventPayload = {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  policyCitation: PolicyCitation;
  notes?: string;
};

const buildServer = async () => {
  const fastify = Fastify({ logger: isDebugEnabled() });
  await fastify.register(cors, { origin: true });

  const swaggerEditorRoot = path.resolve(__dirname, "../../../node_modules/swagger-editor-dist");
  await fastify.register(fastifyStatic, {
    root: swaggerEditorRoot,
    prefix: "/api/docs/",
    decorateReply: false
  });

  const uiDistRoot = path.resolve(__dirname, "../../../dist/ui");
  await fastify.register(fastifyStatic, {
    root: uiDistRoot,
    prefix: "/"
  });

  fastify.get("/api/health", async () => ({ status: "ok" }));

  fastify.get("/api/openapi.yaml", async (_, reply) => {
    const spec = readFileSync(openapiPath, "utf-8");
    reply.type("application/yaml").send(spec);
  });

  fastify.get("/api/docs", async (_, reply) => {
    const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>OpenAPI Editor</title>\n  <link rel="stylesheet" href="/api/docs/swagger-editor.css" />\n  <style>html, body { margin: 0; padding: 0; height: 100%; } #swagger-editor { height: 100vh; }</style>\n</head>\n<body>\n  <div id="swagger-editor"></div>\n  <script src="/api/docs/swagger-editor-bundle.js"></script>\n  <script src="/api/docs/swagger-editor-standalone-preset.js"></script>\n  <script>\n    window.onload = function () {\n      SwaggerEditorBundle({\n        url: '/api/openapi.yaml',\n        dom_id: '#swagger-editor',\n        layout: 'StandaloneLayout',\n        presets: [SwaggerEditorStandalonePreset]\n      });\n    };\n  </script>\n</body>\n</html>`;
    reply.type("text/html").send(html);
  });

  fastify.get("/", async (_, reply) => {
    return reply.sendFile("index.html");
  });

  fastify.get("/*", async (request, reply) => {
    const url = request.raw.url ?? "/";
    if (url.startsWith("/api/")) {
      return reply.code(404).send({ message: "Not found" });
    }
    const pathOnly = url.split("?")[0];
    if (pathOnly.includes(".")) {
      return reply.sendFile(pathOnly.replace(/^\//, ""));
    }
    return reply.sendFile("index.html");
  });

  fastify.get("/api/settings/:schoolId", async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const prisma = getPrisma();
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        scheduleTypes: true,
        jobTitles: true,
        employees: true,
        operatingHours: true,
        fieldTripTypes: true
      }
    });
    if (!school) {
      return { school: null };
    }
    return {
      school,
      scheduleTypes: school.scheduleTypes,
      jobTitles: school.jobTitles,
      employees: school.employees.map((employee) => ({
        ...employee,
        availability: normalizeAvailability(employee.availability),
        requestedDaysOff: normalizeRequestedDaysOff(employee.requestedDaysOff)
      })),
      operatingHours: school.operatingHours,
      fieldTripTypes: school.fieldTripTypes
    };
  });

  fastify.put("/api/settings/:schoolId", async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const payload = request.body as {
      school?: {
        name: string;
        closedDays: string[];
        openerCount: number;
        closerCount: number;
        minimumMedicalDelegated: number;
        requireCurrentCpr: boolean;
      };
      scheduleTypes?: Array<{
        value: string;
        label: string;
        ratio: { adults: number; students: number };
        description?: string;
      }>;
      jobTitles?: Array<{
        title: string;
        leaderQualified: boolean;
        requiresLeaderForOpenClose: boolean;
      }>;
      employees?: Array<{
        id?: string;
        name: string;
        jobTitle: string;
        maxHoursPerDay: number;
        maxHoursPerWeek: number;
        employmentStatus: string;
        medicallyDelegated: boolean;
        cprCurrent: boolean;
        notes?: string;
        availability?: EmployeeAvailabilityDay[];
        requestedDaysOff?: EmployeeTimeOffRequest[];
      }>;
      operatingHours?: Array<{
        scheduleType: string;
        daysOfWeek: string[];
        open: string;
        close: string;
      }>;
      fieldTripTypes?: Array<{
        name: string;
        minAdultStudentRatio: number;
        minLeaderStudentRatio: number;
        policyCitationId?: string;
        notes?: string;
      }>;
    };

    const prisma = getPrisma();
    try {
      await backupBeforeWrite();
    } catch (error) {
      request.log.warn({ error }, "Database backup before settings write failed");
    }

    const school = await prisma.$transaction(async (tx: DbTransaction) => {
      let upsertedSchool = await tx.school.findUnique({ where: { id: schoolId } });
      if (payload.school) {
        upsertedSchool = await tx.school.upsert({
          where: { id: schoolId },
          create: {
            id: schoolId,
            name: payload.school.name,
            closedDays: payload.school.closedDays,
            openerCount: payload.school.openerCount,
            closerCount: payload.school.closerCount,
            minimumMedicalDelegated: payload.school.minimumMedicalDelegated,
            requireCurrentCpr: payload.school.requireCurrentCpr
          },
          update: {
            name: payload.school.name,
            closedDays: payload.school.closedDays,
            openerCount: payload.school.openerCount,
            closerCount: payload.school.closerCount,
            minimumMedicalDelegated: payload.school.minimumMedicalDelegated,
            requireCurrentCpr: payload.school.requireCurrentCpr
          }
        });
      }
      if (!upsertedSchool) {
        upsertedSchool = await tx.school.create({
          data: {
            id: schoolId,
            name: schoolId,
            closedDays: [],
            openerCount: 0,
            closerCount: 0,
            minimumMedicalDelegated: 0,
            requireCurrentCpr: false
          }
        });
      }

      if (payload.scheduleTypes?.length) {
        for (const type of payload.scheduleTypes) {
          await tx.scheduleType.upsert({
            where: {
              schoolId_value: {
                schoolId,
                value: type.value
              }
            },
            create: {
              schoolId,
              value: type.value,
              label: type.label,
              ratioAdults: type.ratio.adults,
              ratioStudents: type.ratio.students,
              description: type.description ?? null
            },
            update: {
              label: type.label,
              ratioAdults: type.ratio.adults,
              ratioStudents: type.ratio.students,
              description: type.description ?? null
            }
          });
        }
      }

      if (payload.jobTitles?.length) {
        const existingJobTitles = await tx.jobTitle.findMany({ where: { schoolId } });
        for (const title of payload.jobTitles) {
          const existing = existingJobTitles.find((entry) => entry.title === title.title);
          if (existing) {
            await tx.jobTitle.update({
              where: { id: existing.id },
              data: {
                leaderQualified: title.leaderQualified,
                requiresLeaderForOpenClose: title.requiresLeaderForOpenClose
              }
            });
            continue;
          }
          await tx.jobTitle.create({
            data: {
              schoolId,
              title: title.title,
              leaderQualified: title.leaderQualified,
              requiresLeaderForOpenClose: title.requiresLeaderForOpenClose
            }
          });
        }
      }

      if (Array.isArray(payload.employees) && payload.employees.length > 0) {
        const existingEmployees = await tx.employee.findMany({ where: { schoolId } });
        const keptEmployeeIds = new Set<string>();
        const existingById = new Map(existingEmployees.map((employee) => [employee.id, employee]));
        const existingByStableKey = new Map<string, string[]>();

        existingEmployees.forEach((employee) => {
          const key = `${employee.name.trim().toLowerCase()}::${employee.jobTitle.trim().toLowerCase()}`;
          const ids = existingByStableKey.get(key) ?? [];
          ids.push(employee.id);
          existingByStableKey.set(key, ids);
        });

        for (const employee of payload.employees) {
          const stableKey = `${employee.name.trim().toLowerCase()}::${employee.jobTitle.trim().toLowerCase()}`;
          const fromId = employee.id && existingById.has(employee.id) ? employee.id : null;
          const fromStableKey = (existingByStableKey.get(stableKey) ?? []).find(
            (candidateId) => !keptEmployeeIds.has(candidateId)
          );
          const targetId = fromId ?? fromStableKey;

          if (targetId) {
            keptEmployeeIds.add(targetId);
            await tx.employee.update({
              where: { id: targetId },
              data: {
                name: employee.name,
                jobTitle: employee.jobTitle,
                maxHoursPerDay: employee.maxHoursPerDay,
                maxHoursPerWeek: employee.maxHoursPerWeek,
                employmentStatus: employee.employmentStatus,
                medicallyDelegated: employee.medicallyDelegated,
                cprCurrent: employee.cprCurrent,
                notes: employee.notes ?? null,
                availability: toJsonValue(normalizeAvailability(employee.availability)),
                requestedDaysOff: toJsonValue(normalizeRequestedDaysOff(employee.requestedDaysOff))
              }
            });
            continue;
          }

          const created = await tx.employee.create({
            data: {
              id: employee.id,
              schoolId,
              name: employee.name,
              jobTitle: employee.jobTitle,
              maxHoursPerDay: employee.maxHoursPerDay,
              maxHoursPerWeek: employee.maxHoursPerWeek,
              employmentStatus: employee.employmentStatus,
              medicallyDelegated: employee.medicallyDelegated,
              cprCurrent: employee.cprCurrent,
              notes: employee.notes ?? null,
              availability: toJsonValue(normalizeAvailability(employee.availability)),
              requestedDaysOff: toJsonValue(normalizeRequestedDaysOff(employee.requestedDaysOff))
            }
          });
          keptEmployeeIds.add(created.id);
        }

      }

      if (payload.operatingHours?.length) {
        const existingOperatingHours = await tx.operatingHours.findMany({ where: { schoolId } });
        for (const entry of payload.operatingHours) {
          const targetDaysKey = dayListKey(entry.daysOfWeek);
          const existing = existingOperatingHours.find((record) => {
            if (record.scheduleType !== entry.scheduleType || record.open !== entry.open || record.close !== entry.close) {
              return false;
            }
            if (!Array.isArray(record.daysOfWeek)) {
              return false;
            }
            return dayListKey(record.daysOfWeek.map((day) => String(day))) === targetDaysKey;
          });
          if (existing) {
            await tx.operatingHours.update({
              where: { id: existing.id },
              data: {
                daysOfWeek: normalizeDayList(entry.daysOfWeek),
                open: entry.open,
                close: entry.close
              }
            });
            continue;
          }
          await tx.operatingHours.create({
            data: {
              schoolId,
              scheduleType: entry.scheduleType,
              daysOfWeek: normalizeDayList(entry.daysOfWeek),
              open: entry.open,
              close: entry.close
            }
          });
        }
      }

      if (payload.fieldTripTypes?.length) {
        const existingFieldTripTypes = await tx.fieldTripType.findMany({ where: { schoolId } });
        for (const trip of payload.fieldTripTypes) {
          const existing = existingFieldTripTypes.find((entry) => entry.name === trip.name);
          if (existing) {
            await tx.fieldTripType.update({
              where: { id: existing.id },
              data: {
                minAdultStudentRatio: trip.minAdultStudentRatio,
                minLeaderStudentRatio: trip.minLeaderStudentRatio,
                policyCitationId: trip.policyCitationId ?? null,
                notes: trip.notes ?? null
              }
            });
            continue;
          }
          await tx.fieldTripType.create({
            data: {
              schoolId,
              name: trip.name,
              minAdultStudentRatio: trip.minAdultStudentRatio,
              minLeaderStudentRatio: trip.minLeaderStudentRatio,
              policyCitationId: trip.policyCitationId ?? null,
              notes: trip.notes ?? null
            }
          });
        }
      }

      return upsertedSchool;
    });

    return { school };
  });

  fastify.get("/api/schedule/:weekId", async (request, reply) => {
    const { weekId } = request.params as { weekId: string };
    const prisma = getPrisma();
    const scheduleWeek = await prisma.scheduleWeek.findUnique({
      where: { id: weekId },
      include: {
        scheduleDays: true,
        segmentBlocks: true,
        staffAssignments: true,
        fieldTripEvents: true,
        auditEvents: true
      }
    });
    if (!scheduleWeek) {
      return reply.code(404).send({ message: `Schedule week ${weekId} not found` });
    }
    return {
      ...scheduleWeek,
      auditEvents: scheduleWeek.auditEvents.map((event) => ({
        id: event.id,
        timestamp: event.timestamp.toISOString(),
        user: event.user,
        action: event.action,
        policyCitation: {
          id: event.citationId ?? "ui-audit",
          name: event.citationName ?? "User schedule action",
          document: event.citationDoc ?? "UI action log",
          section: event.citationSection ?? undefined
        },
        notes: event.notes ?? undefined
      }))
    };
  });

  fastify.put("/api/schedule/:weekId", async (request, reply) => {
    const { weekId } = request.params as { weekId: string };
    const payload = request.body as {
      scheduleWeek: ScheduleWeekPayload;
      scheduleDays: ScheduleDayPayload[];
      segmentBlocks: SegmentBlockPayload[];
      staffAssignments: StaffAssignmentPayload[];
      fieldTripEvents: FieldTripEventPayload[];
      auditEvents: AuditEventPayload[];
    };

    const prisma = getPrisma();
    try {
      await backupBeforeWrite();
    } catch (error) {
      request.log.warn({ error }, "Database backup before schedule write failed");
    }
    if (!Array.isArray(payload.scheduleDays) || payload.scheduleDays.length === 0) {
      return reply.code(400).send({
        message: "Refusing to save schedule without scheduleDays. Payload is incomplete."
      });
    }
    await prisma.$transaction(async (tx: DbTransaction) => {
      await tx.school.upsert({
        where: { id: payload.scheduleWeek.schoolId },
        create: {
          id: payload.scheduleWeek.schoolId,
          name: payload.scheduleWeek.schoolId,
          closedDays: [],
          openerCount: 0,
          closerCount: 0,
          minimumMedicalDelegated: 0,
          requireCurrentCpr: false
        },
        update: {}
      });

      await tx.scheduleWeek.upsert({
        where: { id: weekId },
        create: {
          id: weekId,
          schoolId: payload.scheduleWeek.schoolId,
          label: payload.scheduleWeek.label ?? null,
          status: payload.scheduleWeek.status,
          startDate: payload.scheduleWeek.startDate ? new Date(payload.scheduleWeek.startDate) : null
        },
        update: {
          label: payload.scheduleWeek.label ?? null,
          status: payload.scheduleWeek.status,
          startDate: payload.scheduleWeek.startDate ? new Date(payload.scheduleWeek.startDate) : null
        }
      });

      if (payload.scheduleDays?.length) {
        for (const day of payload.scheduleDays) {
          await tx.scheduleDay.upsert({
            where: { id: day.id },
            create: {
              id: day.id,
              scheduleWeekId: weekId,
              date: day.date ? new Date(day.date) : null,
              dayOfWeek: day.dayOfWeek,
              scheduleType: day.scheduleType ?? null,
              enrollmentCount: day.enrollmentCount ?? null,
              enrollmentSource: day.enrollmentSource ?? null,
              fieldTripEventId: day.fieldTripEventId ?? null,
              operatingCapacityOverride: day.operatingCapacityOverride ?? null,
              notes: day.notes ?? null,
              dayScheduleType: day.dayScheduleType ?? null
            },
            update: {
              scheduleWeekId: weekId,
              date: day.date ? new Date(day.date) : null,
              dayOfWeek: day.dayOfWeek,
              scheduleType: day.scheduleType ?? null,
              enrollmentCount: day.enrollmentCount ?? null,
              enrollmentSource: day.enrollmentSource ?? null,
              fieldTripEventId: day.fieldTripEventId ?? null,
              operatingCapacityOverride: day.operatingCapacityOverride ?? null,
              notes: day.notes ?? null,
              dayScheduleType: day.dayScheduleType ?? null
            }
          });
        }
      }

      if (payload.fieldTripEvents?.length) {
        for (const event of payload.fieldTripEvents) {
          await tx.fieldTripEvent.upsert({
            where: { id: event.id },
            create: {
              // If no trip type is selected, default to "No Field Trip".
              isNoFieldTrip: event.fieldTripTypeId ? false : (event.isNoFieldTrip ?? true),
              id: event.id,
              scheduleWeekId: weekId,
              dayOfWeek: event.dayOfWeek,
              segment: event.segment,
              scheduleDayId: event.scheduleDayId ?? null,
              fieldTripTypeId: event.fieldTripTypeId ?? null,
              approverId: event.approverId ?? null,
              signedOffAt: event.signedOffAt ? new Date(event.signedOffAt) : null,
              notes: event.notes ?? null
            },
            update: {
              scheduleWeekId: weekId,
              dayOfWeek: event.dayOfWeek,
              segment: event.segment,
              scheduleDayId: event.scheduleDayId ?? null,
              fieldTripTypeId: event.fieldTripTypeId ?? null,
              isNoFieldTrip: event.fieldTripTypeId ? false : (event.isNoFieldTrip ?? true),
              approverId: event.approverId ?? null,
              signedOffAt: event.signedOffAt ? new Date(event.signedOffAt) : null,
              notes: event.notes ?? null
            }
          });
        }
      }

      if (payload.segmentBlocks?.length) {
        for (const block of payload.segmentBlocks) {
          await tx.segmentBlock.upsert({
            where: { id: block.id },
            create: {
              id: block.id,
              scheduleWeekId: weekId,
              scheduleDayId: block.scheduleDayId ?? null,
              dayOfWeek: block.dayOfWeek,
              segment: block.segment,
              startTime: block.startTime,
              endTime: block.endTime,
              childCount: block.childCount,
              status: block.status
            },
            update: {
              scheduleWeekId: weekId,
              scheduleDayId: block.scheduleDayId ?? null,
              dayOfWeek: block.dayOfWeek,
              segment: block.segment,
              startTime: block.startTime,
              endTime: block.endTime,
              childCount: block.childCount,
              status: block.status
            }
          });
        }
      }

      if (payload.staffAssignments?.length) {
        const segmentBlockIds = new Set((payload.segmentBlocks ?? []).map((block) => block.id));
        const uniqueAssignments = new Map<string, StaffAssignmentPayload>();
        payload.staffAssignments.forEach((assignment) => {
          if (!segmentBlockIds.has(assignment.segmentBlockId)) {
            return;
          }
          uniqueAssignments.set(assignment.id, assignment);
        });
        for (const assignment of Array.from(uniqueAssignments.values())) {
          await tx.staffAssignment.upsert({
            where: { id: assignment.id },
            create: {
              id: assignment.id,
              scheduleWeekId: weekId,
              segmentBlockId: assignment.segmentBlockId,
              employeeId: assignment.employeeId,
              assignmentSource: assignment.assignmentSource,
              startTime: assignment.startTime,
              endTime: assignment.endTime,
              status: assignment.status,
              notes: assignment.notes ?? null
            },
            update: {
              scheduleWeekId: weekId,
              segmentBlockId: assignment.segmentBlockId,
              employeeId: assignment.employeeId,
              assignmentSource: assignment.assignmentSource,
              startTime: assignment.startTime,
              endTime: assignment.endTime,
              status: assignment.status,
              notes: assignment.notes ?? null
            }
          });
        }
      }

      if (payload.auditEvents?.length) {
        for (const event of payload.auditEvents) {
          await tx.auditEvent.upsert({
            where: { id: event.id },
            create: {
              id: event.id,
              scheduleWeekId: weekId,
              timestamp: new Date(event.timestamp),
              user: event.user,
              action: event.action,
              citationId: event.policyCitation?.id ?? null,
              citationName: event.policyCitation?.name ?? null,
              citationDoc: event.policyCitation?.document ?? null,
              citationSection: event.policyCitation?.section ?? null,
              notes: event.notes ?? null
            },
            update: {
              scheduleWeekId: weekId,
              timestamp: new Date(event.timestamp),
              user: event.user,
              action: event.action,
              citationId: event.policyCitation?.id ?? null,
              citationName: event.policyCitation?.name ?? null,
              citationDoc: event.policyCitation?.document ?? null,
              citationSection: event.policyCitation?.section ?? null,
              notes: event.notes ?? null
            }
          });
        }
      }
    });

    return { ok: true };
  });

  return fastify;
};

const start = async () => {
  applyDbEnv();
  startPeriodicBackups();
  const server = await buildServer();
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    await server.listen({ port, host });
    if (!isDebugEnabled()) {
      // eslint-disable-next-line no-console
      console.log(`API listening on http://${host}:${port}`);
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
