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
  auditTimeline,
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
} from "./data/mockScheduleData";
import { GuidedStep, RuleViolation as UiRuleViolation } from "./types";
import {
  DayOfWeek,
  FieldTripEvent,
  OperatingHours,
  PolicyCitation,
  ScheduleStatus,
  ScheduleType,
  SegmentBlock
} from "../domain/types";
import { createRulesEngine } from "../rules/engine";
import type { RuleViolation as EngineRuleViolation, RulesContext } from "../rules/types";
import { fetchSchedule, fetchSettings, saveSchedule, saveSettings } from "./data/apiClient";

const RULE_TITLES: Record<string, string> = {
  "ratio-segment": "Ratio staffing gap",
  "certification-per-segment": "Certification missing",
  "segment-coverage": "Coverage guardrail",
  "shift-break-limits": "Shift limit breach",
  "field-trip-ratios": "Field trip ratio",
  "open-close-coverage": "Open/close coverage",
  "medical-delegated-coverage": "Medical delegation",
  "cpr-current-required": "CPR current required"
};

const RECOMMENDED_ACTIONS: Record<string, string> = {
  "ratio-segment": "Add a certified staff member or adjust child counts so the segment meets the ratio.",
  "certification-per-segment": "Reassign staff with the required CPR, medical delegation, or leader qualification.",
  "segment-coverage": "Bring a leader-qualified or medically delegated staff member into the block.",
  "shift-break-limits": "Split the shift into shorter blocks or assign a break to stay under the cap.",
  "field-trip-ratios": "Reconcile adult and leader counts with the ratio required for this trip.",
  "open-close-coverage": "Add the required opener/closer coverage and ensure a leader-qualified staff member is present.",
  "medical-delegated-coverage": "Assign medically delegated staff to meet the minimum requirement.",
  "cpr-current-required": "Replace the staff member with a current CPR certification."
};

const RULE_POLICY_CITATIONS = {
  "ratio-segment": policyCitations.ratio.id,
  "certification-per-segment": policyCitations.ratio.id,
  "segment-coverage": policyCitations.leaderCoverage.id,
  "shift-break-limits": policyCitations.breakPolicy.id,
  "field-trip-ratios": policyCitations.fieldTrip.id,
  "open-close-coverage": policyCitations.leaderCoverage.id,
  "medical-delegated-coverage": policyCitations.breakPolicy.id,
  "cpr-current-required": policyCitations.breakPolicy.id
} as const;

const SEVERITY_MAP: Record<EngineRuleViolation["severity"], UiRuleViolation["severity"]> = {
  error: "critical",
  warning: "warning"
};

const POLICY_CITATION_LIST = Object.values(policyCitations);

type WeekDirection = "prev" | "next";

const formatWeekRange = (startDate: Date) => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startLabel = startDate.toLocaleDateString(undefined, options);
  const endLabel = endDate.toLocaleDateString(undefined, options);
  return `${startLabel} – ${endLabel}, ${endDate.getFullYear()}`;
};

