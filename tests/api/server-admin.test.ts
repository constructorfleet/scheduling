/** @jest-environment node */
import {
    type District,
    type DistrictMembership,
    type PrismaClient,
    type School,
    type SchoolMembership,
    type Session,
    type User,
    type UserInvite
} from "apps/api/generated/prisma-client";
import { hashPassword } from "../../apps/api/src/auth";

const mockPrisma = {
    session: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn()
    },
    school: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn()
    },
    districtMembership: {
        upsert: jest.fn()
    },
    district: {
        upsert: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
    },
    schoolMembership: {
        upsert: jest.fn()
    },
    userInvite: {
        updateMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
    },
    user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
    }
};

type InviteWithRelations = UserInvite & {
    district: District | null;
    school: School | null;
    invitedBy: User;
};

type SchoolMembershipWithSchool = SchoolMembership & {
    school: { districtId: string };
};

type DistrictWithSchools = District & {
    schools: Array<{ id: string }>;
};

type DistrictMembershipWithDistrict = DistrictMembership & {
    district: DistrictWithSchools;
};

type SessionWithUser = Session & {
    user: User & {
        memberships: SchoolMembershipWithSchool[];
        districtMemberships: DistrictMembershipWithDistrict[];
    };
};


jest.mock("../../apps/api/src/db", () => ({
    getPrisma: jest.fn(() => mockPrisma as unknown as PrismaClient)
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildServer } = require("../../apps/api/src/server") as typeof import("../../apps/api/src/server");

const authCookie = "sched_csrf=csrf-token; sched_session=session-token";

const makeSession = (options?: {
    isSuperUser?: boolean;
    schoolRole?: "school_admin" | "school_user";
    districtRole?: "district_admin" | "district_user";
    districtId?: string;
}): SessionWithUser => {
    const districtId = options?.districtId ?? "district-1";
    return {
        id: "session-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        user: {
            id: "user-1",
            email: "admin@example.com",
            displayName: "Admin",
            status: "active",
            isSuperUser: Boolean(options?.isSuperUser),
            memberships: options?.schoolRole
                ? [
                    {
                        schoolId: "school-1",
                        role: options.schoolRole,
                        school: { districtId }
                    }
                ]
                : [],
            districtMemberships: options?.districtRole
                ? [
                    {
                        districtId,
                        role: options.districtRole,
                        district: {
                            id: districtId,
                            schools: [ { id: "school-1" } ]
                        }
                    }
                ]
                : []
        }
    } as SessionWithUser;
};

describe("server admin and invite routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.school.findUnique.mockResolvedValue({ districtId: "district-1" });
        mockPrisma.school.upsert.mockResolvedValue({ id: "school-2", districtId: "district-1", name: "School Two" });
        mockPrisma.school.findMany.mockResolvedValue([ { id: "school-1", districtId: "district-1", name: "School One" } ]);
        mockPrisma.district.upsert.mockResolvedValue({ id: "district-2", name: "District Two" });
        mockPrisma.district.update.mockResolvedValue({ id: "district-1", name: "District One Updated" });
        mockPrisma.district.findMany.mockResolvedValue([ { id: "district-1", name: "District One" } ]);
        mockPrisma.userInvite.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.userInvite.create.mockResolvedValue({
            id: "invite-1",
            email: "teacher@example.com",
            role: "school_user",
            token: "invite-token-1",
            schoolId: "school-1",
            districtId: null,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
        mockPrisma.userInvite.findMany.mockResolvedValue([
            {
                id: "invite-1",
                email: "teacher@example.com",
                displayName: "Teacher",
                role: "school_user",
                token: "invite-token-1",
                districtId: null,
                schoolId: "school-1",
                createdAt: new Date(Date.now() - 1000),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                acceptedAt: null,
                revokedAt: null,
                district: null,
                school: { id: "school-1", name: "School One" },
                invitedBy: { id: "user-1", email: "admin@example.com", displayName: "Admin" }
            }
        ] as InviteWithRelations[]);
        mockPrisma.user.findUnique.mockResolvedValue({
            id: "user-2",
            email: "teacher@example.com",
            displayName: "Teacher",
            status: "active",
            isSuperUser: false
        });
        mockPrisma.user.update.mockResolvedValue({
            id: "user-2",
            email: "teacher@example.com",
            displayName: "Teacher",
            status: "active",
            isSuperUser: false
        });
        mockPrisma.schoolMembership.upsert.mockResolvedValue({
            id: "sm-1",
            schoolId: "school-1",
            userId: "user-2",
            role: "school_user"
        });
    });

    test("falls back to first school when login school is not assigned", async () => {
        const password = "SecurePass123!";
        mockPrisma.user.findUnique.mockResolvedValue({
            id: "user-9",
            email: "teacher@example.com",
            displayName: "Teacher",
            status: "active",
            isSuperUser: false,
            passwordHash: hashPassword(password),
            failedLoginAttempts: 0,
            lockoutUntil: null,
            memberships: [
                {
                    schoolId: "school-1",
                    role: "school_user",
                    school: { districtId: "district-1" }
                }
            ],
            districtMemberships: []
        });
        mockPrisma.session.updateMany.mockResolvedValue({ count: 0 });
        mockPrisma.session.create.mockResolvedValue({ id: "session-1" });
        mockPrisma.user.update.mockResolvedValue({
            id: "user-9",
            email: "teacher@example.com",
            displayName: "Teacher",
            status: "active",
            isSuperUser: false
        });

        const server = await buildServer();
        const response = await server.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: {
                email: "teacher@example.com",
                password,
                schoolId: "school-2"
            }
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as { currentSchoolId: string | null };
        expect(payload.currentSchoolId).toBe("school-1");
        await server.close();
    });

    test("requires csrf for district school creation", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ districtRole: "district_admin" }));
        const server = await buildServer();
        const response = await server.inject({
            method: "POST",
            url: "/api/admin/districts/district-1/schools",
            headers: {
                cookie: "sched_session=session-token"
            },
            payload: { id: "school-2", name: "School Two" }
        });
        expect(response.statusCode).toBe(403);
        await server.close();
    });

    test("allows district admin to add a school to district", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ districtRole: "district_admin" }));
        const server = await buildServer();
        const response = await server.inject({
            method: "POST",
            url: "/api/admin/districts/district-1/schools",
            headers: {
                "x-csrf-token": "csrf-token",
                cookie: authCookie
            },
            payload: { id: "school-2", name: "School Two" }
        });
        expect(response.statusCode).toBe(200);
        expect(mockPrisma.school.upsert).toHaveBeenCalled();
        await server.close();
    });

    test("forbids district user from adding district schools", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ districtRole: "district_user" }));
        const server = await buildServer();
        const response = await server.inject({
            method: "POST",
            url: "/api/admin/districts/district-1/schools",
            headers: {
                "x-csrf-token": "csrf-token",
                cookie: authCookie
            },
            payload: { id: "school-2", name: "School Two" }
        });
        expect(response.statusCode).toBe(403);
        await server.close();
    });

    test("school admin user management creates an invite", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ schoolRole: "school_admin" }));
        const server = await buildServer();
        const response = await server.inject({
            method: "PUT",
            url: "/api/admin/schools/school-1/memberships",
            headers: {
                "x-csrf-token": "csrf-token",
                cookie: authCookie
            },
            payload: {
                email: "teacher@example.com",
                role: "school_user"
            }
        });
        expect(response.statusCode).toBe(200);
        expect(mockPrisma.userInvite.create).toHaveBeenCalled();
        const body = response.json();
        expect(body.invite.inviteUrl).toContain("token=");
        await server.close();
    });

    test("district admin user management creates an invite", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ districtRole: "district_admin" }));
        const server = await buildServer();
        const response = await server.inject({
            method: "PUT",
            url: "/api/admin/districts/district-1/memberships",
            headers: {
                "x-csrf-token": "csrf-token",
                cookie: authCookie
            },
            payload: {
                email: "teacher@example.com",
                role: "district_user"
            }
        });
        expect(response.statusCode).toBe(200);
        expect(mockPrisma.userInvite.create).toHaveBeenCalled();
        const body = response.json();
        expect(body.invite.inviteUrl).toContain("token=");
        await server.close();
    });

    test("forbids school user from creating school invites", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ schoolRole: "school_user" }));
        const server = await buildServer();
        const response = await server.inject({
            method: "PUT",
            url: "/api/admin/schools/school-1/memberships",
            headers: {
                "x-csrf-token": "csrf-token",
                cookie: authCookie
            },
            payload: {
                email: "teacher@example.com",
                role: "school_user"
            }
        });
        expect(response.statusCode).toBe(403);
        await server.close();
    });

    test("accepting invite applies school membership", async () => {
        mockPrisma.userInvite.findUnique.mockResolvedValue({
            id: "invite-accept-1",
            email: "teacher@example.com",
            displayName: "Teacher",
            role: "school_user",
            schoolId: "school-1",
            districtId: null,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        });
        const server = await buildServer();
        const response = await server.inject({
            method: "POST",
            url: "/api/auth/invites/accept",
            payload: {
                token: "token-123",
                password: "SecretPass123!"
            }
        });
        expect(response.statusCode).toBe(200);
        expect(mockPrisma.schoolMembership.upsert).toHaveBeenCalled();
        expect(mockPrisma.userInvite.update).toHaveBeenCalled();
        await server.close();
    });

    test("district admin can list invites with invite links", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ districtRole: "district_admin" }));
        const server = await buildServer();
        const response = await server.inject({
            method: "GET",
            url: "/api/admin/districts/district-1/invites",
            headers: {
                cookie: "sched_session=session-token"
            }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(Array.isArray(body.invites)).toBe(true);
        expect(body.invites[ 0 ].inviteUrl).toContain("token=");
        await server.close();
    });

    test("school admin can list invites with invite links", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ schoolRole: "school_admin" }));
        const server = await buildServer();
        const response = await server.inject({
            method: "GET",
            url: "/api/admin/schools/school-1/invites",
            headers: {
                cookie: "sched_session=session-token"
            }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(Array.isArray(body.invites)).toBe(true);
        expect(body.invites[ 0 ].inviteUrl).toContain("token=");
        await server.close();
    });

    test("super user can create and update districts", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ isSuperUser: true }));
        const server = await buildServer();
        const createResponse = await server.inject({
            method: "POST",
            url: "/api/admin/districts",
            headers: {
                "x-csrf-token": "csrf-token",
                cookie: authCookie
            },
            payload: { id: "district-2", name: "District Two" }
        });
        expect(createResponse.statusCode).toBe(200);
        expect(mockPrisma.district.upsert).toHaveBeenCalled();

        const updateResponse = await server.inject({
            method: "PUT",
            url: "/api/admin/districts/district-1",
            headers: {
                "x-csrf-token": "csrf-token",
                cookie: authCookie
            },
            payload: { name: "District One Updated" }
        });
        expect(updateResponse.statusCode).toBe(200);
        expect(mockPrisma.district.update).toHaveBeenCalled();
        await server.close();
    });

    test("district admin cannot create districts", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ districtRole: "district_admin" }));
        const server = await buildServer();
        const response = await server.inject({
            method: "POST",
            url: "/api/admin/districts",
            headers: {
                "x-csrf-token": "csrf-token",
                cookie: authCookie
            },
            payload: { id: "district-2", name: "District Two" }
        });
        expect(response.statusCode).toBe(403);
        await server.close();
    });

    test("district admin can list and update district schools", async () => {
        mockPrisma.session.findUnique.mockResolvedValue(makeSession({ districtRole: "district_admin" }));
        const server = await buildServer();
        const listResponse = await server.inject({
            method: "GET",
            url: "/api/admin/districts/district-1/schools",
            headers: {
                cookie: "sched_session=session-token"
            }
        });
        expect(listResponse.statusCode).toBe(200);
        expect(mockPrisma.school.findMany).toHaveBeenCalled();

        const updateResponse = await server.inject({
            method: "PUT",
            url: "/api/admin/districts/district-1/schools/school-2",
            headers: {
                "x-csrf-token": "csrf-token",
                cookie: authCookie
            },
            payload: { name: "School Two Updated" }
        });
        expect(updateResponse.statusCode).toBe(200);
        expect(mockPrisma.school.upsert).toHaveBeenCalled();
        await server.close();
    });
});
