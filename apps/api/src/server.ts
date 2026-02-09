import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import { getPrisma } from "./db";
import { applyDbEnv, isDebugEnabled } from "./config";
import { backupBeforeWrite, startPeriodicBackups } from "./backups";
import { openapiPath } from "./openapi";
import path from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import {
    createCsrfToken,
    createInviteExpiry,
    createInviteToken,
    createSessionExpiry,
    createSessionToken,
    CSRF_COOKIE_NAME,
    hashPassword,
    hashInviteToken,
    hashSessionToken,
    normalizeEmail,
    SESSION_COOKIE_NAME,
    verifyPassword
} from "./auth";
import { buildInviteUrl, buildPasswordResetUrl, sendInviteEmail, sendPasswordResetEmail } from "./invitations";
import {
    canManageDistrict,
    canManageSchoolConfiguration,
    canManageSchoolUsers,
    canReadSchoolSchedule,
    canWriteSchoolSchedule
} from "./access";
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
const DAY_VALUES: DayOfWeek[] = [ "mon", "tue", "wed", "thu", "fri", "sat", "sun" ];
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
        const id = typeof raw.id === "string" && raw.id ? raw.id : `timeoff-${ Date.now() }`;
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
    [ ...days ].map((day) => day.toLowerCase()).sort();

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
    isSuperUser: boolean;
    schoolMemberships: Array<{
        schoolId: string;
        role: Role;
    }>;
    districtMemberships: Array<{
        districtId: string;
        role: Role;
    }>;
};

type PasswordResetPayload = {
    email: string;
    expiresAt: number;
};

const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;
const PASSWORD_RESET_SECRET = process.env.PASSWORD_RESET_SECRET?.trim() || "dev-password-reset-secret";

const encodeResetPayload = (payload: PasswordResetPayload) =>
    Buffer.from(JSON.stringify(payload)).toString("base64url");

const signResetPayload = (encodedPayload: string) =>
    createHmac("sha256", PASSWORD_RESET_SECRET).update(encodedPayload).digest("base64url");

const buildPasswordResetToken = (email: string) => {
    const payload = encodeResetPayload({
        email,
        expiresAt: Date.now() + PASSWORD_RESET_TTL_MS
    });
    const signature = signResetPayload(payload);
    return `${payload}.${signature}`;
};

