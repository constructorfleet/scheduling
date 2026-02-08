/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthUser } from './AuthUser';
import type { DistrictMembership } from './DistrictMembership';
import type { SchoolMembership } from './SchoolMembership';
export type MeResponse = {
    user: AuthUser;
    memberships: Array<SchoolMembership>;
    schoolMemberships: Array<SchoolMembership>;
    districtMemberships: Array<DistrictMembership>;
};