export default function App() {
  const [weekStartDate, setWeekStartDate] = useState(() => new Date(weekMeta.startDate));
  const [selectedSchoolId, setSelectedSchoolId] = useState(schools[0].id);
  const [schoolName, setSchoolName] = useState(schools[0].name);
  const [scheduleTypeOptionsState, setScheduleTypeOptionsState] = useState(scheduleTypeOptions);
  const [fieldTripTypesState, setFieldTripTypesState] = useState(fieldTripTypes);
  const [employeesState, setEmployeesState] = useState(employees);
  const [fieldTripEventsState, setFieldTripEventsState] = useState(fieldTripEvents);
  const [undoCount, setUndoCount] = useState(2);
  const [redoCount, setRedoCount] = useState(0);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [scheduleDaysState, setScheduleDaysState] = useState(scheduleDays);
  const [segmentBlocksState, setSegmentBlocksState] = useState(segmentBlocks);
  const [staffAssignmentsState, setStaffAssignmentsState] = useState(staffAssignments);
  const [showViolationNavigator, setShowViolationNavigator] = useState(false);
  const [showAuditTimeline, setShowAuditTimeline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsCloseAttempt, setSettingsCloseAttempt] = useState(0);
  const [closedDaysState, setClosedDaysState] = useState<DayOfWeek[]>(["sat", "sun"]);
  const [schoolRulesState, setSchoolRulesState] = useState<SchoolRules>({
    openerCount: 2,
    closerCount: 2,
    minimumMedicalDelegated: 1,
    requireCurrentCpr: true
  });
  const [scheduleStatusOverride, setScheduleStatusOverride] = useState<ScheduleStatus | null>(null);
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);
  const scheduleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const entries: OperatingHours[] = [];
    operatingHoursConfigState.forEach((entry) => {
      entry.daysOfWeek.forEach((day) => {
        if (closedDaysState.includes(day)) {
          return;
        }
        entries.push({
          id: `hours-${entry.scheduleType}-${day}`,
          schoolId: selectedSchoolId,
          dayOfWeek: day,
          dayScheduleType: "full_day",
          open: entry.open,
          close: entry.close,
          notes: `${entry.scheduleType} operating hours`
        });
      });
    });
    return entries;
  }, [operatingHoursConfigState, selectedSchoolId, closedDaysState]);

  const buildSettingsPayload = (overrides: Partial<{
    schoolName: string;
    closedDays: DayOfWeek[];
    schoolRules: SchoolRules;
    scheduleTypes: typeof scheduleTypeOptionsState;
    jobTitles: JobTitleSetting[];
    employees: typeof employeesState;
    operatingHours: OperatingHoursConfig[];
    fieldTripTypes: typeof fieldTripTypesState;
  }> = {}) => {
    const schoolRules = overrides.schoolRules ?? schoolRulesState;
    return {
      school: {
        name: overrides.schoolName ?? schoolName,
        closedDays: overrides.closedDays ?? closedDaysState,
        openerCount: schoolRules.openerCount,
        closerCount: schoolRules.closerCount,
        minimumMedicalDelegated: schoolRules.minimumMedicalDelegated,
        requireCurrentCpr: schoolRules.requireCurrentCpr
      },
      scheduleTypes: overrides.scheduleTypes ?? scheduleTypeOptionsState,
      jobTitles: overrides.jobTitles ?? jobTitlesState,
      employees: overrides.employees ?? employeesState,
      operatingHours: overrides.operatingHours ?? operatingHoursConfigState,
      fieldTripTypes: overrides.fieldTripTypes ?? fieldTripTypesState
    };
  };

  const persistSettings = async (overrides: Parameters<typeof buildSettingsPayload>[0] = {}) => {
    if (!hasLoadedRemote) return;
    try {
      await saveSettings(selectedSchoolId, buildSettingsPayload(overrides));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to save settings", error);
    }
  };

  useEffect(() => {
    let isActive = true;
    const hydrate = async () => {
      try {
        const settings = await fetchSettings(selectedSchoolId);
        if (!isActive) return;
        if (settings?.school) {
          setSchoolName(settings.school.name ?? schoolName);
          setClosedDaysState(settings.school.closedDays ?? closedDaysState);
          setSchoolRulesState({
            openerCount: settings.school.openerCount ?? schoolRulesState.openerCount,
            closerCount: settings.school.closerCount ?? schoolRulesState.closerCount,
            minimumMedicalDelegated:
              settings.school.minimumMedicalDelegated ?? schoolRulesState.minimumMedicalDelegated,
            requireCurrentCpr: settings.school.requireCurrentCpr ?? schoolRulesState.requireCurrentCpr
          });
          if (settings.scheduleTypes?.length) {
            setScheduleTypeOptionsState(
              settings.scheduleTypes.map((type: any) => ({
                value: type.value,
                label: type.label,
                ratio: { adults: type.ratioAdults ?? type.ratio?.adults ?? 1, students: type.ratioStudents ?? type.ratio?.students ?? 1 },
                description: type.description ?? ""
              }))
            );
          }
          if (settings.jobTitles?.length) {
            setJobTitlesState(
              settings.jobTitles.map((title: any) => ({
                id: title.id,
                title: title.title,
                leaderQualified: title.leaderQualified,
                requiresLeaderForOpenClose: title.requiresLeaderForOpenClose
              }))
            );
          }
          if (settings.employees?.length) {
            setEmployeesState(settings.employees);
          }
          if (settings.operatingHours?.length) {
            setOperatingHoursConfigState(
              settings.operatingHours.map((entry: any) => ({
                id: entry.id,
                scheduleType: entry.scheduleType,
                daysOfWeek: entry.daysOfWeek ?? [],
                open: entry.open,
                close: entry.close
              }))
            );
          }
          if (settings.fieldTripTypes?.length) {
            setFieldTripTypesState(settings.fieldTripTypes);
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to load settings", error);
      }

      try {
        const schedule = await fetchSchedule(weekMeta.id);
        if (!isActive) return;
        if (schedule) {
          if (schedule.status) {
            setScheduleStatusOverride(schedule.status);
          }
          if (schedule.scheduleDays?.length) {
            setScheduleDaysState(
              schedule.scheduleDays.map((day: any) => ({
                ...day,
                date: day.date ? new Date(day.date).toISOString().split("T")[0] : day.date
              }))
            );
          }
          if (schedule.segmentBlocks?.length) {
            setSegmentBlocksState(schedule.segmentBlocks);
          }
          if (schedule.staffAssignments?.length) {
            setStaffAssignmentsState(schedule.staffAssignments);
          }
          if (schedule.fieldTripEvents?.length) {
            setFieldTripEventsState(
              schedule.fieldTripEvents.map((event: any) => ({
                ...event,
                signedOffAt: event.signedOffAt ? new Date(event.signedOffAt).toISOString() : event.signedOffAt
              }))
            );
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to load schedule", error);
      }

      if (isActive) {
        setHasLoadedRemote(true);
      }
    };

    hydrate();

    return () => {
      isActive = false;
    };
  }, [selectedSchoolId]);

  useEffect(() => {
    if (!hasLoadedRemote) return;
    if (scheduleSaveTimer.current) {
      clearTimeout(scheduleSaveTimer.current);
    }
    scheduleSaveTimer.current = setTimeout(() => {
      saveSchedule(weekMeta.id, {
        scheduleWeek: {
          schoolId: selectedSchoolId,
          label: weekMeta.label,
          status: scheduleStatusOverride ?? weekMeta.status,
          startDate: weekMeta.startDate
        },
        scheduleDays: scheduleDaysState,
        segmentBlocks: segmentBlocksState,
        staffAssignments: staffAssignmentsState,
        fieldTripEvents: fieldTripEventsState
      }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Failed to save schedule", error);
      });
    }, 800);

    return () => {
      if (scheduleSaveTimer.current) {
        clearTimeout(scheduleSaveTimer.current);
      }
    };
  }, [
    hasLoadedRemote,
    selectedSchoolId,
    scheduleDaysState,
    segmentBlocksState,
    staffAssignmentsState,
    fieldTripEventsState,
    scheduleStatusOverride
  ]);

  const engine = useMemo(() => createRulesEngine(), []);
  const ruleViolationsFromEngine = useMemo(() => {
    const context: RulesContext = {
      segmentBlocks: segmentBlocksState.map((block) => {
        const scheduleDay = scheduleDaysState.find((day) => day.id === block.scheduleDayId);
        if (!scheduleDay?.scheduleType) {
          return block;
        }
        const ratio = ratioByScheduleType[scheduleDay.scheduleType];
        if (!ratio) {
          return block;
        }
        return {
          ...block,
          requirementTemplate: {
            ...block.requirementTemplate,
            ratioProfile: {
              ...block.requirementTemplate.ratioProfile,
              childrenPerStaff: ratio
            }
          }
        };
      }),
      staffAssignments: staffAssignmentsState,
      employees: employeesDerived,
      fieldTripEvents: fieldTripEventsState,
      fieldTripTypes: fieldTripTypesState,
      policyCitations: POLICY_CITATION_LIST,
      rulePolicyCitations: RULE_POLICY_CITATIONS,
      scheduleDays: scheduleDaysState,
      operatingHours: derivedOperatingHours,
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
      return segmentBlocksState.find((block) => block.fieldTripEventId === target.id)?.id;
    }
    return undefined;
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

      return {
        id: engineViolation.id,
        title: RULE_TITLES[engineViolation.ruleId] ?? engineViolation.ruleId,
        severity: SEVERITY_MAP[engineViolation.severity] ?? "warning",
        description: engineViolation.message,
        segmentBlockId,
        policyCitation: citation,
        recommendedAction: RECOMMENDED_ACTIONS[engineViolation.ruleId] ?? "Review the segment and adjust coverage.",
        metadata: engineViolation.target.metadata
      } satisfies UiRuleViolation;
    });
  }, [ruleViolationsFromEngine, policyCitations, segmentBlocksState, staffAssignmentsState]);

  const validationComplete = violationRecords.length === 0;
  const readyToPublish = validationComplete;
  const scheduleStatus: ScheduleStatus = readyToPublish
    ? "ready_for_review"
    : scheduleStatusOverride ?? weekMeta.status;
  const weekLabel = formatWeekRange(weekStartDate);
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
    setWeekStartDate((current) => {
      const updated = new Date(current);
      updated.setDate(updated.getDate() + (direction === "next" ? 7 : -7));
      return updated;
    });
  };

  const handleEnrollmentUpdate = (dayId: string, enrollment: number | undefined) => {
    setScheduleDaysState((prev) =>
      prev.map((day) => (day.id === dayId ? { ...day, enrollmentCount: enrollment } : day))
    );
  };

  const handleScheduleTypeUpdate = (dayId: string, scheduleType: ScheduleType | undefined) => {
    setScheduleDaysState((prev) => prev.map((day) => (day.id === dayId ? { ...day, scheduleType } : day)));
  };

  const handleFieldTripSelection = (dayId: string, selection: FieldTripSelection) => {
    setFieldTripEventsState((prev) =>
      prev.map((event) => {
        if (event.scheduleDayId !== dayId) {
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

  const handleFocusSegment = (_segmentId: string) => {
    // Timeline view removed in favor of the matrix; keep for navigator actions.
  };

  const handlePublish = () => {
    if (!readyToPublish) return;
    setPublishMessage(`Schedule published ${new Date().toLocaleString()}`);
  };

  const handleUndo = () => {
    setUndoCount((value) => Math.max(0, value - 1));
    setRedoCount((value) => value + 1);
  };

  const handleRedo = () => {
    setRedoCount((value) => Math.max(0, value - 1));
    setUndoCount((value) => value + 1);
  };

  const handleUpdateAssignmentTime = (assignmentId: string, startTime: string, endTime: string) => {
    setStaffAssignmentsState((prev) =>
      prev.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, startTime, endTime } : assignment
      )
    );
  };

  const handleUpdateScheduleTypes = (next: typeof scheduleTypeOptionsState) => {
    setScheduleTypeOptionsState(next);
    void persistSettings({ scheduleTypes: next });
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
      </motion.div>

      <motion.div
        layout="position"
        transition={{ layout: { type: "tween", ease: "linear", duration: 0.2 } }}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
      >
        <ScheduleMatrix
          staff={employeesDerived}
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
          onCreateAssignment={({ employeeId, dayOfWeek, startTime, endTime }) => {
            const scheduleDay = scheduleDaysState.find((day) => day.dayOfWeek === dayOfWeek);
            const segmentId = `segment-${dayOfWeek}-custom-${Date.now()}`;
            const newBlock: SegmentBlock = {
              id: segmentId,
              scheduleWeekId: weekMeta.id,
              dayOfWeek,
              segment: "open",
              startTime,
              endTime,
              childCount: scheduleDay?.enrollmentCount ?? 0,
              requirementTemplate: segmentBlocksState[0]?.requirementTemplate ?? segmentBlocks[0].requirementTemplate,
              status: "draft",
              scheduleDayId: scheduleDay?.id
            };
            setStaffAssignmentsState((prev) => [
              ...prev,
              {
                id: `assign-${segmentId}-${employeeId}`,
                segmentBlockId: segmentId,
                employeeId,
                assignmentSource: "manual_adjustment",
                startTime,
                endTime,
                status: "scheduled"
              }
            ]);
            setSegmentBlocksState((prev) => [...prev, newBlock]);
          }}
        />
      </motion.div>

      <AnimatePresence>
        {showViolationNavigator && (
          <ViolationNavigator
            violations={violationRecords}
            onFocusSegment={handleFocusSegment}
            isOpen={showViolationNavigator}
            onClose={() => setShowViolationNavigator(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAuditTimeline && (
          <AuditTimeline
            events={auditTimeline}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoCount > 0}
            canRedo={redoCount > 0}
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
      </motion.div>
    </MotionConfig>
  );
}
