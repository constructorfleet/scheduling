/** @jest-environment node */

const mockPrisma: any = {
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
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn()
  }
};

jest.mock("../../apps/api/src/db", () => ({
  getPrisma: jest.fn(() => mockPrisma)
}));

const { buildServer } = require("../../apps/api/src/server") as typeof import("../../apps/api/src/server");

const authCookie = "sched_csrf=csrf-token; sched_session=session-token";

const makeSession = (options?: {
  isSuperUser?: boolean;
  schoolRole?: "school_admin" | "school_user";
  districtRole?: "district_admin" | "district_user";
  districtId?: string;
}) => {
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
                schools: [{ id: "school-1" }]
              }
            }
          ]
        : []
    }
  };
};

describe("server admin routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.school.findUnique.mockResolvedValue({ districtId: "district-1" });
    mockPrisma.school.upsert.mockResolvedValue({ id: "school-2", districtId: "district-1", name: "School Two" });
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
    mockPrisma.schoolMembership = {
      upsert: jest.fn().mockResolvedValue({
        id: "sm-1",
        schoolId: "school-1",
        userId: "user-2",
        role: "school_user"
      })
    };
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

  test("allows school admin to assign school users", async () => {
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
    expect(mockPrisma.schoolMembership.upsert).toHaveBeenCalled();
    await server.close();
  });

  test("forbids school user from assigning school users", async () => {
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
});
