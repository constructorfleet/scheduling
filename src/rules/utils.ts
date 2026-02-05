import type {
  DayOfWeek,
  FieldTripEvent,
  FieldTripType,
  SegmentBlock,
  StaffAssignment,
  Employee
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

export const getFieldTripTypeById = (
  context: RulesContext,
  typeId?: string
): FieldTripType | undefined =>
  context.fieldTripTypes.find((type) => type.id === typeId);

export const getScheduleDayById = (
  context: RulesContext,
  dayId?: string
): ScheduleDay | undefined => context.scheduleDays.find((day) => day.id === dayId);

export const getDayOfWeekForAssignment = (
  context: RulesContext,
  assignment: StaffAssignment
): DayOfWeek | undefined => context.segmentBlocks.find((block) => block.id === assignment.segmentBlockId)?.dayOfWeek;

const MINUTES_PER_DAY = 24 * 60;

export const parseTimeToMinutes = (value: string): number => {
  if (!value) {
    return 0;
  }
  const [hours = "0", minutes = "0", seconds = "0"] = value.split(":");
  const parsedHours = parseInt(hours, 10);
  const parsedMinutes = parseInt(minutes, 10);
  const parsedSeconds = parseInt(seconds, 10);
  if (Number.isNaN(parsedHours) || Number.isNaN(parsedMinutes) || Number.isNaN(parsedSeconds)) {
    return 0;
  }
  return parsedHours * 60 + parsedMinutes + Math.round(parsedSeconds / 60);
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
