/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EmployeePayload } from './EmployeePayload';
import type { FieldTripTypePayload } from './FieldTripTypePayload';
import type { JobTitlePayload } from './JobTitlePayload';
import type { OperatingHoursPayload } from './OperatingHoursPayload';
import type { ScheduleTypePayload } from './ScheduleTypePayload';
import type { SchoolSettings } from './SchoolSettings';
export type SettingsPayload = {
    school: SchoolSettings;
    scheduleTypes: Array<ScheduleTypePayload>;
    jobTitles: Array<JobTitlePayload>;
    employees: Array<EmployeePayload>;
    operatingHours: Array<OperatingHoursPayload>;
    fieldTripTypes: Array<FieldTripTypePayload>;
};

