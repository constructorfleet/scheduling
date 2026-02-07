/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EmploymentStatus } from './EmploymentStatus';
export type EmployeePayload = {
    name: string;
    jobTitle: string;
    maxHoursPerDay: number;
    maxHoursPerWeek: number;
    employmentStatus: EmploymentStatus;
    medicallyDelegated: boolean;
    cprCurrent: boolean;
    notes?: string;
};

