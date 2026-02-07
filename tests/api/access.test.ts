/** @jest-environment node */

import { canAccessSchoolWithRole, getSchoolMembership, hasRequiredRole } from "../../apps/api/src/access";

describe("access controls", () => {
  test("enforces role hierarchy", () => {
    expect(hasRequiredRole("owner", "viewer")).toBe(true);
    expect(hasRequiredRole("director", "scheduler")).toBe(true);
    expect(hasRequiredRole("scheduler", "director")).toBe(false);
    expect(hasRequiredRole("viewer", "viewer")).toBe(true);
  });

  test("resolves membership per school", () => {
    const auth = {
      memberships: [
        { schoolId: "school-a", role: "viewer" as const },
        { schoolId: "school-b", role: "director" as const }
      ]
    };
    expect(getSchoolMembership(auth, "school-b")).toEqual({ schoolId: "school-b", role: "director" });
    expect(getSchoolMembership(auth, "school-c")).toBeNull();
  });

  test("checks school scope and role together", () => {
    const auth = {
      memberships: [
        { schoolId: "school-a", role: "scheduler" as const },
        { schoolId: "school-b", role: "viewer" as const }
      ]
    };
    expect(canAccessSchoolWithRole(auth, "school-a", "viewer")).toBe(true);
    expect(canAccessSchoolWithRole(auth, "school-a", "scheduler")).toBe(true);
    expect(canAccessSchoolWithRole(auth, "school-a", "director")).toBe(false);
    expect(canAccessSchoolWithRole(auth, "school-c", "viewer")).toBe(false);
  });
});
