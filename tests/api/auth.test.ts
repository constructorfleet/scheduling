/** @jest-environment node */

import {
  createCsrfToken,
  createInviteExpiry,
  createInviteToken,
  createSessionExpiry,
  createSessionToken,
  hashPassword,
  hashInviteToken,
  hashSessionToken,
  normalizeEmail,
  verifyPassword
} from "../../apps/api/src/auth";

describe("auth helpers", () => {
  test("normalizes email values", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  test("hashes and verifies passwords", () => {
    const password = "StrongPassword123!";
    const hash = hashPassword(password);

    expect(hash).not.toBe(password);
    expect(verifyPassword(password, hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  test("creates unique session tokens and hashes", () => {
    const tokenA = createSessionToken();
    const tokenB = createSessionToken();

    expect(tokenA).not.toBe(tokenB);
    expect(hashSessionToken(tokenA)).toHaveLength(64);
    expect(hashSessionToken(tokenA)).not.toBe(hashSessionToken(tokenB));
  });

  test("creates unique invite tokens and hashes", () => {
    const tokenA = createInviteToken();
    const tokenB = createInviteToken();

    expect(tokenA).not.toBe(tokenB);
    expect(hashInviteToken(tokenA)).toHaveLength(64);
    expect(hashInviteToken(tokenA)).not.toBe(hashInviteToken(tokenB));
  });

  test("creates csrf tokens", () => {
    const tokenA = createCsrfToken();
    const tokenB = createCsrfToken();
    expect(tokenA).not.toBe(tokenB);
    expect(tokenA.length).toBeGreaterThan(20);
  });

  test("creates session expiry in the future", () => {
    const now = Date.now();
    const expiresAt = createSessionExpiry().getTime();
    expect(expiresAt).toBeGreaterThan(now);
    expect(expiresAt - now).toBeGreaterThanOrEqual(1000 * 60 * 60 * 11);
    expect(expiresAt - now).toBeLessThanOrEqual(1000 * 60 * 60 * 12 + 5000);
  });

  test("creates invite expiry in the future", () => {
    const now = Date.now();
    const expiresAt = createInviteExpiry().getTime();
    expect(expiresAt).toBeGreaterThan(now);
    expect(expiresAt - now).toBeGreaterThanOrEqual(1000 * 60 * 60 * 71);
    expect(expiresAt - now).toBeLessThanOrEqual(1000 * 60 * 60 * 72 + 5000);
  });
});
