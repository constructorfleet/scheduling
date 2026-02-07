import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { getPrisma } from "./db";
import { applyDbEnv, isDebugEnabled } from "./config";
import { openapiPath } from "./openapi";
import path from "node:path";
import { readFileSync } from "node:fs";
import type { Prisma as CorePrisma } from "../generated/prisma-client";

type DbTransaction = CorePrisma.TransactionClient;

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

const buildServer = async () => {
  const fastify = Fastify({ logger: isDebugEnabled() });
  await fastify.register(cors, { origin: true });

  const swaggerEditorRoot = path.resolve(__dirname, "../../../node_modules/swagger-editor-dist");
  await fastify.register(fastifyStatic, {
    root: swaggerEditorRoot,
    prefix: "/api/docs/"
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
      employees: school.employees,
      operatingHours: school.operatingHours,
      fieldTripTypes: school.fieldTripTypes
    };
  });

  fastify.put("/api/settings/:schoolId", async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const payload = request.body as {
      school: {
        name: string;
        closedDays: string[];
        openerCount: number;
        closerCount: number;
        minimumMedicalDelegated: number;
        requireCurrentCpr: boolean;
      };
      scheduleTypes: Array<{
        value: string;
        label: string;
        ratio: { adults: number; students: number };
        description?: string;
      }>;
      jobTitles: Array<{
        title: string;
        leaderQualified: boolean;
        requiresLeaderForOpenClose: boolean;
      }>;
      employees: Array<{
        id?: string;
        name: string;
        jobTitle: string;
        maxHoursPerDay: number;
        maxHoursPerWeek: number;
        employmentStatus: string;
        medicallyDelegated: boolean;
        cprCurrent: boolean;
        notes?: string;
      }>;
      operatingHours: Array<{
        scheduleType: string;
        daysOfWeek: string[];
        open: string;
        close: string;
      }>;
      fieldTripTypes: Array<{
        name: string;
        minAdultStudentRatio: number;
        minLeaderStudentRatio: number;
        policyCitationId?: string;
        notes?: string;
      }>;
    };

    const prisma = getPrisma();

    const school = await prisma.$transaction(async (tx: DbTransaction) => {
      const upsertedSchool = await tx.school.upsert({
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

      await tx.scheduleType.deleteMany({ where: { schoolId } });
      await tx.jobTitle.deleteMany({ where: { schoolId } });
      await tx.operatingHours.deleteMany({ where: { schoolId } });
      await tx.fieldTripType.deleteMany({ where: { schoolId } });

      if (payload.scheduleTypes?.length) {
        await tx.scheduleType.createMany({
          data: payload.scheduleTypes.map((type) => ({
            schoolId,
            value: type.value,
            label: type.label,
            ratioAdults: type.ratio.adults,
            ratioStudents: type.ratio.students,
            description: type.description ?? null
          }))
        });
      }

      if (payload.jobTitles?.length) {
        await tx.jobTitle.createMany({
          data: payload.jobTitles.map((title) => ({
            schoolId,
            title: title.title,
            leaderQualified: title.leaderQualified,
            requiresLeaderForOpenClose: title.requiresLeaderForOpenClose
          }))
        });
      }

      if (payload.employees?.length) {
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
                notes: employee.notes ?? null
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
              notes: employee.notes ?? null
            }
          });
          keptEmployeeIds.add(created.id);
        }

        if (keptEmployeeIds.size > 0) {
          await tx.employee.deleteMany({
            where: {
              schoolId,
              id: {
                notIn: Array.from(keptEmployeeIds)
              }
            }
          });
        }
      } else {
        await tx.employee.deleteMany({ where: { schoolId } });
      }

      if (payload.operatingHours?.length) {
        await tx.operatingHours.createMany({
          data: payload.operatingHours.map((entry) => ({
            schoolId,
            scheduleType: entry.scheduleType,
            daysOfWeek: entry.daysOfWeek,
            open: entry.open,
            close: entry.close
          }))
        });
      }

      if (payload.fieldTripTypes?.length) {
        await tx.fieldTripType.createMany({
          data: payload.fieldTripTypes.map((trip) => ({
            schoolId,
            name: trip.name,
            minAdultStudentRatio: trip.minAdultStudentRatio,
            minLeaderStudentRatio: trip.minLeaderStudentRatio,
            policyCitationId: trip.policyCitationId ?? null,
            notes: trip.notes ?? null
          }))
        });
      }

      return upsertedSchool;
    });

    return { school };
  });

  fastify.get("/api/schedule/:weekId", async (request) => {
    const { weekId } = request.params as { weekId: string };
    const prisma = getPrisma();
    const scheduleWeek = await prisma.scheduleWeek.findUnique({
      where: { id: weekId },
      include: {
        scheduleDays: true,
        segmentBlocks: true,
        staffAssignments: true,
        fieldTripEvents: true
      }
    });
    if (!scheduleWeek) {
      return { scheduleWeek: null };
    }
    return scheduleWeek;
  });

  fastify.put("/api/schedule/:weekId", async (request) => {
    const { weekId } = request.params as { weekId: string };
    const payload = request.body as {
      scheduleWeek: ScheduleWeekPayload;
      scheduleDays: ScheduleDayPayload[];
      segmentBlocks: SegmentBlockPayload[];
      staffAssignments: StaffAssignmentPayload[];
      fieldTripEvents: FieldTripEventPayload[];
    };

    const prisma = getPrisma();
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

      await tx.staffAssignment.deleteMany({ where: { scheduleWeekId: weekId } });
      await tx.segmentBlock.deleteMany({ where: { scheduleWeekId: weekId } });
      await tx.scheduleDay.deleteMany({ where: { scheduleWeekId: weekId } });
      await tx.fieldTripEvent.deleteMany({ where: { scheduleWeekId: weekId } });

      if (payload.scheduleDays?.length) {
        await tx.scheduleDay.createMany({
          data: payload.scheduleDays.map((day) => ({
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
          }))
        });
      }

      if (payload.fieldTripEvents?.length) {
        await tx.fieldTripEvent.createMany({
          data: payload.fieldTripEvents.map((event) => ({
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
          }))
        });
      }

      if (payload.segmentBlocks?.length) {
        await tx.segmentBlock.createMany({
          data: payload.segmentBlocks.map((block) => ({
            id: block.id,
            scheduleWeekId: weekId,
            scheduleDayId: block.scheduleDayId ?? null,
            dayOfWeek: block.dayOfWeek,
            segment: block.segment,
            startTime: block.startTime,
            endTime: block.endTime,
            childCount: block.childCount,
            status: block.status
          }))
        });
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
        await tx.staffAssignment.createMany({
          data: Array.from(uniqueAssignments.values()).map((assignment) => ({
            id: assignment.id,
            scheduleWeekId: weekId,
            segmentBlockId: assignment.segmentBlockId,
            employeeId: assignment.employeeId,
            assignmentSource: assignment.assignmentSource,
            startTime: assignment.startTime,
            endTime: assignment.endTime,
            status: assignment.status,
            notes: assignment.notes ?? null
          }))
        });
      }
    });

    return { ok: true };
  });

  return fastify;
};

const start = async () => {
  applyDbEnv();
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
