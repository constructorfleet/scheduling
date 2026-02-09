/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ScheduleTypePayload = {
    value: string;
    label: string;
    ratio: {
        adults: number;
        students: number;
    };
    description?: string;
    timeWindows?: Array<{
        id?: string;
        startTime: string;
        endTime: string;
        ratioAdults: number;
        ratioStudents: number;
    }>;
};

