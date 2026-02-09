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
