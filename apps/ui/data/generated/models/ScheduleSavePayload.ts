/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuditEvent } from './AuditEvent';
import type { FieldTripEvent } from './FieldTripEvent';
import type { ScheduleDay } from './ScheduleDay';
import type { ScheduleWeek } from './ScheduleWeek';
import type { SegmentBlock } from './SegmentBlock';
import type { StaffAssignment } from './StaffAssignment';
export type ScheduleSavePayload = {
    scheduleWeek: ScheduleWeek;
    scheduleDays: Array<ScheduleDay>;
    segmentBlocks: Array<SegmentBlock>;
    staffAssignments: Array<StaffAssignment>;
    fieldTripEvents: Array<FieldTripEvent>;
    auditEvents: Array<AuditEvent>;
};

