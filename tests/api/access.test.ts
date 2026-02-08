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

  test("allows super user everywhere", () => {
    const superAuth = {
      isSuperUser: true,
      schoolMemberships: [],
      districtMemberships: []
    };
    expect(canReadSchoolSchedule(superAuth, "school-x", "district-x")).toBe(true);
    expect(canWriteSchoolSchedule(superAuth, "school-x", "district-x")).toBe(true);
    expect(canManageSchoolUsers(superAuth, "school-x", "district-x")).toBe(true);
    expect(canManageSchoolConfiguration(superAuth, "school-x", "district-x")).toBe(true);
    expect(canManageDistrict(superAuth, "district-x")).toBe(true);
  });

  test("district user can manage school users but not school config", () => {
    const districtUser = {
      isSuperUser: false,
      schoolMemberships: [],
      districtMemberships: [{ districtId: "district-a", role: "district_user" as const }]
    };
    expect(canManageSchoolUsers(districtUser, "school-z", "district-a")).toBe(true);
    expect(canManageSchoolConfiguration(districtUser, "school-z", "district-a")).toBe(false);
  });

  test("school user can schedule but cannot manage users/config", () => {
    const schoolUser = {
      isSuperUser: false,
      schoolMemberships: [{ schoolId: "school-a", role: "school_user" as const }],
      districtMemberships: []
    };
    expect(canReadSchoolSchedule(schoolUser, "school-a", "district-a")).toBe(true);
    expect(canWriteSchoolSchedule(schoolUser, "school-a", "district-a")).toBe(true);
    expect(canManageSchoolUsers(schoolUser, "school-a", "district-a")).toBe(false);
    expect(canManageSchoolConfiguration(schoolUser, "school-a", "district-a")).toBe(false);
  });
});
