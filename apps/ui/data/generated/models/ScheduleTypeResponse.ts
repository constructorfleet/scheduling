/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ScheduleTypeResponse = {
    id: string;
    schoolId: string;
    value: string;
    label: string;
    ratioAdults: number;
    ratioStudents: number;
    description?: string;
    timeWindows?: Array<{
        id: string;
        scheduleTypeId: string;
        startTime: string;
        endTime: string;
        ratioAdults: number;
        ratioStudents: number;
    }>;
};

