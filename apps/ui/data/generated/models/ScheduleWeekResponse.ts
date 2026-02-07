/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FieldTripEvent } from './FieldTripEvent';
import type { ScheduleDay } from './ScheduleDay';
import type { ScheduleStatus } from './ScheduleStatus';
import type { SegmentBlock } from './SegmentBlock';
import type { StaffAssignment } from './StaffAssignment';
export type ScheduleWeekResponse = {
    id: string;
    schoolId: string;
    label?: string;
    status: ScheduleStatus;
    startDate?: string;
    scheduleDays: Array<ScheduleDay>;
    segmentBlocks: Array<SegmentBlock>;
    staffAssignments: Array<StaffAssignment>;
    fieldTripEvents: Array<FieldTripEvent>;
};

