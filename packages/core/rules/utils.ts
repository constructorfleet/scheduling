import type {
  DayOfWeek,
  FieldTripEvent,
  FieldTripType,
  SegmentBlock,
  StaffAssignment,
  Employee,
  ScheduleDay,
  OperatingHours,
  DayScheduleType
} from "../domain/types";
import type { RulesContext } from "./types";

export const getCitationId = (
  context: RulesContext,
  ruleId: string,
  fallback?: string
): string | undefined => context.rulePolicyCitations?.[ruleId] ?? fallback;

export const getAssignmentsForBlock = (
  context: RulesContext,
  blockId: string
): StaffAssignment[] =>
  context.staffAssignments.filter((assignment) => assignment.segmentBlockId === blockId);

export const getEmployeeById = (
  context: RulesContext,
  employeeId?: string
): Employee | undefined => context.employees.find((employee) => employee.id === employeeId);

export const getBlockById = (
  context: RulesContext,
  blockId?: string
): SegmentBlock | undefined => context.segmentBlocks.find((block) => block.id === blockId);

export const getFieldTripEventById = (
  context: RulesContext,
  eventId?: string
): FieldTripEvent | undefined =>
  context.fieldTripEvents.find((event) => event.id === eventId);

export const getFieldTripEventForBlock = (
  context: RulesContext,
  block: SegmentBlock
): FieldTripEvent | undefined => {
  if (block.fieldTripEventId) {
    return getFieldTripEventById(context, block.fieldTripEventId);
  }
  const scheduleDay = getScheduleDayById(context, block.scheduleDayId);
  if (scheduleDay?.fieldTripEventId) {
    return getFieldTripEventById(context, scheduleDay.fieldTripEventId);
  }
  return context.fieldTripEvents.find((event) => {
    return (
      event.scheduleWeekId === block.scheduleWeekId &&
      event.dayOfWeek === block.dayOfWeek &&
      event.segment === block.segment
    );
  });
};

export const getFieldTripTypeById = (
  context: RulesContext,
  typeId?: string
): FieldTripType | undefined =>
  context.fieldTripTypes.find((type) => type.id === typeId);

export const getScheduleDayById = (
  context: RulesContext,
  dayId?: string
): ScheduleDay | undefined => context.scheduleDays.find((day) => day.id === dayId);

export const getOperatingHoursForDay = (
  context: RulesContext,
  dayOfWeek: DayOfWeek,
  dayScheduleType?: DayScheduleType
): OperatingHours | undefined => {
  const candidates = context.operatingHours.filter((hours) => hours.dayOfWeek === dayOfWeek);
  if (!candidates.length) {
    return undefined;
  }
  if (dayScheduleType) {
    const exactMatch = candidates.find((hours) => hours.dayScheduleType === dayScheduleType);
    if (exactMatch) {
      return exactMatch;
    }
  }
  return candidates[0];
};

export const getDayOfWeekForAssignment = (
  context: RulesContext,
  assignment: StaffAssignment
): DayOfWeek | undefined => context.segmentBlocks.find((block) => block.id === assignment.segmentBlockId)?.dayOfWeek;

const MINUTES_PER_DAY = 24 * 60;

export const parseTimeToMinutes = (value: string): number => {
  if (!value) {
    return 0;
  }

  const normalized = value.trim();
  const match = normalized.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/
  );
  if (!match) {
    return 0;
  }

  const parsedHours = parseInt(match[1], 10);
  const parsedMinutes = parseInt(match[2], 10);
  const parsedSeconds = parseInt(match[3] ?? "0", 10);
  const meridiem = match[4]?.toLowerCase();

  if (
    Number.isNaN(parsedHours) ||
    Number.isNaN(parsedMinutes) ||
    Number.isNaN(parsedSeconds) ||
    parsedMinutes < 0 ||
    parsedMinutes > 59 ||
    parsedSeconds < 0 ||
    parsedSeconds > 59
  ) {
    return 0;
  }

  let hours = parsedHours;
  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return 0;
    }
    hours = hours % 12;
    if (meridiem === "pm") {
      hours += 12;
    }
  } else if (hours < 0 || hours > 23) {
    return 0;
  }

  return hours * 60 + parsedMinutes + Math.round(parsedSeconds / 60);
};

export const calculateDurationHours = (start: string, end: string): number => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  let diff = endMinutes - startMinutes;
  if (diff < 0) {
    diff += MINUTES_PER_DAY;
  }
  return Math.max(diff, 0) / 60;
};
