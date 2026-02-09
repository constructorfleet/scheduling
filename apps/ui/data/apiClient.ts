import {
    DefaultService,
    OpenAPI,
    type AuthSessionResponse,
    type DistrictMembership,
    type LoginPayload,
    type MeResponse,
    type Role,
    type SchoolMembership,
    type SettingsPayload,
    type ScheduleSavePayload
} from "./generated";
import { ApiError } from "./generated";
import type { DayOfWeek, SegmentBlock, StaffAssignment } from "@core/domain/types";

OpenAPI.BASE = "";
OpenAPI.WITH_CREDENTIALS = true;

export type { SettingsPayload, ScheduleSavePayload };

export type { AuthSessionResponse, LoginPayload, MeResponse };
export type UserManagementScope = "district" | "school";

export type AdminUserRecord = {
    id: string;
    email: string;
    displayName: string;
    status: string;
    memberships?: SchoolMembership[];
    districtMemberships?: DistrictMembership[];
};

export type AdminInviteRecord = {
    id: string;
    email: string;
    displayName: string | null;
    role: Role;
    districtId?: string | null;
    districtName?: string | null;
    schoolId?: string | null;
    schoolName?: string | null;
    invitedBy?: {
        id: string;
        email: string;
        displayName: string;
    } | null;
    createdAt: string;
    expiresAt: string;
    acceptedAt: string | null;
    revokedAt: string | null;
    inviteUrl: string | null;
};

export type AdminInviteRequest = {
    email: string;
    displayName?: string;
    role: Role;
};

export type AdminDistrictRecord = {
    id: string;
    name: string;
};

export type AdminSchoolRecord = {
    id: string;
    districtId: string;
    name: string;
};

export type PublicSchoolRecord = {
    id: string;
    districtId: string;
    name: string;
};

export type PublicDistrictRecord = {
    id: string;
    name: string;
    schools: PublicSchoolRecord[];
};

export type InviteDetails = {
    email: string;
    displayName: string | null;
    role: Role;
    districtId: string | null;
    districtName: string | null;
    schoolId: string | null;
    schoolName: string | null;
    expiresAt: string;
};

export type EmployeeScheduleViewEmployee = {
    id: string;
    name: string;
};

export type EmployeeScheduleViewResponse = {
    weekId: string;
    scheduleDays: Array<{
        id: string;
        dayOfWeek: DayOfWeek;
        date?: string | null;
        scheduleType?: string | null;
        dayScheduleType?: string | null;
    }>;
    segmentBlocks: Array<Pick<SegmentBlock, "id" | "dayOfWeek" | "segment" | "startTime" | "endTime">>;
    staffAssignments: Array<Pick<StaffAssignment, "id" | "segmentBlockId" | "employeeId" | "startTime" | "endTime">>;
    employees: EmployeeScheduleViewEmployee[];
};

type AdminUsersResponse = { users: AdminUserRecord[]; };
type AdminInvitesResponse = { invites: AdminInviteRecord[]; };
type AdminDistrictsResponse = { districts: AdminDistrictRecord[]; };
type AdminSchoolsResponse = { schools: AdminSchoolRecord[]; };
type PublicDistrictsResponse = { districts: PublicDistrictRecord[]; };
type AdminInviteCreateResponse = {
    invite: AdminInviteRecord;
    delivery: {
        queued: boolean;
        provider: string;
        simulated: boolean;
    };
};

class HttpError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export const isApiErrorStatus = (error: unknown, status: number) =>
    (error instanceof ApiError && error.status === status) ||
    (error instanceof HttpError && error.status === status);

const getCookieValue = (name: string) => {
    if (typeof document === "undefined") {
        return "";
    }
    const prefix = `${ name }=`;
    const parts = document.cookie.split(";").map((part) => part.trim());
    const entry = parts.find((part) => part.startsWith(prefix));
    if (!entry) {
        return "";
    }
    return decodeURIComponent(entry.slice(prefix.length));
};

