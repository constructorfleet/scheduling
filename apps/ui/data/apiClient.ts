import {
  DefaultService,
  OpenAPI,
  type AuthSessionResponse,
  type LoginPayload,
  type MeResponse,
  type SettingsPayload,
  type ScheduleSavePayload
} from "./generated";
import { ApiError } from "./generated";

OpenAPI.BASE = "";
OpenAPI.WITH_CREDENTIALS = true;

export type { SettingsPayload, ScheduleSavePayload };

export type { AuthSessionResponse, LoginPayload, MeResponse };

export const isApiErrorStatus = (error: unknown, status: number) =>
  error instanceof ApiError && error.status === status;

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
