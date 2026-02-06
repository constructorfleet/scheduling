/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ScheduleSavePayload = {
    scheduleWeek: {
        schoolId: string;
        label?: string;
        status: string;
        startDate?: string;
    };
    scheduleDays: Array<any>;
    segmentBlocks: Array<any>;
    staffAssignments: Array<any>;
    fieldTripEvents: Array<any>;
};

