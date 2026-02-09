/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EmployeeScheduleAssignment } from './EmployeeScheduleAssignment';
import type { EmployeeScheduleDay } from './EmployeeScheduleDay';
import type { EmployeeScheduleEmployee } from './EmployeeScheduleEmployee';
import type { EmployeeScheduleSegmentBlock } from './EmployeeScheduleSegmentBlock';
export type EmployeeScheduleViewResponse = {
    weekId: string;
    scheduleDays: Array<EmployeeScheduleDay>;
    segmentBlocks: Array<EmployeeScheduleSegmentBlock>;
    staffAssignments: Array<EmployeeScheduleAssignment>;
    employees: Array<EmployeeScheduleEmployee>;
};

