import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import WeekNavigationBanner from "./components/WeekNavigationBanner";
import { FieldTripSelection } from "./components/DayMetadataStrip";
import ScheduleMatrix from "./components/ScheduleMatrix";
import ViolationNavigator from "./components/ViolationNavigator";
import GuidedStatusTracker from "./components/GuidedStatusTracker";
import AuditTimeline from "./components/AuditTimeline";
import SettingsPanel, { JobTitleSetting, OperatingHoursConfig, SchoolRules } from "./components/SettingsPanel";
import {
  dayDisplayNames,
  daySequence,
  fieldTripEvents,
  operatingHours,
  scheduleDays,
  policyCitations,
  segmentBlocks,
  staffAssignments,
  weekMeta,
  schools,
  scheduleTypeOptions,
  fieldTripTypes,
  employees
} from "./data/runtimeDefaults";
import { AuditEvent, GuidedStep, RuleViolation as UiRuleViolation } from "./types";
import {
  DayOfWeek,
  Employee,
  FieldTripEvent,
  OperatingHours,
  PolicyCitation,
  ScheduleDay,
  ScheduleStatus,
  ScheduleType,
  SegmentBlock,
  StaffAssignment
} from "@core/domain/types";
import type {
  EmployeePayload,
  FieldTripTypePayload,
  SettingsPayload as SettingsPayloadModel,
  ScheduleTypePayload as ScheduleTypePayloadModel
} from "./data/generated";
import { createRulesEngine } from "@core/rules/engine";
import type { RuleViolation as EngineRuleViolation, RulesContext } from "@core/rules/types";
import {
  fetchSchedule,
  fetchSettings,
  saveSchedule,
  saveSettings,
  type ScheduleSavePayload
} from "./data/apiClient";
import { autoSchedule, validateDayMetadata, type MissingMetadata } from "@core/scheduler";

const RULE_TITLES: Record<string, string> = {
  "ratio-segment": "Ratio staffing gap",
  "shift-break-limits": "Shift limit breach",
  "field-trip-ratios": "Field trip ratio",
  "open-close-coverage": "Open/close coverage",
  "medical-delegated-coverage": "Medical delegation",
  "cpr-current-required": "CPR current required",
  "schedule-day-metadata": "Missing day details",
  "segment-block-timeline": "Clock block timeline issue",
  "employee-availability": "Employee availability",
  "field-trip-event": "Field trip data issue",
  "certification-per-segment": "Certification coverage gap",
  "segment-coverage": "Coverage gap"
};

const RECOMMENDED_ACTIONS: Record<string, string> = {
  "ratio-segment": "Add a certified staff member or adjust child counts so the segment meets the ratio.",
  "shift-break-limits": "Split the shift into shorter blocks or assign a break to stay under the cap.",
  "field-trip-ratios": "Reconcile adult and leader counts with the ratio required for this trip.",
  "open-close-coverage": "Add the required opener/closer coverage and ensure a leader-qualified staff member is present.",
  "medical-delegated-coverage": "Assign medically delegated staff to meet the minimum requirement.",
  "cpr-current-required": "Replace the staff member with a current CPR certification.",
  "employee-availability":
    "Update employee availability/time-off settings or move the assignment inside an available window."
};

const RULE_POLICY_CITATIONS = {
  "ratio-segment": policyCitations.ratio.id,
  "shift-break-limits": policyCitations.breakPolicy.id,
  "field-trip-ratios": policyCitations.fieldTrip.id,
  "open-close-coverage": policyCitations.leaderCoverage.id,
  "medical-delegated-coverage": policyCitations.breakPolicy.id,
  "cpr-current-required": policyCitations.breakPolicy.id,
  "employee-availability": policyCitations.breakPolicy.id
} as const;

const SEVERITY_MAP: Record<EngineRuleViolation["severity"], UiRuleViolation["severity"]> = {
  error: "critical",
  warning: "warning"
};

const POLICY_CITATION_LIST = Object.values(policyCitations);

type WeekDirection = "prev" | "next";

const DAY_OF_WEEK_VALUES: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const isDayOfWeek = (value: string): value is DayOfWeek =>
  DAY_OF_WEEK_VALUES.includes(value as DayOfWeek);
const CLOSED_SCHEDULE_TYPE = "closed" as ScheduleType;
const CLOSED_SCHEDULE_TYPE_OPTION = {
  value: CLOSED_SCHEDULE_TYPE,
  label: "Closed",
  ratio: { adults: 1, students: 1 },
  description: "School closed for this day."
};
const ensureClosedScheduleType = (options: typeof scheduleTypeOptions) => {
  if (options.some((option) => option.value === CLOSED_SCHEDULE_TYPE)) {
    return options;
  }
  return [...options, CLOSED_SCHEDULE_TYPE_OPTION];
};

const EMPLOYMENT_STATUS_VALUES: Employee["employmentStatus"][] = ["active", "on_leave", "archived"];
const coerceEmploymentStatus = (value: string | undefined): Employee["employmentStatus"] =>
  EMPLOYMENT_STATUS_VALUES.includes(value as Employee["employmentStatus"])
    ? (value as Employee["employmentStatus"])
    : "active";

const formatWeekRange = (startDate: Date) => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startLabel = startDate.toLocaleDateString(undefined, options);
  const endLabel = endDate.toLocaleDateString(undefined, options);
  return `${startLabel} – ${endLabel}, ${endDate.getFullYear()}`;
};
const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const addDays = (isoDate: string, offset: number) => {
  const base = new Date(`${isoDate}T00:00:00`);
  base.setDate(base.getDate() + offset);
  return toIsoDate(base);
};
const formatShortDate = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type ScheduleSnapshot = {
  scheduleDays: ScheduleDay[];
  segmentBlocks: SegmentBlock[];
  staffAssignments: StaffAssignment[];
  fieldTripEvents: FieldTripEvent[];
  scheduleStatusOverride: ScheduleStatus | null;
};
type WeekInitializationChoice = "blank" | "copy";
type WeekInitializationState = {
  weekId: string;
  weekLabel: string;
  startDate: string;
  previousWeekStartDate: Date;
  copySourceSnapshot: ScheduleSnapshot;
  copySourceAuditEvents: AuditEvent[];
};

const USER_POLICY_CITATION: PolicyCitation = {
  id: "ui-audit",
  name: "User schedule action",
  document: "UI action log",
  section: "N/A"
};

