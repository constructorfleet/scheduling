/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EmployeeAvailabilityDay } from './EmployeeAvailabilityDay';
import type { EmployeeTimeOffRequest } from './EmployeeTimeOffRequest';
import type { EmploymentStatus } from './EmploymentStatus';
export type EmployeePayload = {
    name: string;
    email?: string;
    phone?: string;
    jobTitle: string;
    maxHoursPerDay: number;
    maxHoursPerWeek: number;
    employmentStatus: EmploymentStatus;
    leaderQualified?: boolean;
    medicallyDelegated: boolean;
    cprCurrent: boolean;
    notes?: string;
    roles?: Array<string>;
    availability?: Array<EmployeeAvailabilityDay>;
    requestedDaysOff?: Array<EmployeeTimeOffRequest>;
};

