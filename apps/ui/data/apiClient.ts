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

type AdminUsersResponse = { users: AdminUserRecord[] };
type AdminInvitesResponse = { invites: AdminInviteRecord[] };
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
  const prefix = `${name}=`;
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
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { message?: string };
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

export const saveSchedule = async (weekId: string, payload: ScheduleSavePayload) => {
  return DefaultService.putApiSchedule(getCsrfToken(), weekId, payload);
};

export const deleteScheduleAssignments = async (weekId: string) => {
  return DefaultService.deleteApiScheduleStaffAssignments(getCsrfToken(), weekId);
};

export const fetchAuthMe = async () => DefaultService.getApiAuthMe();

export const login = async (payload: LoginPayload) => DefaultService.postApiAuthLogin(payload);

export const logout = async () => DefaultService.postApiAuthLogout(getCsrfToken());

export const fetchDistrictUsers = async (districtId: string) =>
  requestJson<AdminUsersResponse>(`/api/admin/districts/${encodeURIComponent(districtId)}/users`);

export const fetchDistrictInvites = async (districtId: string) =>
  requestJson<AdminInvitesResponse>(`/api/admin/districts/${encodeURIComponent(districtId)}/invites`);

export const inviteDistrictUser = async (districtId: string, payload: AdminInviteRequest) =>
  requestJson<AdminInviteCreateResponse>(`/api/admin/districts/${encodeURIComponent(districtId)}/memberships`, {
    method: "PUT",
    headers: {
      "x-csrf-token": getCsrfToken()
    },
    body: JSON.stringify(payload)
  });

export const fetchSchoolUsers = async (schoolId: string) =>
  requestJson<AdminUsersResponse>(`/api/admin/schools/${encodeURIComponent(schoolId)}/users`);

export const fetchSchoolInvites = async (schoolId: string) =>
  requestJson<AdminInvitesResponse>(`/api/admin/schools/${encodeURIComponent(schoolId)}/invites`);

export const inviteSchoolUser = async (schoolId: string, payload: AdminInviteRequest) =>
  requestJson<AdminInviteCreateResponse>(`/api/admin/schools/${encodeURIComponent(schoolId)}/memberships`, {
    method: "PUT",
    headers: {
      "x-csrf-token": getCsrfToken()
    },
    body: JSON.stringify(payload)
  });
