import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import { getPrisma } from "./db";
import { applyDbEnv, isDebugEnabled } from "./config";
import { backupBeforeWrite, startPeriodicBackups } from "./backups";
import { openapiPath } from "./openapi";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  createCsrfToken,
  createSessionExpiry,
  createSessionToken,
  CSRF_COOKIE_NAME,
  hashSessionToken,
  normalizeEmail,
  SESSION_COOKIE_NAME,
  verifyPassword
} from "./auth";
import { canAccessSchoolWithRole } from "./access";
import type { Prisma as CorePrisma } from "../generated/prisma-client";
import type {
  DayOfWeek,
  EmployeeAvailabilityBlock,
  EmployeeAvailabilityDay,
  EmployeeTimeOffRequest,
  PolicyCitation
} from "@core/domain/types";
import type { Role } from "../generated/prisma-client";

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

type AuthContext = {
  sessionId: string;
  userId: string;
  displayName: string;
  email: string;
  memberships: Array<{
    schoolId: string;
    role: Role;
  }>;
};

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production"
};
const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production"
};

const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 20;
const USER_LOGIN_MAX_FAILURES = 5;
const USER_LOCKOUT_MS = 15 * 60 * 1000;

const ipLoginAttempts = new Map<string, number[]>();

const buildServer = async () => {
  const fastify = Fastify({ logger: isDebugEnabled() });
  await fastify.register(cors, { origin: true });
  await fastify.register(fastifyCookie);

  const swaggerEditorRoot = path.resolve(__dirname, "../../../node_modules/swagger-editor-dist");
  await fastify.register(fastifyStatic, {
    root: swaggerEditorRoot,
    prefix: "/api/docs/",
    decorateReply: false
  });

  const uiDistRoot = path.resolve(__dirname, "../../../dist/ui");
  await fastify.register(fastifyStatic, {
    root: uiDistRoot,
    prefix: "/",
    serve: false
  });

  const resolveAuth = async (request: FastifyRequest): Promise<AuthContext | null> => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (!token) {
      return null;
    }
    const prisma = getPrisma();
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: {
        user: {
          include: {
            memberships: true
          }
        }
      }
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    if (session.user.status !== "active") {
      return null;
    }
    return {
      sessionId: session.id,
      userId: session.user.id,
      displayName: session.user.displayName,
      email: session.user.email,
      memberships: session.user.memberships.map((membership) => ({
        schoolId: membership.schoolId,
        role: membership.role
      }))
    };
  };

  const requireRoleForSchool = async (
    request: FastifyRequest,
    reply: FastifyReply,
    schoolId: string,
    requiredRole: Role
  ) => {
    const auth = await resolveAuth(request);
    if (!auth) {
      reply.code(401).send({ message: "Authentication required." });
      return null;
    }
    if (!canAccessSchoolWithRole(auth, schoolId, requiredRole)) {
      reply.code(403).send({ message: "Insufficient access for this school." });
      return null;
    }
    return auth;
  };

  const isIpRateLimited = (ipAddress: string) => {
    const now = Date.now();
    const cutoff = now - LOGIN_RATE_LIMIT_WINDOW_MS;
    const attempts = ipLoginAttempts.get(ipAddress) ?? [];
    const recent = attempts.filter((timestamp) => timestamp >= cutoff);
    if (recent.length >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      ipLoginAttempts.set(ipAddress, recent);
      return true;
    }
    recent.push(now);
    ipLoginAttempts.set(ipAddress, recent);
    return false;
  };

  const clearIpRateLimit = (ipAddress: string) => {
    ipLoginAttempts.delete(ipAddress);
  };

  const requireCsrf = (request: FastifyRequest, reply: FastifyReply) => {
    const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = request.headers["x-csrf-token"];
    const headerValue = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
    if (!csrfCookie || !headerValue || headerValue !== csrfCookie) {
      reply.code(403).send({ message: "Invalid CSRF token." });
      return false;
    }
    return true;
  };

  fastify.get("/api/health", async () => ({ status: "ok" }));

  fastify.get("/api/openapi.yaml", async (_, reply) => {
    const spec = readFileSync(openapiPath, "utf-8");
    reply.type("application/yaml").send(spec);
  });

  fastify.get("/api/docs", async (_, reply) => {
    const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>OpenAPI Editor</title>\n  <link rel="stylesheet" href="/api/docs/swagger-editor.css" />\n  <style>html, body { margin: 0; padding: 0; height: 100%; } #swagger-editor { height: 100vh; }</style>\n</head>\n<body>\n  <div id="swagger-editor"></div>\n  <script src="/api/docs/swagger-editor-bundle.js"></script>\n  <script src="/api/docs/swagger-editor-standalone-preset.js"></script>\n  <script>\n    window.onload = function () {\n      SwaggerEditorBundle({\n        url: '/api/openapi.yaml',\n        dom_id: '#swagger-editor',\n        layout: 'StandaloneLayout',\n        presets: [SwaggerEditorStandalonePreset]\n      });\n    };\n  </script>\n</body>\n</html>`;
    reply.type("text/html").send(html);
  });

  fastify.post("/api/auth/login", async (request, reply) => {
    const ipAddress = request.ip;
    if (isIpRateLimited(ipAddress)) {
      return reply.code(429).send({ message: "Too many login attempts. Try again shortly." });
    }

    const body = (request.body ?? {}) as {
      email?: string;
      password?: string;
      schoolId?: string;
    };
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const requestedSchoolId = typeof body.schoolId === "string" ? body.schoolId : undefined;

    if (!email || !password) {
      return reply.code(400).send({ message: "Email and password are required." });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: true }
    });

    if (!user || user.status !== "active") {
      return reply.code(401).send({ message: "Invalid credentials." });
    }
    if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
      return reply.code(423).send({ message: "Account temporarily locked. Please try again later." });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      const nextFailures = user.failedLoginAttempts + 1;
      const shouldLock = nextFailures >= USER_LOGIN_MAX_FAILURES;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : nextFailures,
          lockoutUntil: shouldLock ? new Date(Date.now() + USER_LOCKOUT_MS) : null
        }
      });
      return reply.code(401).send({ message: "Invalid credentials." });
    }

    const targetMembership = requestedSchoolId
      ? user.memberships.find((membership) => membership.schoolId === requestedSchoolId)
      : user.memberships[0];

    if (!targetMembership) {
      return reply.code(403).send({ message: "No school access assigned for this user." });
    }

    const token = createSessionToken();
    const csrfToken = createCsrfToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = createSessionExpiry();
    const userAgent = request.headers["user-agent"] ?? null;

    await prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent
      }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockoutUntil: null
      }
    });

    reply.setCookie(SESSION_COOKIE_NAME, token, {
      ...SESSION_COOKIE_OPTIONS,
      expires: expiresAt
    });
    reply.setCookie(CSRF_COOKIE_NAME, csrfToken, {
      ...CSRF_COOKIE_OPTIONS,
      expires: expiresAt
    });
    clearIpRateLimit(ipAddress);

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      },
      currentSchoolId: targetMembership.schoolId,
      memberships: user.memberships.map((membership) => ({
        schoolId: membership.schoolId,
        role: membership.role
      })),
      session: {
        id: session.id,
        expiresAt: expiresAt.toISOString()
      },
      csrfToken
    });
  });

  fastify.post("/api/auth/logout", async (request, reply) => {
    if (!requireCsrf(request, reply)) {
      return;
    }
    const auth = await resolveAuth(request);
    if (auth) {
      const prisma = getPrisma();
      await prisma.session.update({
        where: { id: auth.sessionId },
        data: { revokedAt: new Date() }
      });
    }

    reply.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
    reply.clearCookie(CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS);
    return reply.send({ ok: true });
  });

  fastify.get("/api/auth/me", async (request, reply) => {
    const auth = await resolveAuth(request);
    if (!auth) {
      return reply.code(401).send({ message: "Authentication required." });
    }
    return reply.send({
      user: {
        id: auth.userId,
        email: auth.email,
        displayName: auth.displayName
      },
      memberships: auth.memberships
    });
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

  fastify.get("/api/settings/:schoolId", async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };
    if (!(await requireRoleForSchool(request, reply, schoolId, "viewer"))) {
      return;
    }
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

  fastify.put("/api/settings/:schoolId", async (request, reply) => {
    if (!requireCsrf(request, reply)) {
      return;
    }
    const { schoolId } = request.params as { schoolId: string };
    if (!(await requireRoleForSchool(request, reply, schoolId, "director"))) {
      return;
    }
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
        adultRatioAdults: number;
        adultRatioStudents: number;
        leaderRatioAdults: number;
        leaderRatioStudents: number;
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
                adultRatioAdults: trip.adultRatioAdults,
                adultRatioStudents: trip.adultRatioStudents,
                leaderRatioAdults: trip.leaderRatioAdults,
                leaderRatioStudents: trip.leaderRatioStudents,
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
              adultRatioAdults: trip.adultRatioAdults,
              adultRatioStudents: trip.adultRatioStudents,
              leaderRatioAdults: trip.leaderRatioAdults,
              leaderRatioStudents: trip.leaderRatioStudents,
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
    if (!(await requireRoleForSchool(request, reply, scheduleWeek.schoolId, "viewer"))) {
      return;
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

  fastify.delete("/api/schedule/:weekId/staff-assignments", async (request, reply) => {
    if (!requireCsrf(request, reply)) {
      return;
    }
    const { weekId } = request.params as { weekId: string };
    const prisma = getPrisma();
    const scheduleWeek = await prisma.scheduleWeek.findUnique({
      where: { id: weekId },
      select: { schoolId: true }
    });
    if (!scheduleWeek) {
      return reply.code(404).send({ message: `Schedule week ${weekId} not found` });
    }
    if (!(await requireRoleForSchool(request, reply, scheduleWeek.schoolId, "scheduler"))) {
      return;
    }
    try {
      await backupBeforeWrite();
    } catch (error) {
      request.log.warn({ error }, "Database backup before staff assignment delete failed");
    }
    const result = await prisma.staffAssignment.deleteMany({
      where: { scheduleWeekId: weekId }
    });
    return reply.send({ ok: true, deleted: result.count });
  });

  fastify.put("/api/schedule/:weekId", async (request, reply) => {
    if (!requireCsrf(request, reply)) {
      return;
    }
    const { weekId } = request.params as { weekId: string };
    const payload = request.body as Partial<{
      scheduleWeek: ScheduleWeekPayload;
      scheduleDays: ScheduleDayPayload[];
      segmentBlocks: SegmentBlockPayload[];
      staffAssignments: StaffAssignmentPayload[];
      fieldTripEvents: FieldTripEventPayload[];
      auditEvents: AuditEventPayload[];
    }>;

    const prisma = getPrisma();
    try {
      await backupBeforeWrite();
    } catch (error) {
      request.log.warn({ error }, "Database backup before schedule write failed");
    }
    const existingWeek = await prisma.scheduleWeek.findUnique({
      where: { id: weekId },
      select: {
        schoolId: true,
        label: true,
        status: true,
        startDate: true
      }
    });
    const targetSchoolId = existingWeek?.schoolId ?? payload.scheduleWeek?.schoolId;
    if (!targetSchoolId) {
      return reply.code(400).send({
        message: "Cannot save schedule chunk before scheduleWeek exists. Include scheduleWeek in the first save."
      });
    }
    const auth = await requireRoleForSchool(request, reply, targetSchoolId, "scheduler");
    if (!auth) {
      return;
    }

    const scheduleWeekPayload = payload.scheduleWeek;
    const resolvedSchoolId: string = targetSchoolId;

    const resolvedLabel = scheduleWeekPayload?.label ?? existingWeek?.label ?? null;
    const resolvedStatus = scheduleWeekPayload?.status ?? existingWeek?.status ?? "draft";
    const resolvedStartDate =
      scheduleWeekPayload && Object.prototype.hasOwnProperty.call(scheduleWeekPayload, "startDate")
        ? scheduleWeekPayload.startDate
          ? new Date(scheduleWeekPayload.startDate)
          : null
        : existingWeek?.startDate ?? null;
    const scheduleDaysPayload = Array.isArray(payload.scheduleDays) ? payload.scheduleDays : [];
    const segmentBlocksPayload = Array.isArray(payload.segmentBlocks) ? payload.segmentBlocks : [];
    const staffAssignmentsPayload = Array.isArray(payload.staffAssignments) ? payload.staffAssignments : [];
    const fieldTripEventsPayload = Array.isArray(payload.fieldTripEvents) ? payload.fieldTripEvents : [];
    const auditEventsPayload = Array.isArray(payload.auditEvents) ? payload.auditEvents : [];

    await prisma.$transaction(async (tx: DbTransaction) => {
      await tx.school.upsert({
        where: { id: resolvedSchoolId },
        create: {
          id: resolvedSchoolId,
          name: resolvedSchoolId,
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
          schoolId: resolvedSchoolId,
          label: resolvedLabel,
          status: resolvedStatus,
          startDate: resolvedStartDate
        },
        update: {
          label: resolvedLabel,
          status: resolvedStatus,
          startDate: resolvedStartDate
        }
      });

      if (scheduleDaysPayload.length) {
        for (const day of scheduleDaysPayload) {
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

      if (fieldTripEventsPayload.length) {
        for (const event of fieldTripEventsPayload) {
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

      if (segmentBlocksPayload.length) {
        for (const block of segmentBlocksPayload) {
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

      if (staffAssignmentsPayload.length) {
        const uniqueAssignments = new Map<string, StaffAssignmentPayload>();
        staffAssignmentsPayload.forEach((assignment) => {
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

      if (auditEventsPayload.length) {
        for (const event of auditEventsPayload) {
          await tx.auditEvent.upsert({
            where: { id: event.id },
            create: {
              id: event.id,
              scheduleWeekId: weekId,
              timestamp: new Date(event.timestamp),
              user: auth.displayName,
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
              user: auth.displayName,
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
    // eslint-disable-next-line no-console
    console.error("Failed to start API server:", err);
    server.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

export { buildServer, start };
