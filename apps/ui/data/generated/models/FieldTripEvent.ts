/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayOfWeek } from './DayOfWeek';
import type { DaySegment } from './DaySegment';
export type FieldTripEvent = {
    id: string;
    scheduleWeekId: string;
    dayOfWeek: DayOfWeek;
    segment: DaySegment;
    scheduleDayId?: string;
    fieldTripTypeId?: string;
    isNoFieldTrip?: boolean;
    approverId?: string;
    signedOffAt?: string;
    policyCitationId?: string;
    notes?: string;
};

