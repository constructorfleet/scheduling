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
        });
    }
    /**
     * Revoke current session and clear cookie
     * @returns GenericOk Logout complete
     * @throws ApiError
     */
    public static postApiAuthLogout(): CancelablePromise<GenericOk> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/logout',
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
        });
    }
    /**
     * Save settings for a school
     * @param schoolId
     * @param requestBody
     * @returns SettingsSaveResponse OK
     * @throws ApiError
     */
    public static putApiSettings(
        schoolId: string,
        requestBody: SettingsPayload,
    ): CancelablePromise<SettingsSaveResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/settings/{schoolId}',
            path: {
                'schoolId': schoolId,
            },
            body: requestBody,
            mediaType: 'application/json',
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
        });
    }
    /**
     * Save schedule week
     * @param weekId
     * @param requestBody
     * @returns GenericOk OK
     * @throws ApiError
     */
    public static putApiSchedule(
        weekId: string,
        requestBody: ScheduleSavePayload,
    ): CancelablePromise<GenericOk> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/schedule/{weekId}',
            path: {
                'weekId': weekId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
