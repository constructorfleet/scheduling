/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AssignmentSource } from './AssignmentSource';
export type StaffAssignment = {
    id: string;
    segmentBlockId: string;
    employeeId: string;
    assignmentSource: AssignmentSource;
    startTime: string;
    endTime: string;
    status: 'scheduled' | 'active' | 'on_break' | 'completed';
    role?: string;
    notes?: string;
};

