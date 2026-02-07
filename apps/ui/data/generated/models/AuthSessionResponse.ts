/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthUser } from './AuthUser';
import type { SchoolMembership } from './SchoolMembership';
import type { SessionInfo } from './SessionInfo';
export type AuthSessionResponse = {
    user: AuthUser;
    currentSchoolId: string;
    memberships: Array<SchoolMembership>;
    session: SessionInfo;
};