export default function App() {
  const [weekStartDate, setWeekStartDate] = useState(() => new Date(weekMeta.startDate));
  const currentWeekStartDateIso = useMemo(() => toIsoDate(weekStartDate), [weekStartDate]);
  const currentWeekId = useMemo(() => `week-${currentWeekStartDateIso}`, [currentWeekStartDateIso]);
  const currentWeekLabel = useMemo(() => formatWeekRange(weekStartDate), [weekStartDate]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(schools[0].id);
  const [schoolName, setSchoolName] = useState(schools[0].name);
  const [scheduleTypeOptionsState, setScheduleTypeOptionsState] = useState(
    ensureClosedScheduleType(scheduleTypeOptions)
  );
  const [fieldTripTypesState, setFieldTripTypesState] = useState(fieldTripTypes);
  const [employeesState, setEmployeesState] = useState(employees);
  const [fieldTripEventsState, setFieldTripEventsState] = useState(fieldTripEvents);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [historyPast, setHistoryPast] = useState<ScheduleSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<ScheduleSnapshot[]>([]);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [scheduleDaysState, setScheduleDaysState] = useState(scheduleDays);
  const [segmentBlocksState, setSegmentBlocksState] = useState(segmentBlocks);
  const [staffAssignmentsState, setStaffAssignmentsState] = useState(staffAssignments);
  const [showViolationNavigator, setShowViolationNavigator] = useState(false);
  const [showAuditTimeline, setShowAuditTimeline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsCloseAttempt, setSettingsCloseAttempt] = useState(0);
  const [closedDaysState, setClosedDaysState] = useState<DayOfWeek[]>([]);
  const [schoolRulesState, setSchoolRulesState] = useState<SchoolRules>({
    openerCount: 0,
    closerCount: 0,
    minimumMedicalDelegated: 0,
    requireCurrentCpr: false
  });
  const [scheduleStatusOverride, setScheduleStatusOverride] = useState<ScheduleStatus | null>(null);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const [isWeekInitialized, setIsWeekInitialized] = useState(false);
  const [loadedWeekId, setLoadedWeekId] = useState<string | null>(null);
  const [pendingWeekInitialization, setPendingWeekInitialization] = useState<WeekInitializationState | null>(null);
  const [scheduleSaveError, setScheduleSaveError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{
    state: "loading" | "saving" | "saved" | "error" | "idle";
    message: string;
  }>({
    state: "idle",
    message: "Idle"
  });
  const scheduleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePayloadRef = useRef<ScheduleSavePayload | null>(null);
  const scheduleDirtyRef = useRef(false);
  const activeApiRequestsRef = useRef(0);
  const apiStatusResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suspendHistoryRef = useRef(false);
  
  const [showAutoScheduleModal, setShowAutoScheduleModal] = useState(false);
  const [autoScheduleState, setAutoScheduleState] = useState<
    | { type: "idle" }
    | { type: "validating" }
    | { type: "missing_metadata"; missing: MissingMetadata[] }
    | { type: "confirm_replace" }
    | { type: "scheduling" }
    | { type: "complete"; success: boolean; message: string; violations: number }
  >({ type: "idle" });

  const makeSnapshot = (
    next: Partial<ScheduleSnapshot> = {},
    current?: ScheduleSnapshot
  ): ScheduleSnapshot => {
    const source =
      current ??
      ({
        scheduleDays: scheduleDaysState,
        segmentBlocks: segmentBlocksState,
        staffAssignments: staffAssignmentsState,
        fieldTripEvents: fieldTripEventsState,
        scheduleStatusOverride
      } satisfies ScheduleSnapshot);
    return {
      scheduleDays: next.scheduleDays ?? source.scheduleDays,
      segmentBlocks: next.segmentBlocks ?? source.segmentBlocks,
      staffAssignments: next.staffAssignments ?? source.staffAssignments,
      fieldTripEvents: next.fieldTripEvents ?? source.fieldTripEvents,
      scheduleStatusOverride:
        next.scheduleStatusOverride !== undefined
          ? next.scheduleStatusOverride
          : source.scheduleStatusOverride
    };
  };

  const applySnapshot = (snapshot: ScheduleSnapshot) => {
    suspendHistoryRef.current = true;
    setScheduleDaysState(snapshot.scheduleDays);
    setSegmentBlocksState(snapshot.segmentBlocks);
    setStaffAssignmentsState(snapshot.staffAssignments);
    setFieldTripEventsState(snapshot.fieldTripEvents);
    setScheduleStatusOverride(snapshot.scheduleStatusOverride);
    queueMicrotask(() => {
      suspendHistoryRef.current = false;
    });
  };

  const appendAuditEvent = (action: string, notes?: string) => {
    setAuditEvents((prev) => [
      {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        user: "You",
        action,
        policyCitation: USER_POLICY_CITATION,
        notes
      },
      ...prev
    ]);
  };

  const applyScheduleChange = (
    updater: (current: ScheduleSnapshot) => Partial<ScheduleSnapshot> | null,
    audit: { action: string; notes?: string }
  ) => {
    if (suspendHistoryRef.current) {
      return;
    }
    const current = makeSnapshot();
    const changes = updater(current);
    if (!changes) {
      return;
    }
    const next = makeSnapshot(changes, current);
    const changed =
      next.scheduleDays !== current.scheduleDays ||
      next.segmentBlocks !== current.segmentBlocks ||
      next.staffAssignments !== current.staffAssignments ||
      next.fieldTripEvents !== current.fieldTripEvents ||
      next.scheduleStatusOverride !== current.scheduleStatusOverride;
    if (!changed) {
      return;
    }
    setHistoryPast((prev) => [...prev, current]);
    setHistoryFuture([]);
    applySnapshot(next);
    appendAuditEvent(audit.action, audit.notes);
  };

  const buildDefaultScheduleDays = (weekId: string, weekStartIso: string): ScheduleDay[] =>
    daySequence.map((day, index) => {
      const isClosedDay = closedDaysState.includes(day);
      return {
        id: `${weekId}-day-${day}`,
        scheduleWeekId: weekId,
        date: addDays(weekStartIso, index),
        dayOfWeek: day,
        scheduleType: isClosedDay ? CLOSED_SCHEDULE_TYPE : undefined,
        dayScheduleType: isClosedDay ? "closed" : "full_day",
        enrollmentCount: isClosedDay ? 0 : undefined,
        fieldTripEventId: `${weekId}-field-trip-${day}`
      };
    });

  const buildDefaultFieldTripEvents = (weekId: string, scheduleDaysForWeek: ScheduleDay[]): FieldTripEvent[] =>
    scheduleDaysForWeek.map((day) => ({
      id: `${weekId}-field-trip-${day.dayOfWeek}`,
      scheduleWeekId: weekId,
      dayOfWeek: day.dayOfWeek,
      segment: "mid",
      scheduleDayId: day.id,
      isNoFieldTrip: true
    }));

  const remapSnapshotForWeek = (
    source: ScheduleSnapshot,
    sourceAudit: AuditEvent[],
    weekId: string,
    weekStartIso: string
  ): { snapshot: ScheduleSnapshot; auditEvents: AuditEvent[] } => {
    const dayIdMap = new Map<string, string>();
    const normalizedDays = daySequence.map((dayOfWeek, index) => {
      const sourceDay = source.scheduleDays.find((day) => day.dayOfWeek === dayOfWeek);
      const id = sourceDay?.id ? `${weekId}-day-${dayOfWeek}` : `${weekId}-day-${dayOfWeek}`;
      if (sourceDay?.id) dayIdMap.set(sourceDay.id, id);
      return {
        ...(sourceDay ?? {}),
        id,
        scheduleWeekId: weekId,
        date: addDays(weekStartIso, index),
        dayOfWeek
      } as ScheduleDay;
    });

    const fieldTripIdMap = new Map<string, string>();
    const normalizedFieldTrips = daySequence.map((dayOfWeek) => {
      const sourceEvent = source.fieldTripEvents.find((event) => event.dayOfWeek === dayOfWeek);
      const id = `${weekId}-field-trip-${dayOfWeek}`;
      if (sourceEvent?.id) fieldTripIdMap.set(sourceEvent.id, id);
      const targetDay = normalizedDays.find((day) => day.dayOfWeek === dayOfWeek);
      return {
        ...(sourceEvent ?? {}),
        id,
        scheduleWeekId: weekId,
        dayOfWeek,
        segment: sourceEvent?.segment ?? "mid",
        scheduleDayId: targetDay?.id
      } as FieldTripEvent;
    });

    const segmentIdMap = new Map<string, string>();
    const normalizedSegments = source.segmentBlocks.map((block, index) => {
      const id = `${weekId}-segment-${index + 1}`;
      segmentIdMap.set(block.id, id);
      return {
        ...block,
        id,
        scheduleWeekId: weekId,
        scheduleDayId: block.scheduleDayId ? dayIdMap.get(block.scheduleDayId) : undefined,
        fieldTripEventId: block.fieldTripEventId ? fieldTripIdMap.get(block.fieldTripEventId) : undefined
      };
    });

    const normalizedAssignments = source.staffAssignments.map((assignment, index) => ({
      ...assignment,
      id: `${weekId}-assignment-${index + 1}`,
      segmentBlockId: segmentIdMap.get(assignment.segmentBlockId) ?? assignment.segmentBlockId
    }));

    const normalizedDaysWithFieldTrip = normalizedDays.map((day) => ({
      ...day,
      fieldTripEventId: `${weekId}-field-trip-${day.dayOfWeek}`
    }));

    const remappedAuditEvents = sourceAudit.map((event) => ({
      ...event,
      id: `${weekId}-${event.id}`,
      timestamp: new Date().toISOString()
    }));

    return {
      snapshot: {
        scheduleDays: normalizedDaysWithFieldTrip,
        fieldTripEvents: normalizedFieldTrips,
        segmentBlocks: normalizedSegments,
        staffAssignments: normalizedAssignments,
        scheduleStatusOverride: source.scheduleStatusOverride
      },
      auditEvents: remappedAuditEvents
    };
  };

  const beginApiAction = (kind: "loading" | "saving", message: string) => {
    activeApiRequestsRef.current += 1;
    if (apiStatusResetTimer.current) {
      clearTimeout(apiStatusResetTimer.current);
    }
    setApiStatus({ state: kind, message });
  };

  const completeApiAction = (message: string) => {
    activeApiRequestsRef.current = Math.max(0, activeApiRequestsRef.current - 1);
    if (activeApiRequestsRef.current > 0) {
      return;
    }
    setApiStatus({ state: "saved", message });
    apiStatusResetTimer.current = setTimeout(() => {
      setApiStatus({ state: "idle", message: "Idle" });
    }, 2000);
  };

  const failApiAction = (message: string) => {
    activeApiRequestsRef.current = Math.max(0, activeApiRequestsRef.current - 1);
    setApiStatus({ state: "error", message });
  };

  const [jobTitlesState, setJobTitlesState] = useState<JobTitleSetting[]>(() => {
    const map = new Map<string, JobTitleSetting>();
    employees.forEach((employee) => {
      if (!map.has(employee.jobTitle)) {
        map.set(employee.jobTitle, {
          id: `job-${employee.jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          title: employee.jobTitle,
          leaderQualified: employee.leaderQualified,
          requiresLeaderForOpenClose: !employee.leaderQualified
        });
      }
    });
    return Array.from(map.values());
  });

  const [operatingHoursConfigState, setOperatingHoursConfigState] = useState<OperatingHoursConfig[]>(() => {
    const configMap = new Map<string, OperatingHoursConfig>();
    scheduleDays.forEach((day) => {
      const hours = operatingHours.find((entry) => entry.dayOfWeek === day.dayOfWeek);
      if (!hours || !day.scheduleType) {
        return;
      }
      const key = `${day.scheduleType}-${hours.open}-${hours.close}`;
      const existing = configMap.get(key);
      if (existing) {
        if (!existing.daysOfWeek.includes(day.dayOfWeek)) {
          existing.daysOfWeek.push(day.dayOfWeek);
        }
        return;
      }
      configMap.set(key, {
        id: `hours-${day.scheduleType}-${hours.open}-${hours.close}`,
        scheduleType: day.scheduleType,
        daysOfWeek: [day.dayOfWeek],
        open: hours.open,
        close: hours.close
      });
    });
    return Array.from(configMap.values());
  });

  const jobTitleLeaderMap = useMemo(() => {
    return new Map(jobTitlesState.map((title) => [title.title, title.leaderQualified]));
  }, [jobTitlesState]);

  const jobTitleRules = useMemo(() => {
    return jobTitlesState.reduce<Record<string, { requiresLeaderForOpenClose: boolean }>>((acc, title) => {
      acc[title.title] = { requiresLeaderForOpenClose: title.requiresLeaderForOpenClose };
      return acc;
    }, {});
  }, [jobTitlesState]);

  const employeesDerived = useMemo(() => {
    return employeesState.map((employee) => ({
      ...employee,
      leaderQualified: jobTitleLeaderMap.get(employee.jobTitle) ?? employee.leaderQualified,
      cprCurrent: schoolRulesState.requireCurrentCpr ? employee.cprCurrent : true
    }));
  }, [employeesState, jobTitleLeaderMap, schoolRulesState.requireCurrentCpr]);

  const scheduleStaff = useMemo(() => {
    const byId = new Map(employeesDerived.map((employee) => [employee.id, employee]));
    staffAssignmentsState.forEach((assignment) => {
      if (byId.has(assignment.employeeId)) {
        return;
      }
      byId.set(assignment.employeeId, {
        id: assignment.employeeId,
        name: `Unlinked staff (${assignment.employeeId})`,
        jobTitle: "Unknown",
        maxHoursPerDay: 24,
        maxHoursPerWeek: 168,
        employmentStatus: "active",
        leaderQualified: false,
        medicallyDelegated: false,
        cprCurrent: true,
        notes: "This assignment references a missing employee record. Re-link in Settings.",
        availability: [],
        requestedDaysOff: []
      });
    });
    return Array.from(byId.values());
  }, [employeesDerived, staffAssignmentsState]);
  const employeeNameById = useMemo(() => {
    return new Map(scheduleStaff.map((employee) => [employee.id, employee.name]));
  }, [scheduleStaff]);
  const scheduleDayById = useMemo(() => {
    return new Map(scheduleDaysState.map((day) => [day.id, day]));
  }, [scheduleDaysState]);
  const scheduleTypeLabelByValue = useMemo(() => {
    return new Map(scheduleTypeOptionsState.map((type) => [type.value, type.label]));
  }, [scheduleTypeOptionsState]);
  const fieldTripNameById = useMemo(() => {
    return new Map(fieldTripTypesState.map((trip) => [trip.id, trip.name]));
  }, [fieldTripTypesState]);
  const formatDayLabel = (dayId: string) => {
    const day = scheduleDayById.get(dayId);
    if (!day) return dayId;
    const dayName = dayDisplayNames[day.dayOfWeek] ?? day.dayOfWeek.toUpperCase();
    const dateLabel = formatShortDate(day.date);
    return `${dayName}${dateLabel ? ` ${dateLabel}` : ""}`;
  };

  const fieldTripEventsByDay = useMemo<Record<DayOfWeek, FieldTripEvent | undefined>>(() => {
    return fieldTripEventsState.reduce((map, event) => {
      map[event.dayOfWeek] = event;
      return map;
    }, {} as Record<DayOfWeek, FieldTripEvent | undefined>);
  }, [fieldTripEventsState]);

  const operatingHoursByDay = useMemo<Record<DayOfWeek, OperatingHours | undefined>>(() => {
    return daySequence.reduce((map, day) => {
      if (closedDaysState.includes(day)) {
        map[day] = undefined;
        return map;
      }
      const scheduleDay = scheduleDaysState.find((item) => item.dayOfWeek === day);
      const scheduleType = scheduleDay?.scheduleType;
      const configMatch = operatingHoursConfigState.find(
        (entry) => entry.scheduleType === scheduleType && entry.daysOfWeek.includes(day)
      );
      if (configMatch) {
        map[day] = {
          id: `hours-${day}-${configMatch.scheduleType}`,
          schoolId: selectedSchoolId,
          dayOfWeek: day,
          dayScheduleType: "full_day",
          open: configMatch.open,
          close: configMatch.close,
          notes: `${configMatch.scheduleType} operating hours`
        };
        return map;
      }
      map[day] = undefined;
      return map;
    }, {} as Record<DayOfWeek, OperatingHours | undefined>);
  }, [scheduleDaysState, operatingHoursConfigState, daySequence, selectedSchoolId, closedDaysState]);

  const openDaySequence = useMemo(() => {
    return daySequence.filter((day) => !closedDaysState.includes(day));
  }, [daySequence, closedDaysState]);

  useEffect(() => {
    const defaultOpenScheduleType =
      scheduleTypeOptionsState.find((type) => type.value !== CLOSED_SCHEDULE_TYPE)?.value;
    setScheduleDaysState((prev) =>
      prev.map((day) => {
        if (closedDaysState.includes(day.dayOfWeek)) {
          if (day.scheduleType === CLOSED_SCHEDULE_TYPE && day.dayScheduleType === "closed") {
            return day;
          }
          return {
            ...day,
            scheduleType: CLOSED_SCHEDULE_TYPE,
            dayScheduleType: "closed",
            enrollmentCount: 0
          };
        }
        if (day.scheduleType === CLOSED_SCHEDULE_TYPE) {
          return {
            ...day,
            scheduleType: defaultOpenScheduleType ?? undefined,
            dayScheduleType: "full_day"
          };
        }
        return day;
      })
    );
  }, [closedDaysState, scheduleTypeOptionsState]);

  const ratioByScheduleType = useMemo(() => {
    return scheduleTypeOptionsState.reduce<Record<string, number>>((acc, option) => {
      const adults = option.ratio?.adults ?? 0;
      const students = option.ratio?.students ?? 0;
      if (adults > 0 && students > 0) {
        acc[option.value] = students / adults;
      }
      return acc;
    }, {});
  }, [scheduleTypeOptionsState]);

  const derivedOperatingHours = useMemo<OperatingHours[]>(() => {
    return daySequence
      .map((day) => {
        const hours = operatingHoursByDay[day];
        if (!hours) {
          return undefined;
        }
        const scheduleDay = scheduleDaysState.find((item) => item.dayOfWeek === day);
        return {
          ...hours,
          dayScheduleType: scheduleDay?.dayScheduleType ?? "full_day"
        };
      })
      .filter((entry): entry is OperatingHours => Boolean(entry));
  }, [daySequence, operatingHoursByDay, scheduleDaysState]);

  const buildSettingsPayload = (overrides: Partial<{
    schoolName: string;
    closedDays: DayOfWeek[];
    schoolRules: SchoolRules;
    scheduleTypes: typeof scheduleTypeOptionsState;
    jobTitles: JobTitleSetting[];
    employees: typeof employeesState;
    operatingHours: OperatingHoursConfig[];
    fieldTripTypes: typeof fieldTripTypesState;
  }> = {}): SettingsPayloadModel => {
    const payload: SettingsPayloadModel = {};
    const hasSchoolSection =
      "schoolName" in overrides || "closedDays" in overrides || "schoolRules" in overrides;
    if (hasSchoolSection) {
      const schoolRules = overrides.schoolRules ?? schoolRulesState;
      payload.school = {
        name: overrides.schoolName ?? schoolName,
        closedDays: overrides.closedDays ?? closedDaysState,
        openerCount: schoolRules.openerCount,
        closerCount: schoolRules.closerCount,
        minimumMedicalDelegated: schoolRules.minimumMedicalDelegated,
        requireCurrentCpr: schoolRules.requireCurrentCpr
      };
    }
    if ("scheduleTypes" in overrides) {
      payload.scheduleTypes = (overrides.scheduleTypes ?? scheduleTypeOptionsState).map((type) => ({
        value: type.value,
        label: type.label,
        ratio: type.ratio,
        description: type.description
      })) as ScheduleTypePayloadModel[];
    }
    if ("jobTitles" in overrides) {
      payload.jobTitles = overrides.jobTitles ?? jobTitlesState;
    }
    if ("employees" in overrides) {
      payload.employees = (overrides.employees ?? employeesState).map((employee) => ({
        id: employee.id,
        name: employee.name,
        jobTitle: employee.jobTitle,
        maxHoursPerDay: employee.maxHoursPerDay,
        maxHoursPerWeek: employee.maxHoursPerWeek,
        employmentStatus: employee.employmentStatus,
        medicallyDelegated: employee.medicallyDelegated,
        cprCurrent: employee.cprCurrent,
        notes: employee.notes,
        availability: employee.availability ?? [],
        requestedDaysOff: employee.requestedDaysOff ?? []
      })) as EmployeePayload[];
    }
    if ("operatingHours" in overrides) {
      payload.operatingHours = overrides.operatingHours ?? operatingHoursConfigState;
    }
    if ("fieldTripTypes" in overrides) {
      payload.fieldTripTypes = (overrides.fieldTripTypes ?? fieldTripTypesState).map((trip) => ({
        name: trip.name,
        minAdultStudentRatio: trip.minAdultStudentRatio,
        minLeaderStudentRatio: trip.minLeaderStudentRatio,
        policyCitationId: trip.policyCitationId,
        notes: trip.notes
      })) as FieldTripTypePayload[];
    }
    return payload;
  };

  const persistSettings = async (overrides: Parameters<typeof buildSettingsPayload>[0] = {}) => {
    beginApiAction("saving", "Saving settings...");
    try {
      await saveSettings(selectedSchoolId, buildSettingsPayload(overrides));
      setIsConfigured(true);
      completeApiAction("Settings saved");
    } catch (error) {
      failApiAction("Settings save failed");
      // eslint-disable-next-line no-console
      console.error("Failed to save settings", error);
    }
  };

  useEffect(() => {
    let isActive = true;
    const hydrate = async () => {
      try {
        beginApiAction("loading", "Loading settings...");
        const settings = await fetchSettings(selectedSchoolId);
        completeApiAction("Settings loaded");
        if (!isActive) return;
        if (settings?.school) {
          setIsConfigured(true);
          setSchoolName(settings.school.name ?? schoolName);
          setClosedDaysState(
            (settings.school.closedDays ?? closedDaysState).filter((day): day is DayOfWeek =>
              isDayOfWeek(day)
            )
          );
          setSchoolRulesState({
            openerCount: settings.school.openerCount ?? schoolRulesState.openerCount,
            closerCount: settings.school.closerCount ?? schoolRulesState.closerCount,
            minimumMedicalDelegated:
              settings.school.minimumMedicalDelegated ?? schoolRulesState.minimumMedicalDelegated,
            requireCurrentCpr: settings.school.requireCurrentCpr ?? schoolRulesState.requireCurrentCpr
          });
          if (settings.scheduleTypes?.length) {
            setScheduleTypeOptionsState(
              ensureClosedScheduleType(
                settings.scheduleTypes.map((type) => ({
                  value: type.value,
                  label: type.label,
                  ratio: {
                    adults: type.ratioAdults ?? 1,
                    students: type.ratioStudents ?? 1
                  },
                  description: type.description ?? ""
                }))
              )
            );
          }
          if (settings.jobTitles?.length) {
            setJobTitlesState(
              settings.jobTitles.map((title) => ({
                id: title.id,
                title: title.title,
                leaderQualified: title.leaderQualified,
                requiresLeaderForOpenClose: title.requiresLeaderForOpenClose
              }))
            );
          }
          if (settings.employees?.length) {
            const jobTitleLookup = new Map(
              (settings.jobTitles ?? []).map((title) => [title.title, title.leaderQualified])
            );
            setEmployeesState(
              settings.employees.map((employee) => ({
                ...employee,
                leaderQualified: jobTitleLookup.get(employee.jobTitle) ?? false,
                employmentStatus: coerceEmploymentStatus(employee.employmentStatus),
                availability: employee.availability ?? [],
                requestedDaysOff: employee.requestedDaysOff ?? []
              }))
            );
          }
          if (settings.operatingHours?.length) {
            setOperatingHoursConfigState(
              settings.operatingHours.map((entry) => ({
                id: entry.id,
                scheduleType: entry.scheduleType,
                daysOfWeek: (entry.daysOfWeek ?? []).filter((day): day is DayOfWeek =>
                  isDayOfWeek(day)
                ),
                open: entry.open,
                close: entry.close
              }))
            );
          }
          if (settings.fieldTripTypes?.length) {
            setFieldTripTypesState(
              settings.fieldTripTypes.map((trip) => ({
                ...trip,
                policyCitationId: trip.policyCitationId ?? "policy-field-trip"
              }))
            );
          }
        } else {
          setIsConfigured(false);
          setShowSettings(true);
        }
      } catch (error) {
        failApiAction("Settings load failed");
        // eslint-disable-next-line no-console
        console.error("Failed to load settings", error);
      }

    };

    hydrate();

    return () => {
      isActive = false;
    };
  }, [selectedSchoolId]);

  useEffect(() => {
    let isActive = true;
    const sourceSnapshot = makeSnapshot();
    const sourceAudit = auditEvents;
    const previousWeekStartDate = new Date(weekStartDate);

    const loadScheduleWeek = async () => {
      setHasLoadedRemote(false);
      setIsWeekInitialized(false);
      setLoadedWeekId(null);
      setPendingWeekInitialization(null);
      beginApiAction("loading", "Loading schedule...");
      try {
        const schedule = await fetchSchedule(currentWeekId);
        completeApiAction("Schedule loaded");
        if (!isActive) return;
        if (schedule) {
          const loadedScheduleDaysRaw = (schedule.scheduleDays ?? []).map((day: ScheduleDay) => ({
            ...day,
            date: day.date ? new Date(day.date).toISOString().split("T")[0] : day.date
          }));
          const loadedScheduleDaysByDow = new Map(
            loadedScheduleDaysRaw.map((day) => [day.dayOfWeek, day] as const)
          );
          const loadedScheduleDays: ScheduleDay[] = daySequence.map((dayOfWeek, index) => {
            const existing = loadedScheduleDaysByDow.get(dayOfWeek);
            const defaultDate = addDays(currentWeekStartDateIso, index);
            const isClosed = closedDaysState.includes(dayOfWeek);
            const defaultScheduleType = isClosed ? CLOSED_SCHEDULE_TYPE : undefined;
            const defaultDayScheduleType: ScheduleDay["dayScheduleType"] = isClosed ? "closed" : "full_day";
            const defaultEnrollment = isClosed ? 0 : undefined;
            if (existing) {
              const normalizedScheduleType = existing.scheduleType ?? defaultScheduleType;
              return {
                ...existing,
                scheduleWeekId: currentWeekId,
                dayOfWeek,
                date: existing.date ?? defaultDate,
                scheduleType: normalizedScheduleType,
                dayScheduleType:
                  existing.dayScheduleType ??
                  ((normalizedScheduleType === CLOSED_SCHEDULE_TYPE ? "closed" : "full_day") as ScheduleDay["dayScheduleType"]),
                enrollmentCount:
                  normalizedScheduleType === CLOSED_SCHEDULE_TYPE ? (existing.enrollmentCount ?? 0) : existing.enrollmentCount,
                fieldTripEventId: existing.fieldTripEventId ?? `${currentWeekId}-field-trip-${dayOfWeek}`
              };
            }
            return {
              id: `${currentWeekId}-day-${dayOfWeek}`,
              scheduleWeekId: currentWeekId,
              date: defaultDate,
              dayOfWeek,
              scheduleType: defaultScheduleType,
              dayScheduleType: defaultDayScheduleType,
              enrollmentCount: defaultEnrollment,
              fieldTripEventId: `${currentWeekId}-field-trip-${dayOfWeek}`
            };
          });

          const scheduleDayIdByDow = new Map(loadedScheduleDays.map((day) => [day.dayOfWeek, day.id] as const));
          const loadedSegmentBlocks = schedule.segmentBlocks ?? [];
          const loadedStaffAssignments = schedule.staffAssignments ?? [];
          const loadedFieldTripByDay = new Map(
            (schedule.fieldTripEvents ?? []).map((event) => [event.dayOfWeek, event] as const)
          );
          const loadedFieldTripEvents: FieldTripEvent[] = daySequence.map((dayOfWeek) => {
            const event = loadedFieldTripByDay.get(dayOfWeek);
            if (event) {
              return {
                ...event,
                scheduleWeekId: currentWeekId,
                dayOfWeek,
                scheduleDayId: event.scheduleDayId ?? scheduleDayIdByDow.get(dayOfWeek),
                isNoFieldTrip: event.fieldTripTypeId ? false : (event.isNoFieldTrip ?? true),
                signedOffAt: event.signedOffAt ? new Date(event.signedOffAt).toISOString() : event.signedOffAt
              };
            }
            return {
              id: `${currentWeekId}-field-trip-${dayOfWeek}`,
              scheduleWeekId: currentWeekId,
              dayOfWeek,
              segment: "mid" as const,
              scheduleDayId: scheduleDayIdByDow.get(dayOfWeek),
              isNoFieldTrip: true
            };
          });
          const loadedSnapshot: ScheduleSnapshot = {
            scheduleDays: loadedScheduleDays,
            segmentBlocks: loadedSegmentBlocks,
            staffAssignments: loadedStaffAssignments,
            fieldTripEvents: loadedFieldTripEvents,
            scheduleStatusOverride: schedule.status ?? null
          };
          applySnapshot(loadedSnapshot);
          setHistoryPast([]);
          setHistoryFuture([]);
          setAuditEvents(schedule.auditEvents ?? []);
          setHasLoadedRemote(true);
          setIsWeekInitialized(true);
          setLoadedWeekId(currentWeekId);
          return;
        }

        setPendingWeekInitialization({
          weekId: currentWeekId,
          weekLabel: currentWeekLabel,
          startDate: currentWeekStartDateIso,
          previousWeekStartDate,
          copySourceSnapshot: sourceSnapshot,
          copySourceAuditEvents: sourceAudit
        });
      } catch (error) {
        failApiAction("Schedule load failed");
        // eslint-disable-next-line no-console
        console.error("Failed to load schedule", error);
      }
    };

    loadScheduleWeek();
    return () => {
      isActive = false;
    };
  }, [selectedSchoolId, currentWeekId]);

  useEffect(() => {
    if (!hasLoadedRemote || !isConfigured || !isWeekInitialized || loadedWeekId !== currentWeekId) return;
    const payload: ScheduleSavePayload = {
      scheduleWeek: {
        id: currentWeekId,
        schoolId: selectedSchoolId,
        label: currentWeekLabel,
        status: scheduleStatusOverride ?? "draft",
        startDate: currentWeekStartDateIso
      },
      scheduleDays: scheduleDaysState,
      segmentBlocks: segmentBlocksState,
      staffAssignments: staffAssignmentsState,
      fieldTripEvents: fieldTripEventsState,
      auditEvents
    };
    schedulePayloadRef.current = payload;
    scheduleDirtyRef.current = true;
    if (scheduleSaveTimer.current) {
      clearTimeout(scheduleSaveTimer.current);
    }
    scheduleSaveTimer.current = setTimeout(() => {
      const latestPayload = schedulePayloadRef.current;
      if (!latestPayload) {
        return;
      }
      beginApiAction("saving", "Saving schedule...");
      saveSchedule(currentWeekId, latestPayload)
        .then(() => {
          scheduleDirtyRef.current = false;
          setScheduleSaveError(null);
          completeApiAction("Schedule saved");
        })
        .catch((error) => {
          setScheduleSaveError("Autosave failed. Changes will retry automatically.");
          failApiAction("Schedule save failed");
          // eslint-disable-next-line no-console
          console.error("Failed to save schedule", error);
        });
    }, 300);

    return () => {
      if (scheduleSaveTimer.current) {
        clearTimeout(scheduleSaveTimer.current);
      }
    };
  }, [
    hasLoadedRemote,
    isConfigured,
    isWeekInitialized,
    currentWeekId,
    currentWeekLabel,
    currentWeekStartDateIso,
    selectedSchoolId,
    scheduleDaysState,
    segmentBlocksState,
    staffAssignmentsState,
    fieldTripEventsState,
    scheduleStatusOverride,
    auditEvents,
    loadedWeekId
  ]);

  useEffect(() => {
    if (!hasLoadedRemote || !isConfigured || !isWeekInitialized || loadedWeekId !== currentWeekId) {
      return;
    }
    const handleBeforeUnload = () => {
      const pendingPayload = schedulePayloadRef.current;
      if (!pendingPayload || !scheduleDirtyRef.current) {
        return;
      }
      void fetch(`/api/schedule/${currentWeekId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pendingPayload),
        keepalive: true
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasLoadedRemote, isConfigured, isWeekInitialized, loadedWeekId, currentWeekId]);

  useEffect(() => {
    return () => {
      if (apiStatusResetTimer.current) {
        clearTimeout(apiStatusResetTimer.current);
      }
    };
  }, []);

  const engine = useMemo(() => createRulesEngine(), []);
  const ruleViolationsFromEngine = useMemo(() => {
    const context: RulesContext = {
      segmentBlocks: segmentBlocksState,
      staffAssignments: staffAssignmentsState,
      employees: employeesDerived,
      fieldTripEvents: fieldTripEventsState,
      fieldTripTypes: fieldTripTypesState,
      policyCitations: POLICY_CITATION_LIST,
      rulePolicyCitations: RULE_POLICY_CITATIONS,
      scheduleDays: scheduleDaysState,
      operatingHours: derivedOperatingHours,
      scheduleTypeRatios: ratioByScheduleType,
      schoolRules: schoolRulesState,
      jobTitleRules
    };
    return engine.evaluate(context);
  }, [
    engine,
    fieldTripEventsState,
    segmentBlocksState,
    staffAssignmentsState,
    employeesDerived,
    fieldTripTypesState,
    POLICY_CITATION_LIST,
    scheduleDaysState,
    derivedOperatingHours,
    schoolRulesState,
    jobTitleRules,
    ratioByScheduleType
  ]);

  const resolveSegmentBlockId = (target: EngineRuleViolation["target"]) => {
    if (target.entity === "SegmentBlock") {
      return target.id;
    }
    if (target.entity === "StaffAssignment") {
      const assignment = staffAssignmentsState.find((item) => item.id === target.id);
      return assignment?.segmentBlockId;
    }
    if (target.entity === "FieldTripEvent") {
      const byEventId = segmentBlocksState.find((block) => block.fieldTripEventId === target.id)?.id;
      if (byEventId) {
        return byEventId;
      }
      const dayOfWeek = String(target.metadata?.dayOfWeek ?? "");
      if (isDayOfWeek(dayOfWeek)) {
        return segmentBlocksState.find((block) => block.dayOfWeek === dayOfWeek)?.id;
      }
      return undefined;
    }
    if (target.entity === "ScheduleDay") {
      const scheduleDayId = target.id.includes(":") ? target.id.split(":")[0] : target.id;
      const day = scheduleDaysState.find((item) => item.id === scheduleDayId);
      if (!day) {
        return undefined;
      }
      return segmentBlocksState.find((block) => block.scheduleDayId === day.id || block.dayOfWeek === day.dayOfWeek)?.id;
    }
    return undefined;
  };

  const getSegmentDisplayLabel = (segmentId?: string) => {
    if (!segmentId) {
      return "Clock block";
    }
    const block = segmentBlocksState.find((item) => item.id === segmentId);
    if (!block) {
      return "Clock block";
    }
    const dayLabel = dayDisplayNames[block.dayOfWeek]?.toUpperCase() ?? block.dayOfWeek.toUpperCase();
    return `${dayLabel} ${block.startTime}-${block.endTime}`;
  };

  const violationRecords = useMemo(() => {
    return ruleViolationsFromEngine.map((engineViolation) => {
      const citation: PolicyCitation =
        policyCitations[engineViolation.citationId ?? ""] ??
        ({
          id: engineViolation.citationId ?? "unknown",
          name: RULE_TITLES[engineViolation.ruleId] ?? "Policy violation",
          document: "Rules engine"
        } as PolicyCitation);
      const segmentBlockId = resolveSegmentBlockId(engineViolation.target) ?? engineViolation.target.id;
      const relatedSegmentBlockIds = Array.isArray(engineViolation.target.metadata?.relatedSegmentBlockIds)
        ? (engineViolation.target.metadata?.relatedSegmentBlockIds as string[])
        : [];
      const segmentLabel = getSegmentDisplayLabel(segmentBlockId);
      const relatedLabel = relatedSegmentBlockIds[0]
        ? getSegmentDisplayLabel(relatedSegmentBlockIds[0])
        : "";
      const description = engineViolation.ruleId === "segment-block-timeline" &&
        relatedSegmentBlockIds.length > 0 &&
        relatedLabel
        ? `${segmentLabel} overlaps ${relatedLabel}.`
        : engineViolation.message;

      const dayFromMetadata = String(engineViolation.target.metadata?.dayOfWeek ?? "");
      let dayOfWeek: DayOfWeek | undefined = isDayOfWeek(dayFromMetadata) ? dayFromMetadata : undefined;
      if (!dayOfWeek && segmentBlockId) {
        const block = segmentBlocksState.find((item) => item.id === segmentBlockId);
        dayOfWeek = block?.dayOfWeek;
      }
      if (!dayOfWeek && engineViolation.target.entity === "ScheduleDay") {
        const scheduleDayId = engineViolation.target.id.includes(":")
          ? engineViolation.target.id.split(":")[0]
          : engineViolation.target.id;
        const day = scheduleDaysState.find((item) => item.id === scheduleDayId);
        dayOfWeek = day?.dayOfWeek;
      }
      if (!dayOfWeek && engineViolation.target.entity === "FieldTripEvent") {
        const event = fieldTripEventsState.find((item) => item.id === engineViolation.target.id);
        dayOfWeek = event?.dayOfWeek;
      }
      if (!dayOfWeek && engineViolation.target.entity === "StaffAssignment") {
        const assignment = staffAssignmentsState.find((item) => item.id === engineViolation.target.id);
        const block = assignment
          ? segmentBlocksState.find((item) => item.id === assignment.segmentBlockId)
          : undefined;
        dayOfWeek = block?.dayOfWeek;
      }
      const dayRecord = dayOfWeek
        ? scheduleDaysState.find((item) => item.dayOfWeek === dayOfWeek)
        : undefined;
      const formattedDate = dayRecord?.date
        ? new Date(dayRecord.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : undefined;
      const dayLabel = dayOfWeek
        ? `${dayDisplayNames[dayOfWeek]}${formattedDate ? ` ${formattedDate}` : ""}`
        : undefined;
      const metadata = engineViolation.target.metadata as Record<string, unknown> | undefined;
      let issue = engineViolation.message;
      let contextDetail: string | undefined;
      if (engineViolation.ruleId === "ratio-segment") {
        const required = Number(metadata?.required ?? Number.NaN);
        const actual = Number(metadata?.actual ?? Number.NaN);
        const minStaff = Number(metadata?.minStaff ?? Number.NaN);
        const ratio = Number(metadata?.ratioChildrenPerStaff ?? Number.NaN);
        const headcount = Number(metadata?.childCount ?? Number.NaN);
        const ratioSource = String(metadata?.ratioSource ?? "");
        if (Number.isFinite(required) && Number.isFinite(actual)) {
          issue = `Requires ${required} staff but only ${actual} are scheduled`;
        }
        if (Number.isFinite(minStaff) || Number.isFinite(ratio) || Number.isFinite(headcount)) {
          const sourceLabel =
            ratioSource === "fieldTrip" ? "Field Trip" : ratioSource === "scheduleType" ? "Schedule Type" : "Rule";
          const pieces = [
            Number.isFinite(minStaff) ? `Minimum Staff Scheduled: ${minStaff}` : undefined,
            Number.isFinite(ratio) ? `Ratio From "${sourceLabel}": 1:${ratio}` : undefined,
            Number.isFinite(headcount) ? `Headcount: ${headcount}` : undefined
          ].filter(Boolean);
          contextDetail = pieces.join(", ");
        }
      }

      return {
        id: engineViolation.id,
        title: RULE_TITLES[engineViolation.ruleId] ?? engineViolation.ruleId,
        severity: SEVERITY_MAP[engineViolation.severity] ?? "warning",
        description,
        dayLabel,
        issue,
        context: contextDetail,
        segmentBlockId,
        relatedSegmentBlockIds,
        policyCitation: citation,
        recommendedAction: RECOMMENDED_ACTIONS[engineViolation.ruleId] ?? "Review the segment and adjust coverage.",
        metadata: engineViolation.target.metadata
      } satisfies UiRuleViolation;
    });
  }, [ruleViolationsFromEngine, policyCitations, segmentBlocksState, staffAssignmentsState, scheduleDaysState]);

  const validationComplete = violationRecords.length === 0;
  const readyToPublish = validationComplete;
  const scheduleStatus: ScheduleStatus = readyToPublish
    ? "ready_for_review"
    : scheduleStatusOverride ?? "draft";
  const weekLabel = currentWeekLabel;
  const complianceHighlights = [
    `${violationRecords.length} violation${violationRecords.length === 1 ? "" : "s"} outstanding`,
    readyToPublish ? "Ready for publish" : "Resolve blockers before publishing"
  ];

  const guidedSteps: GuidedStep[] = [
    { id: "draft", label: "Draft workspace", detail: "Add staff and break coverage before running validation.", status: "complete" },
    {
      id: "validation",
      label: "Validation",
      detail: "Violations link directly to the timeline; fixes re-run the engine automatically.",
      status: validationComplete ? "complete" : "in_progress",
      actionLabel: validationComplete ? undefined : "Review violations"
    },
    {
      id: "publish",
      label: "Ready to publish",
      detail: "Publish only when every validation step is clear.",
      status: readyToPublish ? "in_progress" : "blocked",
      actionLabel: "Publish schedule",
      actionDisabled: !readyToPublish
    }
  ];

  const handleWeekShift = (direction: WeekDirection) => {
    setPendingWeekInitialization(null);
    setHasLoadedRemote(false);
    setIsWeekInitialized(false);
    setLoadedWeekId(null);
    setWeekStartDate((current) => {
      const updated = new Date(current);
      updated.setDate(updated.getDate() + (direction === "next" ? 7 : -7));
      return updated;
    });
  };

  const handleInitializeWeek = async (choice: WeekInitializationChoice) => {
    if (!pendingWeekInitialization) {
      return;
    }
    const { weekId, weekLabel: targetWeekLabel, startDate, copySourceSnapshot, copySourceAuditEvents } =
      pendingWeekInitialization;

    let nextSnapshot: ScheduleSnapshot;
    let nextAuditEvents: AuditEvent[];
    if (choice === "copy") {
      const copied = remapSnapshotForWeek(copySourceSnapshot, copySourceAuditEvents, weekId, startDate);
      nextSnapshot = copied.snapshot;
      nextAuditEvents = copied.auditEvents;
    } else {
      const blankDays = buildDefaultScheduleDays(weekId, startDate);
      nextSnapshot = {
        scheduleDays: blankDays,
        fieldTripEvents: buildDefaultFieldTripEvents(weekId, blankDays),
        segmentBlocks: [],
        staffAssignments: [],
        scheduleStatusOverride: "draft"
      };
      nextAuditEvents = [];
    }

    const initializationEvent: AuditEvent = {
      id: `${weekId}-audit-init-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: "You",
      action: "Initialized week",
      policyCitation: USER_POLICY_CITATION,
      notes: `${targetWeekLabel}: ${choice === "copy" ? "Copied previous week schedule" : "Created blank schedule"}`
    };
    const payloadAuditEvents = [initializationEvent, ...nextAuditEvents];

    const payload: ScheduleSavePayload = {
      scheduleWeek: {
        id: weekId,
        schoolId: selectedSchoolId,
        label: targetWeekLabel,
        status: "draft",
        startDate
      },
      scheduleDays: nextSnapshot.scheduleDays,
      segmentBlocks: nextSnapshot.segmentBlocks,
      staffAssignments: nextSnapshot.staffAssignments,
      fieldTripEvents: nextSnapshot.fieldTripEvents,
      auditEvents: payloadAuditEvents
    };

    beginApiAction("saving", "Creating schedule...");
    try {
      await saveSchedule(weekId, payload);
      applySnapshot(nextSnapshot);
      setAuditEvents(payloadAuditEvents);
      setHistoryPast([]);
      setHistoryFuture([]);
      setPendingWeekInitialization(null);
      setIsWeekInitialized(true);
      setHasLoadedRemote(true);
      setLoadedWeekId(weekId);
      scheduleDirtyRef.current = false;
      schedulePayloadRef.current = payload;
      completeApiAction("Schedule created");
    } catch (error) {
      failApiAction("Failed to create schedule");
      // eslint-disable-next-line no-console
      console.error("Failed to initialize week schedule", error);
    }
  };

  const handleCancelWeekInitialization = () => {
    if (!pendingWeekInitialization) {
      return;
    }
    setPendingWeekInitialization(null);
    setWeekStartDate(new Date(pendingWeekInitialization.previousWeekStartDate));
  };

  const handleEnrollmentUpdate = (dayId: string, enrollment: number | undefined) => {
    const dayLabel = formatDayLabel(dayId);
    applyScheduleChange(
      (current) => ({
        scheduleDays: current.scheduleDays.map((day) =>
          day.id === dayId ? { ...day, enrollmentCount: enrollment } : day
        )
      }),
      { action: "Updated enrollment", notes: `${dayLabel}: ${enrollment ?? "unset"} students` }
    );
  };

  const handleScheduleTypeUpdate = (dayId: string, scheduleType: ScheduleType | undefined) => {
    const dayLabel = formatDayLabel(dayId);
    const typeLabel = scheduleType ? (scheduleTypeLabelByValue.get(scheduleType) ?? scheduleType) : "unset";
    applyScheduleChange(
      (current) => ({
        scheduleDays: current.scheduleDays.map((day) => {
        if (day.id !== dayId) {
          return day;
        }
        if (scheduleType === CLOSED_SCHEDULE_TYPE) {
          return {
            ...day,
            scheduleType,
            dayScheduleType: "closed",
            enrollmentCount: 0
          };
        }
        return {
          ...day,
          scheduleType,
          dayScheduleType: day.dayScheduleType === "closed" ? "full_day" : day.dayScheduleType
        };
        })
      }),
      {
        action: "Updated schedule type",
        notes: `${dayLabel}: ${typeLabel}`
      }
    );
  };

  const handleFieldTripSelection = (dayId: string, selection: FieldTripSelection) => {
    const day = scheduleDaysState.find((item) => item.id === dayId);
    const dayOfWeek = day?.dayOfWeek;
    const dayLabel = formatDayLabel(dayId);
    applyScheduleChange(
      (current) => ({
        fieldTripEvents: current.fieldTripEvents.map((event) => {
        const matchesDay = event.scheduleDayId === dayId || (dayOfWeek ? event.dayOfWeek === dayOfWeek : false);
        if (!matchesDay) {
          return event;
        }
        if (selection.type === "none") {
          return {
            ...event,
            fieldTripTypeId: undefined,
            isNoFieldTrip: true,
            approverId: undefined,
            signedOffAt: undefined,
            notes: "No field trip selected"
          };
        }
        return {
          ...event,
          fieldTripTypeId: selection.fieldTripTypeId,
          isNoFieldTrip: false,
          approverId: undefined,
          signedOffAt: undefined,
          notes: "Field trip metadata needs review"
        };
        })
      }),
      {
        action: "Updated field trip selection",
        notes:
          selection.type === "none"
            ? `${dayLabel}: No Field Trip`
            : `${dayLabel}: ${fieldTripNameById.get(selection.fieldTripTypeId) ?? selection.fieldTripTypeId}`
      }
    );
  };

  const handleStepAction = (stepId: string) => {
    if (stepId === "publish") {
      handlePublish();
    }
    if (stepId === "validation") {
      setShowViolationNavigator(true);
    }
  };

  const [focusedSegmentIds, setFocusedSegmentIds] = useState<string[]>([]);
  const focusResetRef = useRef<number | null>(null);

  const handleFocusSegments = (segmentIds: string[]) => {
    setFocusedSegmentIds(segmentIds);
    if (focusResetRef.current) {
      window.clearTimeout(focusResetRef.current);
    }
    focusResetRef.current = window.setTimeout(() => {
      setFocusedSegmentIds((prev) => (prev.length ? [] : prev));
    }, 6000);
  };

  const handlePublish = () => {
    if (!readyToPublish) return;
    setPublishMessage(`Schedule published ${new Date().toLocaleString()}`);
  };

  const handleUndo = () => {
    setHistoryPast((past) => {
      if (past.length === 0) {
        return past;
      }
      const previous = past[past.length - 1];
      const current = makeSnapshot();
      setHistoryFuture((future) => [...future, current]);
      applySnapshot(previous);
      appendAuditEvent("Undo", "Reverted the latest schedule change");
      return past.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setHistoryFuture((future) => {
      if (future.length === 0) {
        return future;
      }
      const next = future[future.length - 1];
      const current = makeSnapshot();
      setHistoryPast((past) => [...past, current]);
      applySnapshot(next);
      appendAuditEvent("Redo", "Re-applied the latest undone schedule change");
      return future.slice(0, -1);
    });
  };

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      if (target.isContentEditable) {
        return true;
      }
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        handleRedo();
        return;
      }
      handleUndo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleRedo, handleUndo]);

  const handleUpdateAssignmentTime = (assignmentId: string, startTime: string, endTime: string) => {
    const assignment = staffAssignmentsState.find((item) => item.id === assignmentId);
    const segment = assignment
      ? segmentBlocksState.find((block) => block.id === assignment.segmentBlockId)
      : undefined;
    const employeeName = assignment ? (employeeNameById.get(assignment.employeeId) ?? assignment.employeeId) : assignmentId;
    const dayName = segment ? (dayDisplayNames[segment.dayOfWeek] ?? segment.dayOfWeek.toUpperCase()) : "";
    applyScheduleChange(
      (current) => ({
        staffAssignments: current.staffAssignments.map((assignment) =>
          assignment.id === assignmentId ? { ...assignment, startTime, endTime } : assignment
        )
      }),
      { action: "Updated assignment time", notes: `${employeeName}${dayName ? ` (${dayName})` : ""}: ${startTime}-${endTime}` }
    );
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    const assignment = staffAssignmentsState.find((item) => item.id === assignmentId);
    const employeeName = assignment ? (employeeNameById.get(assignment.employeeId) ?? assignment.employeeId) : assignmentId;
    const segment = assignment
      ? segmentBlocksState.find((block) => block.id === assignment.segmentBlockId)
      : undefined;
    const dayName = segment ? (dayDisplayNames[segment.dayOfWeek] ?? segment.dayOfWeek.toUpperCase()) : "";
    const timeRange = segment ? `${segment.startTime}-${segment.endTime}` : "";
    applyScheduleChange(
      (current) => {
        const target = current.staffAssignments.find((item) => item.id === assignmentId);
        if (!target) {
          return null;
        }
        const nextAssignments = current.staffAssignments.filter((item) => item.id !== assignmentId);
        const segmentStillUsed = nextAssignments.some((item) => item.segmentBlockId === target.segmentBlockId);
        return {
          staffAssignments: nextAssignments,
          segmentBlocks: segmentStillUsed
            ? current.segmentBlocks
            : current.segmentBlocks.filter((block) => block.id !== target.segmentBlockId)
        };
      },
      {
        action: "Deleted time block",
        notes: `${employeeName}${dayName ? ` (${dayName})` : ""}${timeRange ? ` ${timeRange}` : ""}`
      }
    );
  };

  const handleReassignUnlinkedStaff = (fromEmployeeId: string, toEmployeeId: string) => {
    if (!fromEmployeeId || !toEmployeeId || fromEmployeeId === toEmployeeId) {
      return;
    }
    applyScheduleChange(
      (current) => {
        const rewritten = current.staffAssignments.map((assignment) =>
          assignment.employeeId === fromEmployeeId
            ? { ...assignment, employeeId: toEmployeeId }
            : assignment
        );
        const uniqueByCoverage = new Map<string, (typeof rewritten)[number]>();
        rewritten.forEach((assignment) => {
          const key = [
            assignment.segmentBlockId,
            assignment.employeeId,
            assignment.startTime,
            assignment.endTime
          ].join("|");
          if (!uniqueByCoverage.has(key)) {
            uniqueByCoverage.set(key, assignment);
          }
        });
        return {
          staffAssignments: Array.from(uniqueByCoverage.values())
        };
      },
      {
        action: "Reassigned unlinked staff",
        notes: `${employeeNameById.get(fromEmployeeId) ?? fromEmployeeId} -> ${
          employeeNameById.get(toEmployeeId) ?? toEmployeeId
        }`
      }
    );
  };

  const displayAuditEvents = useMemo(() => {
    const replacements = new Map<string, string>();
    employeeNameById.forEach((name, id) => replacements.set(id, name));
    scheduleDayById.forEach((_, id) => replacements.set(id, formatDayLabel(id)));
    fieldTripNameById.forEach((name, id) => replacements.set(id, name));
    return auditEvents.map((event) => {
      if (!event.notes) return event;
      let notes = event.notes;
      replacements.forEach((value, key) => {
        notes = notes.replace(new RegExp(`\\b${escapeRegex(key)}\\b`, "g"), value);
      });
      return { ...event, notes };
    });
  }, [auditEvents, employeeNameById, fieldTripNameById, scheduleDayById]);

  const handleUpdateScheduleTypes = (next: typeof scheduleTypeOptionsState) => {
    const nextWithClosed = ensureClosedScheduleType(next);
    setScheduleTypeOptionsState(nextWithClosed);
    void persistSettings({ scheduleTypes: nextWithClosed });
  };

  const handleUpdateJobTitles = (next: JobTitleSetting[]) => {
    setJobTitlesState(next);
    void persistSettings({ jobTitles: next });
  };

  const handleUpdateOperatingHours = (next: OperatingHoursConfig[]) => {
    setOperatingHoursConfigState(next);
    void persistSettings({ operatingHours: next });
  };

  const handleUpdateClosedDays = (next: DayOfWeek[]) => {
    setClosedDaysState(next);
    void persistSettings({ closedDays: next });
  };

  const handleUpdateSchoolName = (next: string) => {
    setSchoolName(next);
    void persistSettings({ schoolName: next });
  };

  const handleUpdateSchoolRules = (next: SchoolRules) => {
    setSchoolRulesState(next);
    void persistSettings({ schoolRules: next });
  };

  const handleUpdateFieldTrips = (next: typeof fieldTripTypesState) => {
    setFieldTripTypesState(next);
    void persistSettings({ fieldTripTypes: next });
  };

  const handleUpdateEmployees = (next: typeof employeesState) => {
    setEmployeesState(next);
    void persistSettings({ employees: next });
  };

  const handleAutoSchedule = () => {
    // First, validate that all days have metadata
    const missingMetadata = validateDayMetadata(scheduleDaysState);
    
    if (missingMetadata.length > 0) {
      setAutoScheduleState({ type: "missing_metadata", missing: missingMetadata });
      setShowAutoScheduleModal(true);
      return;
    }
    
    // Check if there are existing assignments
    const hasExistingAssignments = staffAssignmentsState.length > 0;
    
    if (hasExistingAssignments) {
      setAutoScheduleState({ type: "confirm_replace" });
      setShowAutoScheduleModal(true);
    } else {
      executeAutoSchedule(false);
    }
  };

  const executeAutoSchedule = (keepExisting: boolean) => {
    setAutoScheduleState({ type: "scheduling" });
    setShowAutoScheduleModal(true);
    
    // Use setTimeout to allow UI to update with spinner
    setTimeout(() => {
      try {
        const result = autoSchedule(
          {
            scheduleDays: scheduleDaysState,
            segmentBlocks: segmentBlocksState,
            staffAssignments: staffAssignmentsState,
            employees: employeesDerived,
            fieldTripEvents: fieldTripEventsState,
            operatingHours: derivedOperatingHours,
            scheduleTypeRatios: ratioByScheduleType,
            schoolRules: schoolRulesState,
            jobTitleRules,
            fieldTripTypes: fieldTripTypesState,
            policyCitations: POLICY_CITATION_LIST,
            rulePolicyCitations: RULE_POLICY_CITATIONS
          },
          currentWeekId,
          !keepExisting // startFromEmpty = !keepExisting
        );

        // The autoScheduler now handles the keepExisting logic internally
        // Simply use the results directly
        applyScheduleChange(
          () => ({
            staffAssignments: result.staffAssignments,
            segmentBlocks: result.segmentBlocks
          }),
          {
            action: keepExisting 
              ? "Auto-scheduled: fixed violations in existing schedule"
              : "Auto-scheduled: created new schedule from scratch",
            notes: result.message
          }
        );

        setAutoScheduleState({
          type: "complete",
          success: result.success,
          message: result.message,
          violations: result.violations.length
        });

        // If there are violations, auto-open the violations panel after a brief delay
        if (result.violations.length > 0) {
          setTimeout(() => {
            setShowViolationNavigator(true);
          }, 2000);
        }
      } catch (error) {
        setAutoScheduleState({
          type: "complete",
          success: false,
          message: error instanceof Error ? error.message : "An error occurred during auto-scheduling",
          violations: 0
        });
      }
    }, 100);
  };

  const closeAutoScheduleModal = () => {
    setShowAutoScheduleModal(false);
    setTimeout(() => {
      setAutoScheduleState({ type: "idle" });
    }, 300);
  };

  return (
    <MotionConfig transition={{ type: "tween", ease: "linear", duration: 0.2 }}>
      <motion.div
        layout="position"
        transition={{ layout: { type: "tween", ease: "linear", duration: 0.2 } }}
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #eef2ff, #f8fafc)",
          padding: "2rem",
          fontFamily: "Inter, system-ui, sans-serif",
          color: "#111827"
        }}
      >
      <style>{`
        * {
          transition: background-color 0.2s linear, border-color 0.2s linear, color 0.2s linear,
            box-shadow 0.2s linear, opacity 0.2s linear;
        }
        button, input, select, textarea {
          transition: background-color 0.2s linear, border-color 0.2s linear, color 0.2s linear,
            box-shadow 0.2s linear, opacity 0.2s linear;
        }
      `}</style>
      <WeekNavigationBanner
        schoolOptions={schools}
        selectedSchoolId={selectedSchoolId}
        onSchoolChange={setSelectedSchoolId}
        weekLabel={weekLabel}
        status={scheduleStatus}
        complianceHighlights={complianceHighlights}
        onShiftWeek={handleWeekShift}
        onOpenViolations={() => setShowViolationNavigator((prev) => !prev)}
        onOpenAuditTimeline={() => setShowAuditTimeline((prev) => !prev)}
        hasViolations={violationRecords.length > 0}
        isViolationsOpen={showViolationNavigator}
        isAuditOpen={showAuditTimeline}
        apiStatus={apiStatus}
        onAutoSchedule={handleAutoSchedule}
        onOpenSettings={() => {
          if (showSettings && settingsDirty) {
            setSettingsCloseAttempt((prev) => prev + 1);
            return;
          }
          setShowSettings((prev) => !prev);
        }}
        isSettingsOpen={showSettings}
      />
      <motion.div
        layout="position"
        transition={{ layout: { type: "tween", ease: "linear", duration: 0.2 } }}
        style={{ marginTop: "1rem", marginBottom: "1.5rem" }}
      >
        <GuidedStatusTracker steps={guidedSteps} onStepAction={handleStepAction} />
        {publishMessage && (
          <p style={{ margin: "0.5rem 0 0", color: "#0f172a", fontSize: "0.85rem" }}>{publishMessage}</p>
        )}
        {scheduleSaveError && (
          <p style={{ margin: "0.5rem 0 0", color: "#b91c1c", fontSize: "0.85rem" }}>{scheduleSaveError}</p>
        )}
      </motion.div>

      <motion.div
        layout="position"
        transition={{ layout: { type: "tween", ease: "linear", duration: 0.2 } }}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
      >
        <ScheduleMatrix
          staff={scheduleStaff}
          employeeOptions={employeesDerived}
          assignments={staffAssignmentsState}
          segmentBlocks={segmentBlocksState}
          days={scheduleDaysState}
          daySequence={openDaySequence}
          dayDisplayNames={dayDisplayNames}
          scheduleTypeOptions={scheduleTypeOptionsState}
          fieldTripTypes={fieldTripTypesState}
          fieldTripEventsByDay={fieldTripEventsByDay}
          operatingHoursByDay={operatingHoursByDay}
          onEnrollmentChange={handleEnrollmentUpdate}
          onScheduleTypeChange={handleScheduleTypeUpdate}
          onFieldTripSelection={handleFieldTripSelection}
          onUpdateAssignmentTime={handleUpdateAssignmentTime}
          onDeleteAssignment={handleDeleteAssignment}
          onReassignUnlinkedStaff={handleReassignUnlinkedStaff}
          onCreateAssignment={({ employeeId, dayOfWeek, startTime, endTime }) => {
            applyScheduleChange(
              (current) => {
                const scheduleDay = current.scheduleDays.find((day) => day.dayOfWeek === dayOfWeek);
                const existingBlock = current.segmentBlocks.find((block) => {
                  return (
                    block.dayOfWeek === dayOfWeek &&
                    block.startTime === startTime &&
                    block.endTime === endTime &&
                    block.scheduleDayId === scheduleDay?.id
                  );
                });
                const segmentId = existingBlock?.id ?? `segment-${dayOfWeek}-custom-${Date.now()}`;
                const newBlock: SegmentBlock | null = existingBlock
                  ? null
                  : {
                      id: segmentId,
                      scheduleWeekId: currentWeekId,
                      dayOfWeek,
                      segment: "open",
                      startTime,
                      endTime,
                      childCount: scheduleDay?.enrollmentCount ?? 0,
                      status: "draft",
                      scheduleDayId: scheduleDay?.id
                    };
                const nextAssignments = [
                  ...current.staffAssignments.filter((assignment) => {
                    return !(
                      assignment.segmentBlockId === segmentId &&
                      assignment.employeeId === employeeId &&
                      assignment.startTime === startTime &&
                      assignment.endTime === endTime
                    );
                  }),
                  {
                    id: `assign-${segmentId}-${employeeId}`,
                    segmentBlockId: segmentId,
                    employeeId,
                    assignmentSource: "manual_adjustment" as const,
                    startTime,
                    endTime,
                    status: "scheduled" as const
                  }
                ];
                return {
                  staffAssignments: nextAssignments,
                  segmentBlocks: newBlock ? [...current.segmentBlocks, newBlock] : current.segmentBlocks
                };
              },
              {
                action: "Created assignment",
                notes: `${employeeNameById.get(employeeId) ?? employeeId} (${dayDisplayNames[dayOfWeek]}): ${startTime}-${endTime}`
              }
            );
          }}
          focusedSegmentIds={focusedSegmentIds}
        />
      </motion.div>

      <AnimatePresence>
        {showViolationNavigator && (
          <ViolationNavigator
            violations={violationRecords}
            onFocusSegments={handleFocusSegments}
            isOpen={showViolationNavigator}
            onClose={() => setShowViolationNavigator(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAuditTimeline && (
          <AuditTimeline
            events={displayAuditEvents}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyPast.length > 0}
            canRedo={historyFuture.length > 0}
            isOpen={showAuditTimeline}
            onClose={() => setShowAuditTimeline(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSettings && (
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        schoolName={schoolName}
        schoolRules={schoolRulesState}
        scheduleTypes={scheduleTypeOptionsState}
        jobTitles={jobTitlesState}
        operatingHoursConfig={operatingHoursConfigState}
        closedDays={closedDaysState}
        fieldTripTypes={fieldTripTypesState}
        employees={employeesState}
        onUpdateScheduleTypes={handleUpdateScheduleTypes}
        onUpdateJobTitles={handleUpdateJobTitles}
        onUpdateOperatingHoursConfig={handleUpdateOperatingHours}
        onUpdateClosedDays={handleUpdateClosedDays}
        onUpdateSchoolName={handleUpdateSchoolName}
        onUpdateSchoolRules={handleUpdateSchoolRules}
        onUpdateFieldTrips={handleUpdateFieldTrips}
        onUpdateEmployees={handleUpdateEmployees}
        onDirtyChange={setSettingsDirty}
        closeAttempt={settingsCloseAttempt}
      />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pendingWeekInitialization && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "linear" }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.35)",
              zIndex: 70,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.5rem"
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "linear" }}
              style={{
                width: "min(520px, 100%)",
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                boxShadow: "0 24px 48px rgba(15, 23, 42, 0.24)",
                padding: "1rem 1.1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem"
              }}
            >
              <h3 style={{ margin: 0 }}>No schedule exists for {pendingWeekInitialization.weekLabel}</h3>
              <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
                Choose how to initialize this week.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleCancelWeekInitialization}
                  style={{
                    borderRadius: 999,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#0f172a",
                    padding: "0.35rem 0.85rem"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleInitializeWeek("blank");
                  }}
                  style={{
                    borderRadius: 999,
                    border: "1px solid #cbd5f5",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    padding: "0.35rem 0.85rem"
                  }}
                >
                  Create blank schedule
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleInitializeWeek("copy");
                  }}
                  style={{
                    borderRadius: 999,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    padding: "0.35rem 0.9rem"
                  }}
                >
                  Copy current schedule
                </button>
              </div>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAutoScheduleModal && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "linear" }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.35)",
              zIndex: 70,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.5rem"
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "linear" }}
              style={{
                width: "min(520px, 100%)",
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                boxShadow: "0 24px 48px rgba(15, 23, 42, 0.24)",
                padding: "1rem 1.1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem"
              }}
            >
              {autoScheduleState.type === "missing_metadata" && (
                <>
                  <h3 style={{ margin: 0 }}>Missing Day Metadata</h3>
                  <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
                    The following days are missing required information. Please populate these fields before auto-scheduling:
                  </p>
                  <div style={{ background: "#fff7f6", borderRadius: 8, padding: "0.75rem", border: "1px solid #fee2e2" }}>
                    {autoScheduleState.missing.map((item) => (
                      <div key={item.dayOfWeek} style={{ marginBottom: "0.5rem" }}>
                        <strong>{dayDisplayNames[item.dayOfWeek]}:</strong> {item.missingFields.join(", ")}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={closeAutoScheduleModal}
                      style={{
                        borderRadius: 999,
                        border: "none",
                        background: "#2563eb",
                        color: "#fff",
                        padding: "0.35rem 0.9rem"
                      }}
                    >
                      OK
                    </button>
                  </div>
                </>
              )}
              
              {autoScheduleState.type === "confirm_replace" && (
                <>
                  <h3 style={{ margin: 0 }}>Existing Staff Assignments</h3>
                  <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
                    There are already staff assignments for this week. Would you like to:
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={closeAutoScheduleModal}
                      style={{
                        borderRadius: 999,
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        color: "#0f172a",
                        padding: "0.35rem 0.85rem"
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => executeAutoSchedule(true)}
                      style={{
                        borderRadius: 999,
                        border: "1px solid #cbd5f5",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        padding: "0.35rem 0.85rem"
                      }}
                    >
                      Keep existing assignments
                    </button>
                    <button
                      type="button"
                      onClick={() => executeAutoSchedule(false)}
                      style={{
                        borderRadius: 999,
                        border: "none",
                        background: "#2563eb",
                        color: "#fff",
                        padding: "0.35rem 0.9rem"
                      }}
                    >
                      Start from scratch
                    </button>
                  </div>
                </>
              )}
              
              {autoScheduleState.type === "scheduling" && (
                <>
                  <h3 style={{ margin: 0 }}>Auto-Scheduling...</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem" }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        border: "4px solid #e5e7eb",
                        borderTopColor: "#2563eb",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite"
                      }}
                    />
                    <p style={{ margin: 0, color: "#475569" }}>
                      Generating staff assignments and resolving violations...
                    </p>
                  </div>
                  <style>{`
                    @keyframes spin {
                      to { transform: rotate(360deg); }
                    }
                  `}</style>
                </>
              )}
              
              {autoScheduleState.type === "complete" && (
                <>
                  <h3 style={{ margin: 0 }}>
                    {autoScheduleState.success ? "✓ Auto-Scheduling Complete" : "Auto-Scheduling Complete"}
                  </h3>
                  <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
                    {autoScheduleState.message}
                  </p>
                  {autoScheduleState.violations > 0 && (
                    <div style={{ background: "#fff7f6", borderRadius: 8, padding: "0.75rem", border: "1px solid #fee2e2" }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#991b1b" }}>
                        {autoScheduleState.violations} violation(s) remain. The violations panel will open to help you resolve them.
                      </p>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={closeAutoScheduleModal}
                      style={{
                        borderRadius: 999,
                        border: "none",
                        background: "#2563eb",
                        color: "#fff",
                        padding: "0.35rem 0.9rem"
                      }}
                    >
                      OK
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}