const verifyPasswordResetToken = (token: string) => {
    const [ payload, signature ] = token.split(".");
    if (!payload || !signature) {
        return null;
    }
    const expected = signResetPayload(payload);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) {
        return null;
    }
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null;
    }
    let decoded: PasswordResetPayload;
    try {
        decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as PasswordResetPayload;
    } catch {
        return null;
    }
    if (!decoded?.email || !decoded?.expiresAt) {
        return null;
    }
    if (decoded.expiresAt <= Date.now()) {
        return null;
    }
    return decoded;
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
        const token = request.cookies[ SESSION_COOKIE_NAME ];
        if (!token) {
            return null;
        }
        const prisma = getPrisma();
        const session = await prisma.session.findUnique({
            where: { tokenHash: hashSessionToken(token) },
            include: {
                user: {
                    include: {
                        memberships: {
                            include: {
                                school: {
                                    select: { districtId: true }
                                }
                            }
                        },
                        districtMemberships: {
                            include: {
                                district: {
                                    select: {
                                        id: true,
                                        schools: {
                                            select: { id: true }
                                        }
                                    }
                                }
                            }
                        }
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
        const rolePriority: Record<Role, number> = {
            school_viewer: 0,
            school_user: 1,
            school_admin: 2,
            district_user: 3,
            district_admin: 4,
            super_user: 5
        };
        const effectiveSchoolRoles = new Map<string, { schoolId: string; role: Role; }>();
        session.user.memberships.forEach((membership) => {
            effectiveSchoolRoles.set(membership.schoolId, {
                schoolId: membership.schoolId,
                role: membership.role
            });
        });
        session.user.districtMemberships.forEach((membership) => {
            membership.district.schools.forEach((school) => {
                const current = effectiveSchoolRoles.get(school.id);
                if (!current || rolePriority[ membership.role ] > rolePriority[ current.role ]) {
                    effectiveSchoolRoles.set(school.id, {
                        schoolId: school.id,
                        role: membership.role
                    });
                }
            });
        });

        return {
            sessionId: session.id,
            userId: session.user.id,
            displayName: session.user.displayName,
            email: session.user.email,
            isSuperUser: session.user.isSuperUser,
            schoolMemberships: Array.from(effectiveSchoolRoles.values()),
            districtMemberships: session.user.districtMemberships.map((membership) => ({
                districtId: membership.districtId,
                role: membership.role
            }))
        };
    };

    const getSchoolDistrictId = async (schoolId: string) => {
        const prisma = getPrisma();
        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { districtId: true }
        });
        return school?.districtId ?? null;
    };

    const requireSchoolAccess = async (
        request: FastifyRequest,
        reply: FastifyReply,
        schoolId: string,
        access: "read_schedule" | "write_schedule" | "manage_users" | "manage_configuration"
    ) => {
        const auth = await resolveAuth(request);
        if (!auth) {
            reply.code(401).send({ message: "Authentication required." });
            return null;
        }

        const districtId = await getSchoolDistrictId(schoolId);
        if (!districtId) {
            reply.code(404).send({ message: "School not found." });
            return null;
        }

        const allowed =
            access === "read_schedule"
                ? canReadSchoolSchedule(auth, schoolId, districtId)
                : access === "write_schedule"
                    ? canWriteSchoolSchedule(auth, schoolId, districtId)
                    : access === "manage_users"
                        ? canManageSchoolUsers(auth, schoolId, districtId)
                        : canManageSchoolConfiguration(auth, schoolId, districtId);

        if (!allowed) {
            reply.code(403).send({ message: "Insufficient access for this school." });
            return null;
        }
        return auth;
    };

    const requireDistrictAdmin = async (
        request: FastifyRequest,
        reply: FastifyReply,
        districtId: string
    ) => {
        const auth = await resolveAuth(request);
        if (!auth) {
            reply.code(401).send({ message: "Authentication required." });
            return null;
        }
        if (!canManageDistrict(auth, districtId)) {
            reply.code(403).send({ message: "Insufficient access for this district." });
            return null;
        }
        return auth;
    };

    const requireSuperUser = async (request: FastifyRequest, reply: FastifyReply) => {
        const auth = await resolveAuth(request);
        if (!auth) {
            reply.code(401).send({ message: "Authentication required." });
            return null;
        }
        if (!auth.isSuperUser) {
            reply.code(403).send({ message: "Super user access required." });
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
        const csrfCookie = request.cookies[ CSRF_COOKIE_NAME ];
        const csrfHeader = request.headers[ "x-csrf-token" ];
        const headerValue = Array.isArray(csrfHeader) ? csrfHeader[ 0 ] : csrfHeader;
        if (!csrfCookie || !headerValue || headerValue !== csrfCookie) {
            reply.code(403).send({ message: "Invalid CSRF token." });
            return false;
        }
        return true;
    };

    const roleToLabel = (role: Role) =>
        role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

    const createInvite = async (payload: {
        email: string;
        displayName?: string;
        role: Role;
        invitedByUserId: string;
        districtId?: string;
        schoolId?: string;
    }) => {
        const prisma = getPrisma();
        const token = createInviteToken();
        const tokenHash = hashInviteToken(token);
        const expiresAt = createInviteExpiry();
        await prisma.userInvite.updateMany({
            where: {
                email: payload.email,
                role: payload.role,
                districtId: payload.districtId ?? null,
                schoolId: payload.schoolId ?? null,
                acceptedAt: null,
                revokedAt: null
            },
            data: {
                revokedAt: new Date()
            }
        });
        const invite = await prisma.userInvite.create({
            data: {
                email: payload.email,
                displayName: payload.displayName ?? null,
                role: payload.role,
                districtId: payload.districtId ?? null,
                schoolId: payload.schoolId ?? null,
                invitedByUserId: payload.invitedByUserId,
                token,
                tokenHash,
                expiresAt
            }
        });
        return { invite, token };
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
            include: {
                memberships: {
                    include: {
                        school: {
                            select: { districtId: true }
                        }
                    }
                },
                districtMemberships: {
                    include: {
                        district: {
                            select: {
                                schools: {
                                    select: { id: true }
                                }
                            }
                        }
                    }
                }
            }
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

        const rolePriority: Record<Role, number> = {
            school_viewer: 0,
            school_user: 1,
            school_admin: 2,
            district_user: 3,
            district_admin: 4,
            super_user: 5
        };
        const effectiveSchoolRoles = new Map<string, { schoolId: string; role: Role; }>();
        user.memberships.forEach((membership) => {
            effectiveSchoolRoles.set(membership.schoolId, {
                schoolId: membership.schoolId,
                role: membership.role
            });
        });
        user.districtMemberships.forEach((membership) => {
            membership.district.schools.forEach((school) => {
                const current = effectiveSchoolRoles.get(school.id);
                if (!current || rolePriority[ membership.role ] > rolePriority[ current.role ]) {
                    effectiveSchoolRoles.set(school.id, {
                        schoolId: school.id,
                        role: membership.role
                    });
                }
            });
        });
        if (user.isSuperUser) {
            const allSchools = await prisma.school.findMany({
                select: { id: true }
            });
            allSchools.forEach((school) => {
                effectiveSchoolRoles.set(school.id, { schoolId: school.id, role: "super_user" });
            });
        }
        const memberships = Array.from(effectiveSchoolRoles.values());
        const targetMembership = requestedSchoolId
            ? memberships.find((membership) => membership.schoolId === requestedSchoolId)
            : memberships[ 0 ];
        const resolvedMembership = targetMembership ?? memberships[ 0 ];

        if (!resolvedMembership && !user.isSuperUser) {
            return reply.code(403).send({ message: "No school access assigned for this user." });
        }

        const token = createSessionToken();
        const csrfToken = createCsrfToken();
        const tokenHash = hashSessionToken(token);
        const expiresAt = createSessionExpiry();
        const userAgent = request.headers[ "user-agent" ] ?? null;

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
                displayName: user.displayName,
                isSuperUser: user.isSuperUser
            },
            currentSchoolId: resolvedMembership?.schoolId ?? null,
            memberships,
            schoolMemberships: memberships,
            districtMemberships: user.districtMemberships.map((membership) => ({
                districtId: membership.districtId,
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

    fastify.get("/api/public/districts", async (_request, reply) => {
        const prisma = getPrisma();
        const districts = await prisma.district.findMany({
            orderBy: { name: "asc" },
            include: {
                schools: {
                    select: {
                        id: true,
                        districtId: true,
                        name: true
                    },
                    orderBy: { name: "asc" }
                }
            }
        });
        return reply.send({ districts });
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
                displayName: auth.displayName,
                isSuperUser: auth.isSuperUser
            },
            memberships: auth.schoolMemberships,
            schoolMemberships: auth.schoolMemberships,
            districtMemberships: auth.districtMemberships
        });
    });

    fastify.patch("/api/auth/profile", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const auth = await resolveAuth(request);
        if (!auth) {
            return reply.code(401).send({ message: "Authentication required." });
        }
        const body = (request.body ?? {}) as { displayName?: string; };
        const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
        if (!displayName) {
            return reply.code(400).send({ message: "Display name is required." });
        }
        const prisma = getPrisma();
        const user = await prisma.user.update({
            where: { id: auth.userId },
            data: { displayName }
        });
        return reply.send({
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName
            }
        });
    });

    fastify.patch("/api/auth/password", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const auth = await resolveAuth(request);
        if (!auth) {
            return reply.code(401).send({ message: "Authentication required." });
        }
        const body = (request.body ?? {}) as { currentPassword?: string; newPassword?: string; };
        const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
        if (!currentPassword || !newPassword) {
            return reply.code(400).send({ message: "currentPassword and newPassword are required." });
        }
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { id: auth.userId } });
        if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
            return reply.code(403).send({ message: "Current password is incorrect." });
        }
        await prisma.user.update({
            where: { id: auth.userId },
            data: { passwordHash: hashPassword(newPassword) }
        });
        return reply.send({ ok: true });
    });

    fastify.post("/api/auth/password/forgot", async (request, reply) => {
        const body = (request.body ?? {}) as { email?: string; };
        const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
        if (!email) {
            return reply.code(400).send({ message: "email is required." });
        }
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { email } });
        if (user && user.status === "active") {
            const token = buildPasswordResetToken(email);
            const resetUrl = buildPasswordResetUrl(token);
            await sendPasswordResetEmail({ to: email, resetUrl });
        }
        return reply.send({ ok: true });
    });

    fastify.post("/api/auth/password/reset", async (request, reply) => {
        const body = (request.body ?? {}) as { token?: string; password?: string; };
        const token = typeof body.token === "string" ? body.token.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!token || !password) {
            return reply.code(400).send({ message: "token and password are required." });
        }
        const payload = verifyPasswordResetToken(token);
        if (!payload) {
            return reply.code(410).send({ message: "Reset token is invalid or expired." });
        }
        const prisma = getPrisma();
        const user = await prisma.user.findUnique({ where: { email: normalizeEmail(payload.email) } });
        if (!user) {
            return reply.code(404).send({ message: "User not found." });
        }
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashPassword(password) }
        });
        return reply.send({ ok: true });
    });

    fastify.get("/api/auth/invites/:token", async (request, reply) => {
        const { token } = request.params as { token: string; };
        const prisma = getPrisma();
        const invite = await prisma.userInvite.findUnique({
            where: { tokenHash: hashInviteToken(token) },
            include: {
                district: true,
                school: true
            }
        });
        if (!invite) {
            return reply.code(404).send({ message: "Invite not found." });
        }
        if (invite.acceptedAt || invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
            return reply.code(410).send({ message: "Invite is no longer valid." });
        }
        return reply.send({
            email: invite.email,
            displayName: invite.displayName,
            role: invite.role,
            districtId: invite.districtId,
            districtName: invite.district?.name ?? null,
            schoolId: invite.schoolId,
            schoolName: invite.school?.name ?? null,
            expiresAt: invite.expiresAt.toISOString()
        });
    });

    fastify.post("/api/auth/invites/accept", async (request, reply) => {
        const body = (request.body ?? {}) as {
            token?: string;
            displayName?: string;
            password?: string;
        };
        const token = typeof body.token === "string" ? body.token.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!token || !password) {
            return reply.code(400).send({ message: "token and password are required." });
        }
        const prisma = getPrisma();
        const invite = await prisma.userInvite.findUnique({
            where: { tokenHash: hashInviteToken(token) }
        });
        if (!invite) {
            return reply.code(404).send({ message: "Invite not found." });
        }
        if (invite.acceptedAt || invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
            return reply.code(410).send({ message: "Invite is no longer valid." });
        }
        const resolvedDisplayName = body.displayName?.trim() || invite.displayName || invite.email;
        const existingUser = await prisma.user.findUnique({
            where: { email: invite.email }
        });
        const user = existingUser
            ? await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    displayName: resolvedDisplayName,
                    passwordHash: hashPassword(password),
                    status: "active"
                }
            })
            : await prisma.user.create({
                data: {
                    email: invite.email,
                    displayName: resolvedDisplayName,
                    passwordHash: hashPassword(password),
                    status: "active"
                }
            });

        if (invite.role === "super_user") {
            await prisma.user.update({
                where: { id: user.id },
                data: { isSuperUser: true }
            });
        } else if (invite.role === "district_admin" || invite.role === "district_user") {
            if (!invite.districtId) {
                return reply.code(400).send({ message: "Invite missing district scope." });
            }
            await prisma.districtMembership.upsert({
                where: {
                    userId_districtId: {
                        userId: user.id,
                        districtId: invite.districtId
                    }
                },
                create: {
                    userId: user.id,
                    districtId: invite.districtId,
                    role: invite.role
                },
                update: {
                    role: invite.role
                }
            });
        } else if (invite.role === "school_admin" || invite.role === "school_user" || invite.role === "school_viewer") {
            if (!invite.schoolId) {
                return reply.code(400).send({ message: "Invite missing school scope." });
            }
            await prisma.schoolMembership.upsert({
                where: {
                    userId_schoolId: {
                        userId: user.id,
                        schoolId: invite.schoolId
                    }
                },
                create: {
                    userId: user.id,
                    schoolId: invite.schoolId,
                    role: invite.role
                },
                update: {
                    role: invite.role
                }
            });
        }

        await prisma.userInvite.update({
            where: { id: invite.id },
            data: { acceptedAt: new Date() }
        });

        return reply.send({ ok: true });
    });

    fastify.post("/api/admin/districts/:districtId/schools", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { districtId } = request.params as { districtId: string; };
        if (!(await requireDistrictAdmin(request, reply, districtId))) {
            return;
        }
        const body = (request.body ?? {}) as {
            id?: string;
            name?: string;
        };
        const schoolId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `school-${ Date.now() }`;
        const schoolName = typeof body.name === "string" && body.name.trim() ? body.name.trim() : schoolId;
        const prisma = getPrisma();
        const school = await prisma.school.upsert({
            where: { id: schoolId },
            create: {
                id: schoolId,
                districtId,
                name: schoolName,
                closedDays: [],
                openerCount: 0,
                closerCount: 0,
                fieldTripStartTime: "09:00",
                fieldTripEndTime: "15:00",
                minimumMedicalDelegated: 0,
                requireCurrentCpr: false
            },
            update: {
                districtId,
                name: schoolName
            }
        });
        return reply.send({ school });
    });

    fastify.get("/api/admin/districts", async (request, reply) => {
        const auth = await resolveAuth(request);
        if (!auth) {
            return reply.code(401).send({ message: "Authentication required." });
        }
        const prisma = getPrisma();
        const districts = auth.isSuperUser
            ? await prisma.district.findMany({
                orderBy: { name: "asc" }
            })
            : await prisma.district.findMany({
                where: {
                    memberships: {
                        some: { userId: auth.userId }
                    }
                },
                orderBy: { name: "asc" }
            });
        return reply.send({ districts });
    });

    fastify.post("/api/admin/districts", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        if (!(await requireSuperUser(request, reply))) {
            return;
        }
        const body = (request.body ?? {}) as {
            id?: string;
            name?: string;
        };
        const districtId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `district-${ Date.now() }`;
        const districtName = typeof body.name === "string" && body.name.trim() ? body.name.trim() : districtId;
        const prisma = getPrisma();
        const district = await prisma.district.upsert({
            where: { id: districtId },
            create: {
                id: districtId,
                name: districtName
            },
            update: {
                name: districtName
            }
        });
        return reply.send({ district });
    });

    fastify.put("/api/admin/districts/:districtId", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { districtId } = request.params as { districtId: string; };
        if (!(await requireSuperUser(request, reply))) {
            return;
        }
        const body = (request.body ?? {}) as {
            name?: string;
        };
        const districtName = typeof body.name === "string" ? body.name.trim() : "";
        if (!districtName) {
            return reply.code(400).send({ message: "name is required." });
        }
        const prisma = getPrisma();
        const district = await prisma.district.update({
            where: { id: districtId },
            data: { name: districtName }
        });
        return reply.send({ district });
    });

    fastify.delete("/api/admin/districts/:districtId", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { districtId } = request.params as { districtId: string; };
        if (!(await requireSuperUser(request, reply))) {
            return;
        }
        const prisma = getPrisma();
        const result = await prisma.district.deleteMany({
            where: { id: districtId }
        });
        if (result.count === 0) {
            return reply.code(404).send({ message: "District not found." });
        }
        return reply.send({ ok: true, deleted: result.count });
    });

    fastify.get("/api/admin/districts/:districtId/schools", async (request, reply) => {
        const { districtId } = request.params as { districtId: string; };
        if (!(await requireDistrictAdmin(request, reply, districtId))) {
            return;
        }
        const prisma = getPrisma();
        const schools = await prisma.school.findMany({
            where: { districtId },
            orderBy: { name: "asc" }
        });
        return reply.send({ schools });
    });

    fastify.delete("/api/admin/districts/:districtId/schools/:schoolId", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { districtId, schoolId } = request.params as { districtId: string; schoolId: string; };
        if (!(await requireDistrictAdmin(request, reply, districtId))) {
            return;
        }
        const prisma = getPrisma();
        const result = await prisma.school.deleteMany({
            where: {
                id: schoolId,
                districtId
            }
        });
        if (result.count === 0) {
            return reply.code(404).send({ message: "School not found." });
        }
        return reply.send({ ok: true, deleted: result.count });
    });

    fastify.put("/api/admin/districts/:districtId/schools/:schoolId", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { districtId, schoolId } = request.params as { districtId: string; schoolId: string; };
        if (!(await requireDistrictAdmin(request, reply, districtId))) {
            return;
        }
        const body = (request.body ?? {}) as {
            name?: string;
        };
        const schoolName = typeof body.name === "string" && body.name.trim() ? body.name.trim() : schoolId;
        const prisma = getPrisma();
        const school = await prisma.school.upsert({
            where: { id: schoolId },
            create: {
                id: schoolId,
                districtId,
                name: schoolName,
                closedDays: [],
                openerCount: 0,
                closerCount: 0,
                fieldTripStartTime: "09:00",
                fieldTripEndTime: "15:00",
                minimumMedicalDelegated: 0,
                requireCurrentCpr: false
            },
            update: {
                districtId,
                name: schoolName
            }
        });
        return reply.send({ school });
    });

    fastify.put("/api/admin/districts/:districtId/memberships", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { districtId } = request.params as { districtId: string; };
        if (!(await requireDistrictAdmin(request, reply, districtId))) {
            return;
        }
        const body = (request.body ?? {}) as {
            email?: string;
            displayName?: string;
            role?: Role;
        };
        const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
        const role = body.role;
        if (!email || !role || ![ "district_admin", "district_user" ].includes(role)) {
            return reply.code(400).send({ message: "email and district role are required." });
        }
        const auth = await resolveAuth(request);
        if (!auth) {
            return reply.code(401).send({ message: "Authentication required." });
        }
        const { invite, token } = await createInvite({
            email,
            displayName: body.displayName?.trim(),
            role,
            districtId,
            invitedByUserId: auth.userId
        });
        const inviteUrl = buildInviteUrl(token);
        const delivery = await sendInviteEmail({
            to: email,
            invitedByName: auth.displayName,
            inviteUrl,
            roleLabel: roleToLabel(role),
            scopeLabel: `District ${ districtId }`
        });
        return reply.send({
            invite: {
                id: invite.id,
                email: invite.email,
                role: invite.role,
                districtId: invite.districtId,
                expiresAt: invite.expiresAt.toISOString(),
                inviteUrl
            },
            delivery
        });
    });

    fastify.put("/api/admin/schools/:schoolId/memberships", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { schoolId } = request.params as { schoolId: string; };
        if (!(await requireSchoolAccess(request, reply, schoolId, "manage_users"))) {
            return;
        }
        const body = (request.body ?? {}) as {
            email?: string;
            displayName?: string;
            role?: Role;
        };
        const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
        const role = body.role;
        if (!email || !role || ![ "school_admin", "school_user", "school_viewer" ].includes(role)) {
            return reply.code(400).send({ message: "email and school role are required." });
        }
        const auth = await resolveAuth(request);
        if (!auth) {
            return reply.code(401).send({ message: "Authentication required." });
        }
        const { invite, token } = await createInvite({
            email,
            displayName: body.displayName?.trim(),
            role,
            schoolId,
            invitedByUserId: auth.userId
        });
        const inviteUrl = buildInviteUrl(token);
        const delivery = await sendInviteEmail({
            to: email,
            invitedByName: auth.displayName,
            inviteUrl,
            roleLabel: roleToLabel(role),
            scopeLabel: `School ${ schoolId }`
        });
        return reply.send({
            invite: {
                id: invite.id,
                email: invite.email,
                role: invite.role,
                schoolId: invite.schoolId,
                expiresAt: invite.expiresAt.toISOString(),
                inviteUrl
            },
            delivery
        });
    });

    fastify.get("/api/admin/districts/:districtId/users", async (request, reply) => {
        const { districtId } = request.params as { districtId: string; };
        if (!(await requireDistrictAdmin(request, reply, districtId))) {
            return;
        }
        const prisma = getPrisma();
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { districtMemberships: { some: { districtId } } },
                    { memberships: { some: { school: { districtId } } } }
                ]
            },
            include: {
                districtMemberships: true,
                memberships: true
            },
            orderBy: { email: "asc" }
        });
        return reply.send({ users });
    });

    fastify.delete("/api/admin/districts/:districtId/users/:userId", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { districtId, userId } = request.params as { districtId: string; userId: string; };
        if (!(await requireDistrictAdmin(request, reply, districtId))) {
            return;
        }
        const prisma = getPrisma();
        const districtResult = await prisma.districtMembership.deleteMany({
            where: {
                districtId,
                userId
            }
        });
        const schoolResult = await prisma.schoolMembership.deleteMany({
            where: {
                userId,
                school: { districtId }
            }
        });
        return reply.send({ ok: true, deleted: districtResult.count + schoolResult.count });
    });

    fastify.get("/api/admin/districts/:districtId/invites", async (request, reply) => {
        const { districtId } = request.params as { districtId: string; };
        if (!(await requireDistrictAdmin(request, reply, districtId))) {
            return;
        }
        const prisma = getPrisma();
        const invites = await prisma.userInvite.findMany({
            where: {
                OR: [
                    { districtId },
                    { school: { districtId } }
                ]
            },
            include: {
                district: {
                    select: { id: true, name: true }
                },
                school: {
                    select: { id: true, name: true }
                },
                invitedBy: {
                    select: { id: true, email: true, displayName: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });
        return reply.send({
            invites: invites.map((invite) => ({
                id: invite.id,
                email: invite.email,
                displayName: invite.displayName,
                role: invite.role,
                districtId: invite.districtId,
                districtName: invite.district?.name ?? null,
                schoolId: invite.schoolId,
                schoolName: invite.school?.name ?? null,
                invitedBy: invite.invitedBy,
                createdAt: invite.createdAt.toISOString(),
                expiresAt: invite.expiresAt.toISOString(),
                acceptedAt: invite.acceptedAt?.toISOString() ?? null,
                revokedAt: invite.revokedAt?.toISOString() ?? null,
                inviteUrl: invite.token ? buildInviteUrl(invite.token) : null
            }))
        });
    });

    fastify.get("/api/admin/schools/:schoolId/users", async (request, reply) => {
        const { schoolId } = request.params as { schoolId: string; };
        if (!(await requireSchoolAccess(request, reply, schoolId, "manage_users"))) {
            return;
        }
        const prisma = getPrisma();
        const users = await prisma.user.findMany({
            where: {
                memberships: {
                    some: { schoolId }
                }
            },
            include: {
                memberships: {
                    where: { schoolId }
                }
            },
            orderBy: { email: "asc" }
        });
        return reply.send({ users });
    });

    fastify.delete("/api/admin/schools/:schoolId/users/:userId", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { schoolId, userId } = request.params as { schoolId: string; userId: string; };
        if (!(await requireSchoolAccess(request, reply, schoolId, "manage_users"))) {
            return;
        }
        const prisma = getPrisma();
        const result = await prisma.schoolMembership.deleteMany({
            where: {
                schoolId,
                userId
            }
        });
        return reply.send({ ok: true, deleted: result.count });
    });

    fastify.get("/api/admin/schools/:schoolId/invites", async (request, reply) => {
        const { schoolId } = request.params as { schoolId: string; };
        if (!(await requireSchoolAccess(request, reply, schoolId, "manage_users"))) {
            return;
        }
        const prisma = getPrisma();
        const invites = await prisma.userInvite.findMany({
            where: { schoolId },
            include: {
                school: {
                    select: { id: true, name: true }
                },
                invitedBy: {
                    select: { id: true, email: true, displayName: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });
        return reply.send({
            invites: invites.map((invite) => ({
                id: invite.id,
                email: invite.email,
                displayName: invite.displayName,
                role: invite.role,
                schoolId: invite.schoolId,
                schoolName: invite.school?.name ?? null,
                invitedBy: invite.invitedBy,
                createdAt: invite.createdAt.toISOString(),
                expiresAt: invite.expiresAt.toISOString(),
                acceptedAt: invite.acceptedAt?.toISOString() ?? null,
                revokedAt: invite.revokedAt?.toISOString() ?? null,
                inviteUrl: invite.token ? buildInviteUrl(invite.token) : null
            }))
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
        const pathOnly = url.split("?")[ 0 ];
        if (pathOnly.includes(".")) {
            return reply.sendFile(pathOnly.replace(/^\//, ""));
        }
        return reply.sendFile("index.html");
    });

    fastify.get("/api/settings/:schoolId", async (request, reply) => {
        const { schoolId } = request.params as { schoolId: string; };
        if (!(await requireSchoolAccess(request, reply, schoolId, "read_schedule"))) {
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
        const { schoolId } = request.params as { schoolId: string; };
        if (!(await requireSchoolAccess(request, reply, schoolId, "manage_configuration"))) {
            return;
        }
        const payload = request.body as {
            school?: {
                name: string;
                closedDays: string[];
                openerCount: number;
                closerCount: number;
                fieldTripStartTime: string;
                fieldTripEndTime: string;
                minimumMedicalDelegated: number;
                requireCurrentCpr: boolean;
            };
            scheduleTypes?: Array<{
                value: string;
                label: string;
                ratio: { adults: number; students: number; };
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
                email?: string;
                phone?: string;
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
            await tx.district.upsert({
                where: { id: "district-default" },
                create: {
                    id: "district-default",
                    name: "Default District"
                },
                update: {}
            });
            let upsertedSchool = await tx.school.findUnique({ where: { id: schoolId } });
            if (payload.school) {
                upsertedSchool = await tx.school.upsert({
                    where: { id: schoolId },
                    create: {
                        id: schoolId,
                        districtId: upsertedSchool?.districtId ?? "district-default",
                        name: payload.school.name,
                        closedDays: payload.school.closedDays,
                        openerCount: payload.school.openerCount,
                        closerCount: payload.school.closerCount,
                        fieldTripStartTime: payload.school.fieldTripStartTime,
                        fieldTripEndTime: payload.school.fieldTripEndTime,
                        minimumMedicalDelegated: payload.school.minimumMedicalDelegated,
                        requireCurrentCpr: payload.school.requireCurrentCpr
                    },
                    update: {
                        name: payload.school.name,
                        closedDays: payload.school.closedDays,
                        openerCount: payload.school.openerCount,
                        closerCount: payload.school.closerCount,
                        fieldTripStartTime: payload.school.fieldTripStartTime,
                        fieldTripEndTime: payload.school.fieldTripEndTime,
                        minimumMedicalDelegated: payload.school.minimumMedicalDelegated,
                        requireCurrentCpr: payload.school.requireCurrentCpr
                    }
                });
            }
            if (!upsertedSchool) {
                upsertedSchool = await tx.school.create({
                    data: {
                        id: schoolId,
                        districtId: "district-default",
                        name: schoolId,
                        closedDays: [],
                        openerCount: 0,
                        closerCount: 0,
                        fieldTripStartTime: "09:00",
                        fieldTripEndTime: "15:00",
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
                const existingById = new Map(existingEmployees.map((employee) => [ employee.id, employee ]));
                const existingByStableKey = new Map<string, string[]>();

                existingEmployees.forEach((employee) => {
                    const key = `${ employee.name.trim().toLowerCase() }::${ employee.jobTitle.trim().toLowerCase() }`;
                    const ids = existingByStableKey.get(key) ?? [];
                    ids.push(employee.id);
                    existingByStableKey.set(key, ids);
                });

                for (const employee of payload.employees) {
                    const stableKey = `${ employee.name.trim().toLowerCase() }::${ employee.jobTitle.trim().toLowerCase() }`;
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
                                email: employee.email ?? null,
                                phone: employee.phone ?? null,
                                jobTitle: employee.jobTitle,
                                maxHoursPerDay: employee.maxHoursPerDay,
                                maxHoursPerWeek: employee.maxHoursPerWeek,
                                employmentStatus: employee.employmentStatus,
                                medicallyDelegated: employee.medicallyDelegated,
                                cprCurrent: employee.cprCurrent,
                                notes: employee.notes ?? null,
                                availability: toJsonValue(normalizeAvailability(employee.availability)),
                                requestedDaysOff: toJsonValue(normalizeRequestedDaysOff(employee.requestedDaysOff))
                            } as CorePrisma.EmployeeUncheckedUpdateInput
                        });
                        continue;
                    }

                    const created = await tx.employee.create({
                        data: {
                            id: employee.id,
                            schoolId,
                            name: employee.name,
                            email: employee.email ?? null,
                            phone: employee.phone ?? null,
                            jobTitle: employee.jobTitle,
                            maxHoursPerDay: employee.maxHoursPerDay,
                            maxHoursPerWeek: employee.maxHoursPerWeek,
                            employmentStatus: employee.employmentStatus,
                            medicallyDelegated: employee.medicallyDelegated,
                            cprCurrent: employee.cprCurrent,
                            notes: employee.notes ?? null,
                            availability: toJsonValue(normalizeAvailability(employee.availability)),
                            requestedDaysOff: toJsonValue(normalizeRequestedDaysOff(employee.requestedDaysOff))
                        } as CorePrisma.EmployeeUncheckedCreateInput
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
        const { weekId } = request.params as { weekId: string; };
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
            return reply.code(404).send({ message: `Schedule week ${ weekId } not found` });
        }
        if (!(await requireSchoolAccess(request, reply, scheduleWeek.schoolId, "read_schedule"))) {
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

    fastify.get("/api/schedule/:weekId/employee-view", async (request, reply) => {
        const { weekId } = request.params as { weekId: string; };
        const prisma = getPrisma();
        const scheduleWeek = await prisma.scheduleWeek.findUnique({
            where: { id: weekId },
            include: {
                scheduleDays: true,
                segmentBlocks: true,
                staffAssignments: true
            }
        });
        if (!scheduleWeek) {
            return reply.code(404).send({ message: `Schedule week ${ weekId } not found` });
        }
        if (!(await requireSchoolAccess(request, reply, scheduleWeek.schoolId, "read_schedule"))) {
            return;
        }

        const employees = await prisma.employee.findMany({
            where: { schoolId: scheduleWeek.schoolId },
            select: { id: true, name: true },
            orderBy: { name: "asc" }
        });

        return {
            weekId: scheduleWeek.id,
            scheduleDays: scheduleWeek.scheduleDays.map((day) => ({
                id: day.id,
                dayOfWeek: day.dayOfWeek,
                date: day.date ? day.date.toISOString() : null,
                scheduleType: day.scheduleType ?? null,
                dayScheduleType: day.dayScheduleType ?? null
            })),
            segmentBlocks: scheduleWeek.segmentBlocks.map((block) => ({
                id: block.id,
                dayOfWeek: block.dayOfWeek,
                segment: block.segment,
                startTime: block.startTime,
                endTime: block.endTime
            })),
            staffAssignments: scheduleWeek.staffAssignments.map((assignment) => ({
                id: assignment.id,
                segmentBlockId: assignment.segmentBlockId,
                employeeId: assignment.employeeId,
                startTime: assignment.startTime,
                endTime: assignment.endTime
            })),
            employees
        };
    });

    fastify.delete("/api/schedule/:weekId/staff-assignments", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { weekId } = request.params as { weekId: string; };
        const prisma = getPrisma();
        const scheduleWeek = await prisma.scheduleWeek.findUnique({
            where: { id: weekId },
            select: { schoolId: true }
        });
        if (!scheduleWeek) {
            return reply.code(404).send({ message: `Schedule week ${ weekId } not found` });
        }
        if (!(await requireSchoolAccess(request, reply, scheduleWeek.schoolId, "write_schedule"))) {
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

    fastify.delete("/api/schedule/:weekId/staff-assignments/:assignmentId", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { weekId, assignmentId } = request.params as { weekId: string; assignmentId: string; };
        const prisma = getPrisma();
        const assignment = await prisma.staffAssignment.findUnique({
            where: { id: assignmentId },
            select: { id: true, scheduleWeekId: true, segmentBlockId: true }
        });
        if (!assignment || assignment.scheduleWeekId !== weekId) {
            return reply.send({ ok: true, deleted: 0 });
        }
        const scheduleWeek = await prisma.scheduleWeek.findUnique({
            where: { id: weekId },
            select: { schoolId: true }
        });
        if (!scheduleWeek) {
            return reply.send({ ok: true, deleted: 0 });
        }
        const auth = await requireSchoolAccess(request, reply, scheduleWeek.schoolId, "write_schedule");
        if (!auth) {
            return;
        }
        const deleted = await prisma.$transaction(async (tx: DbTransaction) => {
            const result = await tx.staffAssignment.delete({ where: { id: assignmentId } });
            const remaining = await tx.staffAssignment.count({
                where: { segmentBlockId: assignment.segmentBlockId }
            });
            if (remaining === 0) {
                await tx.segmentBlock.deleteMany({ where: { id: assignment.segmentBlockId } });
            }
            return result;
        });
        return reply.send({ ok: true, deleted: deleted ? 1 : 0 });
    });

    fastify.put("/api/schedule/:weekId", async (request, reply) => {
        if (!requireCsrf(request, reply)) {
            return;
        }
        const { weekId } = request.params as { weekId: string; };
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
        const auth = await requireSchoolAccess(request, reply, targetSchoolId, "write_schedule");
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
        const segmentBlocksPayload: SegmentBlockPayload[] = Array.isArray(payload.segmentBlocks)
            ? payload.segmentBlocks
            : [];
        const staffAssignmentsPayload: StaffAssignmentPayload[] = Array.isArray(payload.staffAssignments)
            ? payload.staffAssignments
            : [];
        const fieldTripEventsPayload = Array.isArray(payload.fieldTripEvents) ? payload.fieldTripEvents : [];
        const auditEventsPayload = Array.isArray(payload.auditEvents) ? payload.auditEvents : [];

        await prisma.$transaction(async (tx: DbTransaction) => {
            await tx.district.upsert({
                where: { id: "district-default" },
                create: {
                    id: "district-default",
                    name: "Default District"
                },
                update: {}
            });
            await tx.school.upsert({
                where: { id: resolvedSchoolId },
                create: {
                    id: resolvedSchoolId,
                    districtId: "district-default",
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
            console.log(`API listening on http://${ host }:${ port }`);
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
