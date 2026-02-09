/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayOfWeek } from './DayOfWeek';
import type { DayScheduleType } from './DayScheduleType';
export type EmployeeScheduleDay = {
    id: string;
    dayOfWeek: DayOfWeek;
    date?: string | null;
    scheduleType?: string | null;
    dayScheduleType?: DayScheduleType;
};

