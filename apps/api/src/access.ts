import type { Role } from "../generated/prisma-client";

type SchoolMembership = {
    schoolId: string;
    role: Role;
};

type DistrictMembership = {
    districtId: string;
    role: Role;
};

type AuthLike = {
    isSuperUser: boolean;
    schoolMemberships: SchoolMembership[];
    districtMemberships: DistrictMembership[];
};

const hasRoleIn = (role: Role, allowed: Role[]) => allowed.includes(role);

export const getSchoolMembership = (auth: AuthLike, schoolId: string) =>
    auth.schoolMemberships.find((membership) => membership.schoolId === schoolId) ?? null;

export const getDistrictMembership = (auth: AuthLike, districtId: string) =>
    auth.districtMemberships.find((membership) => membership.districtId === districtId) ?? null;

export const canReadDistrict = (auth: AuthLike, districtId: string) => {
    if (auth.isSuperUser) {
        return true;
    }
    const membership = getDistrictMembership(auth, districtId);
    return Boolean(membership && hasRoleIn(membership.role, [ "district_admin", "district_user" ]));
};

export const canManageDistrict = (auth: AuthLike, districtId: string) => {
    if (auth.isSuperUser) {
        return true;
    }
    const membership = getDistrictMembership(auth, districtId);
    return Boolean(membership && membership.role === "district_admin");
};

export const canReadSchoolSchedule = (auth: AuthLike, schoolId: string, districtId: string) => {
    if (auth.isSuperUser) {
        return true;
    }
    const schoolMembership = getSchoolMembership(auth, schoolId);
    if (schoolMembership && hasRoleIn(schoolMembership.role, [ "school_admin", "school_user", "school_viewer" ])) {
        return true;
    }
    const districtMembership = getDistrictMembership(auth, districtId);
    return Boolean(districtMembership && hasRoleIn(districtMembership.role, [ "district_admin", "district_user" ]));
};

export const canWriteSchoolSchedule = (auth: AuthLike, schoolId: string, districtId: string) => {
    if (auth.isSuperUser) {
        return true;
    }
    const schoolMembership = getSchoolMembership(auth, schoolId);
    if (schoolMembership && hasRoleIn(schoolMembership.role, [ "school_admin", "school_user" ])) {
        return true;
    }
    const districtMembership = getDistrictMembership(auth, districtId);
    return Boolean(districtMembership && hasRoleIn(districtMembership.role, [ "district_admin", "district_user" ]));
};

export const canManageSchoolUsers = (auth: AuthLike, schoolId: string, districtId: string) => {
    if (auth.isSuperUser) {
        return true;
    }
    const schoolMembership = getSchoolMembership(auth, schoolId);
    if (schoolMembership?.role === "school_admin") {
        return true;
    }
    const districtMembership = getDistrictMembership(auth, districtId);
    return Boolean(districtMembership && hasRoleIn(districtMembership.role, [ "district_admin", "district_user" ]));
};

export const canManageSchoolConfiguration = (auth: AuthLike, schoolId: string, districtId: string) => {
    if (auth.isSuperUser) {
        return true;
    }
    const schoolMembership = getSchoolMembership(auth, schoolId);
    if (schoolMembership?.role === "school_admin") {
        return true;
    }
    const districtMembership = getDistrictMembership(auth, districtId);
    return Boolean(districtMembership && districtMembership.role === "district_admin");
};
