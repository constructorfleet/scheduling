/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayOfWeek } from './DayOfWeek';
import type { DayScheduleType } from './DayScheduleType';
import type { EnrollmentSource } from './EnrollmentSource';
export type ScheduleDay = {
    id: string;
    scheduleWeekId: string;
    date: string;
    dayOfWeek: DayOfWeek;
    scheduleType?: string;
    enrollmentCount?: number;
    enrollmentSource?: EnrollmentSource;
    fieldTripEventId?: string;
    operatingCapacityOverride?: number;
    notes?: string;
    dayScheduleType?: DayScheduleType;
};