const getCsrfToken = () => getCookieValue("sched_csrf");

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
        credentials: "include",
        ...init,
        headers: {
            ...(init?.headers ?? {}),
            "content-type": "application/json"
        }
    });
    if (!response.ok) {
        let message = `Request failed (${ response.status })`;
        try {
            const payload = (await response.json()) as { message?: string; };
            if (payload?.message) {
                message = payload.message;
            }
        } catch {
            // ignore parse error and keep default message
        }
        throw new HttpError(response.status, message);
    }
    return (await response.json()) as T;
};

export const fetchSettings = async (schoolId: string) => {
    return DefaultService.getApiSettings(schoolId);
};

export const saveSettings = async (schoolId: string, payload: SettingsPayload) => {
    return DefaultService.putApiSettings(getCsrfToken(), schoolId, payload);
};

export const fetchSchedule = async (weekId: string) => {
    try {
        return await DefaultService.getApiSchedule(weekId);
    } catch (error) {
        if (isApiErrorStatus(error, 404)) {
            return null;
        }
        throw error;
    }
};

export const fetchEmployeeScheduleView = async (weekId: string) => {
    try {
        return await requestJson<EmployeeScheduleViewResponse>(
            `/api/schedule/${ encodeURIComponent(weekId) }/employee-view`
        );
    } catch (error) {
        if (isApiErrorStatus(error, 404)) {
            return null;
        }
        throw error;
    }
};

export const saveSchedule = async (weekId: string, payload: ScheduleSavePayload) => {
    return DefaultService.putApiSchedule(getCsrfToken(), weekId, payload);
};

export const deleteScheduleAssignments = async (weekId: string) => {
    return DefaultService.deleteApiScheduleStaffAssignments(getCsrfToken(), weekId);
};

export const deleteScheduleAssignment = async (weekId: string, assignmentId: string) => {
    return DefaultService.deleteApiScheduleStaffAssignments1(getCsrfToken(), weekId, assignmentId);
};

export const fetchAuthMe = async () => DefaultService.getApiAuthMe();

export const login = async (payload: LoginPayload) => DefaultService.postApiAuthLogin(payload);

export const logout = async () => DefaultService.postApiAuthLogout(getCsrfToken());

export const fetchInviteByToken = async (token: string) =>
    requestJson<InviteDetails>(`/api/auth/invites/${ encodeURIComponent(token) }`);

export const acceptInvite = async (payload: { token: string; displayName?: string; password: string; }) =>
    requestJson<{ ok: true; }>("/api/auth/invites/accept", {
        method: "POST",
        body: JSON.stringify(payload)
    });

export const updateDisplayName = async (displayName: string) =>
    requestJson<{ user: { id: string; email: string; displayName: string; }; }>("/api/auth/profile", {
        method: "PATCH",
        headers: {
            "x-csrf-token": getCsrfToken()
        },
        body: JSON.stringify({ displayName })
    });

export const changePassword = async (payload: { currentPassword: string; newPassword: string; }) =>
    requestJson<{ ok: true; }>("/api/auth/password", {
        method: "PATCH",
        headers: {
            "x-csrf-token": getCsrfToken()
        },
        body: JSON.stringify(payload)
    });

export const requestPasswordReset = async (email: string) =>
    requestJson<{ ok: true; }>("/api/auth/password/forgot", {
        method: "POST",
        body: JSON.stringify({ email })
    });

export const resetPassword = async (payload: { token: string; password: string; }) =>
    requestJson<{ ok: true; }>("/api/auth/password/reset", {
        method: "POST",
        body: JSON.stringify(payload)
    });

export const fetchDistrictUsers = async (districtId: string) =>
    requestJson<AdminUsersResponse>(`/api/admin/districts/${ encodeURIComponent(districtId) }/users`);

export const fetchDistrictInvites = async (districtId: string) =>
    requestJson<AdminInvitesResponse>(`/api/admin/districts/${ encodeURIComponent(districtId) }/invites`);

