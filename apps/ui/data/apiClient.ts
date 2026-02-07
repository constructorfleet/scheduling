import { DefaultService, OpenAPI, type SettingsPayload, type ScheduleSavePayload } from "./generated";

OpenAPI.BASE = "";

export type { SettingsPayload, ScheduleSavePayload };

export const fetchSettings = async (schoolId: string) => {
  try {
    return await DefaultService.getApiSettings(schoolId);
  } catch {
    return null;
  }
};

export const saveSettings = async (schoolId: string, payload: SettingsPayload) => {
  return DefaultService.putApiSettings(schoolId, payload);
};

export const fetchSchedule = async (weekId: string) => {
  try {
    return await DefaultService.getApiSchedule(weekId);
  } catch {
    return null;
  }
};

export const saveSchedule = async (weekId: string, payload: ScheduleSavePayload) => {
  return DefaultService.putApiSchedule(weekId, payload);
};

export const deleteScheduleAssignments = async (weekId: string) => {
  const response = await fetch(`/api/schedule/${weekId}/staff-assignments`, {
    method: "DELETE"
  });
  if (!response.ok) {
    throw new Error(`Failed to clear staff assignments for ${weekId}`);
  }
  return response.json() as Promise<{ ok: boolean; deleted: number }>;
};
