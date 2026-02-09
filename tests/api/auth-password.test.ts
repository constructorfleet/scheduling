/** @jest-environment node */

import { hashPassword } from "../../apps/api/src/auth";
import type { PrismaClient } from "apps/api/generated/prisma-client";

const mockPrisma = {
  session: {
    findUnique: jest.fn()
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn()
  }
};

jest.mock("../../apps/api/src/db", () => ({
  getPrisma: jest.fn(() => mockPrisma as unknown as PrismaClient)
}));

const sendPasswordResetEmail = jest.fn();
const buildPasswordResetUrl = jest.fn((token: string) => `http://localhost:5173/reset-password?token=${token}`);

jest.mock("../../apps/api/src/invitations", () => ({
  buildInviteUrl: jest.fn(),
  sendInviteEmail: jest.fn(),
  buildPasswordResetUrl: (token: string) => buildPasswordResetUrl(token),
  sendPasswordResetEmail: (payload: { to: string; resetUrl: string }) => sendPasswordResetEmail(payload)
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildServer } = require("../../apps/api/src/server") as typeof import("../../apps/api/src/server");

const authCookie = "sched_csrf=csrf-token; sched_session=session-token";

const makeSession = () => ({
  id: "session-1",
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "User",
    isSuperUser: false,
    status: "active",
    memberships: [],
    districtMemberships: []
  }
});

describe("password endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("changes password with current password", async () => {
    mockPrisma.session.findUnique.mockResolvedValue(makeSession());
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: hashPassword("old-password")
    });
    mockPrisma.user.update.mockResolvedValue({ id: "user-1" });

    const server = await buildServer();
    const response = await server.inject({
      method: "PATCH",
      url: "/api/auth/password",
      headers: {
        "x-csrf-token": "csrf-token",
        cookie: authCookie
      },
      payload: {
        currentPassword: "old-password",
        newPassword: "new-password"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalled();
    await server.close();
  });

  test("sends reset email when user exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      status: "active"
    });

    const server = await buildServer();
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/password/forgot",
      payload: { email: "user@example.com" }
    });

    expect(response.statusCode).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalled();
    await server.close();
  });

  test("resets password with token", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      status: "active"
    });
    mockPrisma.user.update.mockResolvedValue({ id: "user-1" });

    const server = await buildServer();
    await server.inject({
      method: "POST",
      url: "/api/auth/password/forgot",
      payload: { email: "user@example.com" }
    });

    const resetCall = sendPasswordResetEmail.mock.calls[0]?.[0];
    const resetUrl = resetCall?.resetUrl as string;
    const token = new URL(resetUrl).searchParams.get("token");

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/password/reset",
      payload: { token, password: "new-password" }
    });

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalled();
    await server.close();
  });
});