export const inviteDistrictUser = async (districtId: string, payload: AdminInviteRequest) =>
    requestJson<AdminInviteCreateResponse>(`/api/admin/districts/${ encodeURIComponent(districtId) }/memberships`, {
        method: "PUT",
        headers: {
            "x-csrf-token": getCsrfToken()
        },
        body: JSON.stringify(payload)
    });

export const fetchSchoolUsers = async (schoolId: string) =>
    requestJson<AdminUsersResponse>(`/api/admin/schools/${ encodeURIComponent(schoolId) }/users`);

export const fetchSchoolInvites = async (schoolId: string) =>
    requestJson<AdminInvitesResponse>(`/api/admin/schools/${ encodeURIComponent(schoolId) }/invites`);

export const inviteSchoolUser = async (schoolId: string, payload: AdminInviteRequest) =>
    requestJson<AdminInviteCreateResponse>(`/api/admin/schools/${ encodeURIComponent(schoolId) }/memberships`, {
        method: "PUT",
        headers: {
            "x-csrf-token": getCsrfToken()
        },
        body: JSON.stringify(payload)
    });

export const fetchAdminDistricts = async () => requestJson<AdminDistrictsResponse>("/api/admin/districts");

export const fetchPublicDistricts = async () => requestJson<PublicDistrictsResponse>("/api/public/districts");

export const createAdminDistrict = async (payload: { id?: string; name?: string; }) =>
    requestJson<{ district: AdminDistrictRecord; }>("/api/admin/districts", {
        method: "POST",
        headers: {
            "x-csrf-token": getCsrfToken()
        },
        body: JSON.stringify(payload)
    });

export const updateAdminDistrict = async (districtId: string, payload: { name: string; }) =>
    requestJson<{ district: AdminDistrictRecord; }>(`/api/admin/districts/${ encodeURIComponent(districtId) }`, {
        method: "PUT",
        headers: {
            "x-csrf-token": getCsrfToken()
        },
        body: JSON.stringify(payload)
    });

export const fetchDistrictSchools = async (districtId: string) =>
    requestJson<AdminSchoolsResponse>(`/api/admin/districts/${ encodeURIComponent(districtId) }/schools`);

export const upsertDistrictSchool = async (districtId: string, schoolId: string, payload: { name: string; }) =>
    requestJson<{ school: AdminSchoolRecord; }>(
        `/api/admin/districts/${ encodeURIComponent(districtId) }/schools/${ encodeURIComponent(schoolId) }`,
        {
            method: "PUT",
            headers: {
                "x-csrf-token": getCsrfToken()
            },
            body: JSON.stringify(payload)
        }
    );

export const deleteDistrict = async (districtId: string) =>
    requestJson<{ ok: true; deleted: number; }>(`/api/admin/districts/${ encodeURIComponent(districtId) }`, {
        method: "DELETE",
        headers: {
            "x-csrf-token": getCsrfToken()
        }
    });

export const deleteDistrictSchool = async (districtId: string, schoolId: string) =>
    requestJson<{ ok: true; deleted: number; }>(
        `/api/admin/districts/${ encodeURIComponent(districtId) }/schools/${ encodeURIComponent(schoolId) }`,
        {
            method: "DELETE",
            headers: {
                "x-csrf-token": getCsrfToken()
            }
        }
    );

export const deleteDistrictUser = async (districtId: string, userId: string) =>
    requestJson<{ ok: true; deleted: number; }>(
        `/api/admin/districts/${ encodeURIComponent(districtId) }/users/${ encodeURIComponent(userId) }`,
        {
            method: "DELETE",
            headers: {
                "x-csrf-token": getCsrfToken()
            }
        }
    );

export const deleteSchoolUser = async (schoolId: string, userId: string) =>
    requestJson<{ ok: true; deleted: number; }>(
        `/api/admin/schools/${ encodeURIComponent(schoolId) }/users/${ encodeURIComponent(userId) }`,
        {
            method: "DELETE",
            headers: {
                "x-csrf-token": getCsrfToken()
            }
        }
    );
