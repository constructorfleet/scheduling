import type { StaffAssignment, DayOfWeek } from "./types";

// Sentinel time values for on-call assignments (all-day coverage)
export const ON_CALL_START_TIME = "00:00";
export const ON_CALL_END_TIME = "23:59";

// Helper to identify on-call assignments
export const isOnCallAssignment = (assignment: {
    isOnCall?: boolean;
    startTime: string;
    endTime: string;
}): boolean => {
    return assignment.isOnCall === true ||
           (assignment.startTime === ON_CALL_START_TIME &&
            assignment.endTime === ON_CALL_END_TIME);
};

// Helper to identify 1:1 assignments
export const is1on1Assignment = (assignment: {
    is1on1?: boolean;
}): boolean => {
    return assignment.is1on1 === true;
};

// Helper to count students in 1:1 during a time interval
export const count1on1StudentsInInterval = (
    assignments: StaffAssignment[],
    dayOfWeek: DayOfWeek,
    intervalStart: number,
    intervalEnd: number,
    getDayOfWeekForAssignment: (assignment: StaffAssignment) => DayOfWeek | undefined,
    parseTimeToMinutes: (time: string) => number
): number => {
    return assignments.filter(assignment => {
        if (!assignment.is1on1) return false;
        if (assignment.status === "completed") return false;
        if (getDayOfWeekForAssignment(assignment) !== dayOfWeek) return false;

        const assignmentStart = parseTimeToMinutes(assignment.startTime);
        const assignmentEnd = parseTimeToMinutes(assignment.endTime);

        // Check if assignment overlaps with interval
        return assignmentStart < intervalEnd && assignmentEnd > intervalStart;
    }).length;
};
