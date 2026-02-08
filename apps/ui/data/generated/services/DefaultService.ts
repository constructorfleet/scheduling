/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthSessionResponse } from '../models/AuthSessionResponse';
import type { GenericOk } from '../models/GenericOk';
import type { HealthResponse } from '../models/HealthResponse';
import type { LoginPayload } from '../models/LoginPayload';
import type { MeResponse } from '../models/MeResponse';
import type { ScheduleSavePayload } from '../models/ScheduleSavePayload';
import type { ScheduleWeekResponse } from '../models/ScheduleWeekResponse';
import type { SettingsPayload } from '../models/SettingsPayload';
import type { SettingsResponse } from '../models/SettingsResponse';
import type { SettingsSaveResponse } from '../models/SettingsSaveResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Health check
     * @returns HealthResponse OK
     * @throws ApiError
     */
    public static getApiHealth(): CancelablePromise<HealthResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/health',
        });
    }
    /**
     * Authenticate a user and create a session
     * @param requestBody
     * @returns AuthSessionResponse Authenticated user context
     * @throws ApiError
     */
    public static postApiAuthLogin(
        requestBody: LoginPayload,
    ): CancelablePromise<AuthSessionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/login',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Invalid credentials`,
                423: `Account locked`,
                429: `Too many login attempts`,
            },
        });
    }
    /**
     * Revoke current session and clear cookie
     * @param xCsrfToken CSRF protection token. Must match the `sched_csrf` cookie.
     * @returns GenericOk Logout complete
     * @throws ApiError
     */
    public static postApiAuthLogout(
        xCsrfToken: string,
    ): CancelablePromise<GenericOk> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/logout',
            headers: {
                'x-csrf-token': xCsrfToken,
            },
        });
    }
    /**
     * Get current authenticated user
     * @returns MeResponse Authenticated user profile
     * @throws ApiError
     */
    public static getApiAuthMe(): CancelablePromise<MeResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/auth/me',
            errors: {
                401: `Not authenticated`,
            },
        });
    }
    /**
     * Get settings for a school
     * @param schoolId
     * @returns SettingsResponse Settings payload
     * @throws ApiError
     */
    public static getApiSettings(
        schoolId: string,
    ): CancelablePromise<SettingsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/settings/{schoolId}',
            path: {
                'schoolId': schoolId,
            },
            errors: {
                401: `Authentication required`,
                403: `Insufficient access`,
            },
        });
    }
    /**
     * Save settings for a school
     * @param xCsrfToken CSRF protection token. Must match the `sched_csrf` cookie.
     * @param schoolId
     * @param requestBody
     * @returns SettingsSaveResponse OK
     * @throws ApiError
     */
    public static putApiSettings(
        xCsrfToken: string,
        schoolId: string,
        requestBody: SettingsPayload,
    ): CancelablePromise<SettingsSaveResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/settings/{schoolId}',
            path: {
                'schoolId': schoolId,
            },
            headers: {
                'x-csrf-token': xCsrfToken,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Authentication required`,
                403: `Insufficient access`,
            },
        });
    }
    /**
     * Get schedule week
     * @param weekId
     * @returns ScheduleWeekResponse Schedule week
     * @throws ApiError
     */
    public static getApiSchedule(
        weekId: string,
    ): CancelablePromise<ScheduleWeekResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/schedule/{weekId}',
            path: {
                'weekId': weekId,
            },
            errors: {
                401: `Authentication required`,
                403: `Insufficient access`,
            },
        });
    }
    /**
     * Save schedule week
     * @param xCsrfToken CSRF protection token. Must match the `sched_csrf` cookie.
     * @param weekId
     * @param requestBody
     * @returns GenericOk OK
     * @throws ApiError
     */
    public static putApiSchedule(
        xCsrfToken: string,
        weekId: string,
        requestBody: ScheduleSavePayload,
    ): CancelablePromise<GenericOk> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/schedule/{weekId}',
            path: {
                'weekId': weekId,
            },
            headers: {
                'x-csrf-token': xCsrfToken,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Authentication required`,
                403: `Insufficient access`,
            },
        });
    }
    /**
     * Clear staff assignments for a schedule week
     * @param xCsrfToken CSRF protection token. Must match the `sched_csrf` cookie.
     * @param weekId
     * @returns any Delete result
     * @throws ApiError
     */
    public static deleteApiScheduleStaffAssignments(
        xCsrfToken: string,
        weekId: string,
    ): CancelablePromise<{
        ok: boolean;
        deleted: number;
    }> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/schedule/{weekId}/staff-assignments',
            path: {
                'weekId': weekId,
            },
            headers: {
                'x-csrf-token': xCsrfToken,
            },
            errors: {
                401: `Authentication required`,
                403: `Insufficient access`,
            },
        });
    }
    /**
     * Delete a staff assignment
     * @param xCsrfToken CSRF protection token. Must match the `sched_csrf` cookie.
     * @param weekId
     * @param assignmentId
     * @returns any Delete result
     * @throws ApiError
     */
    public static deleteApiScheduleStaffAssignments1(
        xCsrfToken: string,
        weekId: string,
        assignmentId: string,
    ): CancelablePromise<{
        ok: boolean;
        deleted: number;
    }> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/schedule/{weekId}/staff-assignments/{assignmentId}',
            path: {
                'weekId': weekId,
                'assignmentId': assignmentId,
            },
            headers: {
                'x-csrf-token': xCsrfToken,
            },
            errors: {
                401: `Authentication required`,
                403: `Insufficient access`,
            },
        });
    }
}
