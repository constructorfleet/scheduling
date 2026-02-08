/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayOfWeek } from './DayOfWeek';
export type SchoolSettings = {
    name: string;
    closedDays: Array<DayOfWeek>;
    openerCount: number;
    closerCount: number;
    fieldTripStartTime: string;
    fieldTripEndTime: string;
    minimumMedicalDelegated: number;
    requireCurrentCpr: boolean;
};

