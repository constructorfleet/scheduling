/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EmployeeResponse } from './EmployeeResponse';
import type { FieldTripTypeResponse } from './FieldTripTypeResponse';
import type { JobTitleResponse } from './JobTitleResponse';
import type { OperatingHoursResponse } from './OperatingHoursResponse';
import type { ScheduleTypeResponse } from './ScheduleTypeResponse';
import type { SchoolRecord } from './SchoolRecord';
export type SettingsResponse = {
    school: SchoolRecord | null;
    scheduleTypes?: Array<ScheduleTypeResponse>;
    jobTitles?: Array<JobTitleResponse>;
    employees?: Array<EmployeeResponse>;
    operatingHours?: Array<OperatingHoursResponse>;
    fieldTripTypes?: Array<FieldTripTypeResponse>;
};

