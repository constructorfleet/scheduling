/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayOfWeek } from './DayOfWeek';
import type { DaySegment } from './DaySegment';
import type { ScheduleStatus } from './ScheduleStatus';
import type { SegmentRequirementTemplate } from './SegmentRequirementTemplate';
export type SegmentBlock = {
    id: string;
    scheduleWeekId: string;
    scheduleDayId?: string;
    dayOfWeek: DayOfWeek;
    segment: DaySegment;
    startTime: string;
    endTime: string;
    childCount: number;
    requirementTemplate: SegmentRequirementTemplate;
    fieldTripEventId?: string;
    status: ScheduleStatus;
    operatingCapacityOverride?: number;
    closedReason?: string;
};

