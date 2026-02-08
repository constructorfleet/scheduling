/** @jest-environment node */

import {
  canManageDistrict,
  canManageSchoolConfiguration,
  canManageSchoolUsers,
  canReadSchoolSchedule,
  canWriteSchoolSchedule,
  getDistrictMembership,
  getSchoolMembership
} from "../../apps/api/src/access";

describe("access controls", () => {
  const auth = {
    isSuperUser: false,
    schoolMemberships: [{ schoolId: "school-a", role: "school_admin" as const }],
    districtMemberships: [{ districtId: "district-a", role: "district_user" as const }]
  };

  test("resolves membership per school", () => {
    expect(getSchoolMembership(auth, "school-a")).toEqual({ schoolId: "school-a", role: "school_admin" });
    expect(getSchoolMembership(auth, "school-c")).toBeNull();
  });

  test("resolves membership per district", () => {
    expect(getDistrictMembership(auth, "district-a")).toEqual({ districtId: "district-a", role: "district_user" });
    expect(getDistrictMembership(auth, "district-b")).toBeNull();
  });

  test("checks school and district access", () => {
    expect(canReadSchoolSchedule(auth, "school-a", "district-a")).toBe(true);
    expect(canWriteSchoolSchedule(auth, "school-a", "district-a")).toBe(true);
    expect(canManageSchoolUsers(auth, "school-a", "district-a")).toBe(true);
    expect(canManageSchoolConfiguration(auth, "school-a", "district-a")).toBe(true);
    expect(canManageDistrict(auth, "district-a")).toBe(false);
  });
});
