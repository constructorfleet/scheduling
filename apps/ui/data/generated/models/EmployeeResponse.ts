/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EmployeeAvailabilityDay } from './EmployeeAvailabilityDay';
import type { EmployeeTimeOffRequest } from './EmployeeTimeOffRequest';
export type EmployeeResponse = {
    id: string;
    schoolId: string;
    name: string;
    jobTitle: string;
    maxHoursPerDay: number;
    maxHoursPerWeek: number;
    employmentStatus: string;
    medicallyDelegated: boolean;
    cprCurrent: boolean;
    notes?: string;
    availability?: Array<EmployeeAvailabilityDay>;
    requestedDaysOff?: Array<EmployeeTimeOffRequest>;
};

