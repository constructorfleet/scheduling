/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Employee } from './Employee';
import type { FieldTripType } from './FieldTripType';
import type { JobTitle } from './JobTitle';
import type { OperatingHours } from './OperatingHours';
import type { ScheduleType } from './ScheduleType';
import type { SchoolSettings } from './SchoolSettings';
export type SettingsPayload = {
    school: SchoolSettings;
    scheduleTypes: Array<ScheduleType>;
    jobTitles: Array<JobTitle>;
    employees: Array<Employee>;
    operatingHours: Array<OperatingHours>;
    fieldTripTypes: Array<FieldTripType>;
};

