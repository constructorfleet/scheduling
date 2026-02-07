import type { Role } from "../generated/prisma-client";

type Membership = {
  schoolId: string;
  role: Role;
};

type AuthLike = {
  memberships: Membership[];
};

const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  scheduler: 2,
  director: 3,
  owner: 4
};

export const hasRequiredRole = (role: Role, required: Role) => ROLE_RANK[role] >= ROLE_RANK[required];

export const getSchoolMembership = (auth: AuthLike, schoolId: string) =>
  auth.memberships.find((membership) => membership.schoolId === schoolId) ?? null;

export const canAccessSchoolWithRole = (auth: AuthLike, schoolId: string, requiredRole: Role) => {
  const membership = getSchoolMembership(auth, schoolId);
  if (!membership) {
    return false;
  }
  return hasRequiredRole(membership.role, requiredRole);
};
