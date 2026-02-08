/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthUser } from './AuthUser';
import type { DistrictMembership } from './DistrictMembership';
import type { SchoolMembership } from './SchoolMembership';
import type { SessionInfo } from './SessionInfo';
export type AuthSessionResponse = {
    user: AuthUser;
    currentSchoolId?: string | null;
    memberships: Array<SchoolMembership>;
    schoolMemberships: Array<SchoolMembership>;
    districtMemberships: Array<DistrictMembership>;
    session: SessionInfo;
    csrfToken: string;
};

