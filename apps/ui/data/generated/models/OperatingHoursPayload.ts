/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayOfWeek } from './DayOfWeek';
export type OperatingHoursPayload = {
    scheduleType: string;
    daysOfWeek: Array<DayOfWeek>;
    open: string;
    close: string;
};

