import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DayOfWeek, FieldTripType, Employee, ScheduleType } from "@core/domain/types";
import { colors, shadows } from "../theme";
import {
  EmployeesSection,
  FieldTripsSection,
  JobTitlesSection,
  OperatingHoursSection,
  ScheduleTypesSection,
  SchoolSettingsSection
} from "./settings";
import type { ScheduleTypeOption } from "./DayMetadataStrip";
import HelpIconButton from "./HelpIconButton";
import type { HelpTopicId } from "./helpContent";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName: string;
  schoolRules: SchoolRules;
  scheduleTypes: ScheduleTypeOption[];
  jobTitles: JobTitleSetting[];
  operatingHoursConfig: OperatingHoursConfig[];
  closedDays: DayOfWeek[];
  fieldTripTypes: FieldTripType[];
  employees: Employee[];
  onUpdateScheduleTypes: (next: ScheduleTypeOption[]) => void;
  onUpdateJobTitles: (next: JobTitleSetting[]) => void;
  onUpdateOperatingHoursConfig: (next: OperatingHoursConfig[]) => void;
  onUpdateClosedDays: (next: DayOfWeek[]) => void;
  onUpdateSchoolName: (next: string) => void;
  onUpdateSchoolRules: (next: SchoolRules) => void;
  onUpdateFieldTrips: (next: FieldTripType[]) => void;
  onUpdateEmployees: (next: Employee[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
  closeAttempt?: number;
  onOpenHelpTopic?: (topicId: HelpTopicId) => void;
}

export interface JobTitleSetting {
  id: string;
  title: string;
  leaderQualified: boolean;
  requiresLeaderForOpenClose: boolean;
}

export interface OperatingHoursConfig {
  id: string;
  scheduleType: ScheduleType;
  daysOfWeek: DayOfWeek[];
  open: string;
  close: string;
}

export interface SchoolRules {
  openerCount: number;
  closerCount: number;
  fieldTripStartTime: string;
  fieldTripEndTime: string;
  minimumMedicalDelegated: number;
  requireCurrentCpr: boolean;
}

type SettingsTab = "school" | "scheduleTypes" | "operatingHours" | "fieldTrips" | "jobTitles" | "employees";

const emptyScheduleType = (): ScheduleTypeOption => ({
  value: `custom-${Date.now()}`,
  label: "New type",
  ratio: { adults: 1, students: 10 },
  description: ""
});

const emptyFieldTrip = (): FieldTripType => ({
  id: `ft-${Date.now()}`,
  name: "New field trip",
  adultRatioAdults: 1,
  adultRatioStudents: 10,
  leaderRatioAdults: 1,
  leaderRatioStudents: 12,
  policyCitationId: "policy-field-trip",
  notes: ""
});

const fullDayAvailability = (): Employee["availability"] =>
  (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as DayOfWeek[]).map((dayOfWeek) => ({
    dayOfWeek,
    blocks: [{ startTime: "00:00", endTime: "23:59" }]
  }));

const emptyEmployee = (): Employee => ({
  id: `emp-${Date.now()}`,
  name: "New employee",
  email: "",
  phone: "",
  jobTitle: "",
  maxHoursPerDay: 8,
  maxHoursPerWeek: 40,
  employmentStatus: "active",
  leaderQualified: false,
  medicallyDelegated: false,
  cprCurrent: false,
  notes: "",
  availability: fullDayAvailability(),
  requestedDaysOff: []
});

const emptyJobTitle = (): JobTitleSetting => ({
  id: `job-${Date.now()}`,
  title: "New title",
  leaderQualified: false,
  requiresLeaderForOpenClose: false
});

const emptyOperatingHours = (scheduleType: ScheduleType): OperatingHoursConfig => ({
  id: `hours-${Date.now()}`,
  scheduleType,
  daysOfWeek: ["mon", "tue", "wed", "thu", "fri"],
  open: "07:00",
  close: "17:00"
});

export default function SettingsPanel({
  isOpen,
  onClose,
  schoolName,
  schoolRules,
  scheduleTypes,
  jobTitles,
  operatingHoursConfig,
  closedDays,
  fieldTripTypes,
  employees,
  onUpdateScheduleTypes,
  onUpdateJobTitles,
  onUpdateOperatingHoursConfig,
  onUpdateClosedDays,
  onUpdateSchoolName,
  onUpdateSchoolRules,
  onUpdateFieldTrips,
  onUpdateEmployees,
  onDirtyChange,
  closeAttempt,
  onOpenHelpTopic
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("school");
  const jobTitleOptions = useMemo(() => jobTitles.map((title) => title.title), [jobTitles]);
  const allDays: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  const [draftSchoolName, setDraftSchoolName] = useState(schoolName);
  const [draftClosedDays, setDraftClosedDays] = useState<DayOfWeek[]>(closedDays);
  const [draftSchoolRules, setDraftSchoolRules] = useState<SchoolRules>(schoolRules);
  const [draftScheduleTypes, setDraftScheduleTypes] = useState<ScheduleTypeOption[]>(scheduleTypes);
  const [draftOperatingHours, setDraftOperatingHours] = useState<OperatingHoursConfig[]>(operatingHoursConfig);
  const [draftFieldTrips, setDraftFieldTrips] = useState<FieldTripType[]>(fieldTripTypes);
  const [draftJobTitles, setDraftJobTitles] = useState<JobTitleSetting[]>(jobTitles);
  const [draftEmployees, setDraftEmployees] = useState<Employee[]>(employees);

  const normalizeScheduleTypeValue = (value: string) => value.trim().toLowerCase();

  const operatingScheduleTypeOptions = useMemo(
    () =>
      draftScheduleTypes.filter(
        (option) => normalizeScheduleTypeValue(option.value) !== "closed"
      ),
    [draftScheduleTypes]
  );

  useEffect(() => {
    const fallback = operatingScheduleTypeOptions[0]?.value;
    if (!fallback) {
      return;
    }
    setDraftOperatingHours((prev) => {
      let didChange = false;
      const next = prev.map((entry) => {
        if (normalizeScheduleTypeValue(entry.scheduleType) !== "closed") {
          return entry;
        }
        didChange = true;
        return { ...entry, scheduleType: fallback as ScheduleType };
      });
      return didChange ? next : prev;
    });
  }, [operatingScheduleTypeOptions]);

  const [dirtyTabs, setDirtyTabs] = useState<Record<SettingsTab, boolean>>({
    school: false,
    scheduleTypes: false,
    operatingHours: false,
    fieldTrips: false,
    jobTitles: false,
    employees: false
  });
  const [tabWarning, setTabWarning] = useState<string | null>(null);

  const markDirty = (tab: SettingsTab) =>
    setDirtyTabs((prev) => ({ ...prev, [tab]: true }));

  const resetDirty = (tab: SettingsTab) =>
    setDirtyTabs((prev) => ({ ...prev, [tab]: false }));

  const isAnyDirty = Object.values(dirtyTabs).some(Boolean);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDraftSchoolName(schoolName);
    setDraftClosedDays(closedDays);
    setDraftSchoolRules(schoolRules);
    setDraftScheduleTypes(scheduleTypes);
    setDraftOperatingHours(operatingHoursConfig);
    setDraftFieldTrips(fieldTripTypes);
    setDraftJobTitles(jobTitles);
    setDraftEmployees(employees);
    setDirtyTabs({
      school: false,
      scheduleTypes: false,
      operatingHours: false,
      fieldTrips: false,
      jobTitles: false,
      employees: false
    });
    setTabWarning(null);
  }, [isOpen, schoolName, closedDays, schoolRules, scheduleTypes, operatingHoursConfig, fieldTripTypes, jobTitles, employees]);

  useEffect(() => {
    onDirtyChange?.(isAnyDirty);
  }, [isAnyDirty, onDirtyChange]);

  useEffect(() => {
    if (!closeAttempt) {
      return;
    }
    if (isAnyDirty) {
      setTabWarning("Save or discard changes before closing settings.");
    }
  }, [closeAttempt, isAnyDirty]);

  const handleTabChange = (nextTab: SettingsTab) => {
    if (dirtyTabs[activeTab]) {
      setTabWarning("Save or discard changes before leaving this section.");
      return;
    }
    setTabWarning(null);
    setActiveTab(nextTab);
  };

  const operatingHoursOverlap = useMemo(() => {
    const conflicts: string[] = [];
    const byType = new Map<string, Map<DayOfWeek, number>>();
    draftOperatingHours.forEach((entry) => {
      if (!byType.has(entry.scheduleType)) {
        byType.set(entry.scheduleType, new Map());
      }
      const dayMap = byType.get(entry.scheduleType)!;
      entry.daysOfWeek.forEach((day) => {
        const count = dayMap.get(day) ?? 0;
        dayMap.set(day, count + 1);
      });
    });
    byType.forEach((dayMap, scheduleType) => {
      dayMap.forEach((count, day) => {
        if (count > 1) {
          conflicts.push(`${scheduleType} has overlapping coverage on ${day.toUpperCase()}`);
        }
      });
    });
    return conflicts;
  }, [draftOperatingHours]);

  const canSaveOperatingHours = dirtyTabs.operatingHours && operatingHoursOverlap.length === 0;

  const saveActiveTab = () => {
    if (activeTab === "school") {
      onUpdateSchoolName(draftSchoolName);
      onUpdateClosedDays(draftClosedDays);
      onUpdateSchoolRules(draftSchoolRules);
      resetDirty("school");
      setTabWarning(null);
      return;
    }
    if (activeTab === "scheduleTypes") {
      onUpdateScheduleTypes(draftScheduleTypes);
      resetDirty("scheduleTypes");
      setTabWarning(null);
      return;
    }
    if (activeTab === "operatingHours") {
      if (operatingHoursOverlap.length > 0) {
        return;
      }
      onUpdateOperatingHoursConfig(draftOperatingHours);
      resetDirty("operatingHours");
      setTabWarning(null);
      return;
    }
    if (activeTab === "fieldTrips") {
      onUpdateFieldTrips(draftFieldTrips);
      resetDirty("fieldTrips");
      setTabWarning(null);
      return;
    }
    if (activeTab === "jobTitles") {
      onUpdateJobTitles(draftJobTitles);
      resetDirty("jobTitles");
      setTabWarning(null);
      return;
    }
    onUpdateEmployees(draftEmployees);
    resetDirty("employees");
    setTabWarning(null);
  };

  const canSaveActiveTab =
    activeTab === "operatingHours" ? canSaveOperatingHours : dirtyTabs[activeTab];
  const helpTopicByTab: Record<SettingsTab, HelpTopicId> = {
    school: "settings-school",
    scheduleTypes: "settings-schedule-types",
    operatingHours: "settings-operating-hours",
    fieldTrips: "settings-field-trips",
    jobTitles: "settings-job-titles",
    employees: "settings-employees"
  };

  if (!isOpen) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "linear" }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "clamp(0.5rem, 2.5vw, 3rem) clamp(0.5rem, 2vw, 2rem)",
        zIndex: 50
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "linear" }}
        style={{
          width: "min(1080px, 100%)",
          background: colors.surface,
          borderRadius: 18,
          boxShadow: shadows.card,
          border: `1px solid ${colors.borderSubtle}`,
          overflow: "hidden",
          maxHeight: "calc(100vh - 1.25rem)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
            background: "#e2e8f0"
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "flex-start", gap: "0.45rem" }}>
            <div>
            <h3 style={{ margin: 0 }}>Settings</h3>
            <p style={{ margin: 0, color: "#6b7280" }}>Manage schedule types, field trips, and staff.</p>
            </div>
            <HelpIconButton
              label="Settings overview"
              onClick={() => onOpenHelpTopic?.("settings-overview")}
              style={{ marginTop: "0.1rem" }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (isAnyDirty) {
                setTabWarning("Save or discard changes before closing settings.");
                return;
              }
              onClose();
            }}
            style={{
              borderRadius: 999,
              border: "1px solid #e2e8f0",
              background: colors.surface,
              padding: "0.35rem 0.9rem"
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e5e7eb",
            background: colors.surfaceAlt,
            overflowX: "auto",
            alignItems: "center"
          }}
        >
          {([
            { id: "school", label: "School" },
            { id: "scheduleTypes", label: "Schedule types" },
            { id: "operatingHours", label: "Operating hours" },
            { id: "fieldTrips", label: "Field trips" },
            { id: "jobTitles", label: "Job titles" },
            { id: "employees", label: "Employees" }
          ] as { id: SettingsTab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: "0.75rem 1.25rem",
                border: "none",
                background: activeTab === tab.id ? "#bfdbfe" : "transparent",
                color: activeTab === tab.id ? "#1d4ed8" : "#475569",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flex: "0 0 auto"
              }}
            >
              {tab.label}
            </button>
          ))}
          <div style={{ marginLeft: "auto", paddingRight: "0.75rem", display: "inline-flex", alignItems: "center" }}>
            <HelpIconButton
              label={`${activeTab} settings`}
              onClick={() => onOpenHelpTopic?.(helpTopicByTab[activeTab])}
            />
          </div>
        </div>

        <div
          style={{
            padding: "clamp(0.85rem, 2.5vw, 1.5rem)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            overflowY: "auto",
            flex: 1
          }}
        >
          {tabWarning && (
            <div style={{ border: "1px solid #fca5a5", background: "#fecaca", color: "#991b1b", padding: "0.5rem 0.75rem", borderRadius: 10 }}>
              {tabWarning}
            </div>
          )}
          {activeTab === "school" && (
            <SchoolSettingsSection
              draftSchoolName={draftSchoolName}
              draftSchoolRules={draftSchoolRules}
              draftClosedDays={draftClosedDays}
              allDays={allDays}
              onSchoolNameChange={(value) => {
                setDraftSchoolName(value);
                markDirty("school");
              }}
              onSchoolRulesChange={(next) => {
                setDraftSchoolRules(next);
                markDirty("school");
              }}
              onClosedDaysChange={(next) => {
                setDraftClosedDays(next);
                markDirty("school");
              }}
              onSave={() => {
                onUpdateSchoolName(draftSchoolName);
                onUpdateClosedDays(draftClosedDays);
                onUpdateSchoolRules(draftSchoolRules);
                resetDirty("school");
                setTabWarning(null);
              }}
              canSave={dirtyTabs.school}
            />
          )}
          {activeTab === "scheduleTypes" && (
            <ScheduleTypesSection
              draftScheduleTypes={draftScheduleTypes}
              onChange={(next) => {
                setDraftScheduleTypes(next);
                markDirty("scheduleTypes");
              }}
              onAdd={() => {
                setDraftScheduleTypes([...draftScheduleTypes, emptyScheduleType()]);
                markDirty("scheduleTypes");
              }}
              onRemove={(index) => {
                setDraftScheduleTypes(draftScheduleTypes.filter((_, idx) => idx !== index));
                markDirty("scheduleTypes");
              }}
              onSave={() => {
                onUpdateScheduleTypes(draftScheduleTypes);
                resetDirty("scheduleTypes");
                setTabWarning(null);
              }}
              canSave={dirtyTabs.scheduleTypes}
            />
          )}

          {activeTab === "operatingHours" && (
            <OperatingHoursSection
              draftOperatingHours={draftOperatingHours}
              draftScheduleTypes={operatingScheduleTypeOptions}
              draftClosedDays={draftClosedDays}
              allDays={allDays}
              operatingHoursOverlap={operatingHoursOverlap}
              onChange={(next) => {
                setDraftOperatingHours(next);
                markDirty("operatingHours");
              }}
              onAdd={() => {
                const defaultScheduleType = operatingScheduleTypeOptions[0]?.value;
                if (!defaultScheduleType) {
                  setTabWarning("Add a schedule type before setting operating hours.");
                  return;
                }
                setDraftOperatingHours([
                  ...draftOperatingHours,
                  emptyOperatingHours(defaultScheduleType as ScheduleType)
                ]);
                markDirty("operatingHours");
              }}
              onRemove={(index) => {
                setDraftOperatingHours(draftOperatingHours.filter((_, idx) => idx !== index));
                markDirty("operatingHours");
              }}
              onSave={() => {
                if (operatingHoursOverlap.length > 0) {
                  return;
                }
                onUpdateOperatingHoursConfig(draftOperatingHours);
                resetDirty("operatingHours");
                setTabWarning(null);
              }}
              canSave={canSaveOperatingHours}
            />
          )}

          {activeTab === "fieldTrips" && (
            <FieldTripsSection
              draftFieldTrips={draftFieldTrips}
              onChange={(next) => {
                setDraftFieldTrips(next);
                markDirty("fieldTrips");
              }}
              onAdd={() => {
                setDraftFieldTrips([...draftFieldTrips, emptyFieldTrip()]);
                markDirty("fieldTrips");
              }}
              onRemove={(index) => {
                setDraftFieldTrips(draftFieldTrips.filter((_, idx) => idx !== index));
                markDirty("fieldTrips");
              }}
              onSave={() => {
                onUpdateFieldTrips(draftFieldTrips);
                resetDirty("fieldTrips");
                setTabWarning(null);
              }}
              canSave={dirtyTabs.fieldTrips}
            />
          )}

          {activeTab === "jobTitles" && (
            <JobTitlesSection
              draftJobTitles={draftJobTitles}
              onChange={(next) => {
                setDraftJobTitles(next);
                markDirty("jobTitles");
              }}
              onAdd={() => {
                setDraftJobTitles([...draftJobTitles, emptyJobTitle()]);
                markDirty("jobTitles");
              }}
              onRemove={(index) => {
                setDraftJobTitles(draftJobTitles.filter((_, idx) => idx !== index));
                markDirty("jobTitles");
              }}
              onSave={() => {
                onUpdateJobTitles(draftJobTitles);
                resetDirty("jobTitles");
                setTabWarning(null);
              }}
              canSave={dirtyTabs.jobTitles}
            />
          )}

          {activeTab === "employees" && (
            <EmployeesSection
              draftEmployees={draftEmployees}
              jobTitleOptions={jobTitleOptions}
              onChange={(next) => {
                setDraftEmployees(next);
                markDirty("employees");
              }}
              onAdd={() => {
                const nextJobTitle = jobTitleOptions[0] ?? "";
                const base = emptyEmployee();
                setDraftEmployees([
                  ...draftEmployees,
                  {
                    ...base,
                    jobTitle: nextJobTitle
                  }
                ]);
                markDirty("employees");
              }}
              onRemove={(index) => {
                setDraftEmployees(draftEmployees.filter((_, idx) => idx !== index));
                markDirty("employees");
              }}
              onSave={() => {
                onUpdateEmployees(draftEmployees);
                resetDirty("employees");
                setTabWarning(null);
              }}
              canSave={dirtyTabs.employees}
            />
          )}
        </div>
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            background: colors.surfaceAlt,
            padding: "0.75rem 1.5rem",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "0.75rem"
          }}
        >
          <button
            type="button"
            onClick={saveActiveTab}
            disabled={!canSaveActiveTab}
            style={{
              borderRadius: 999,
              border: "1px solid #2563eb",
              background: canSaveActiveTab ? "#2563eb" : "#94a3b8",
              color: "#ffffff",
              padding: "0.45rem 1rem",
              cursor: canSaveActiveTab ? "pointer" : "not-allowed"
            }}
          >
            Save {activeTab === "scheduleTypes" ? "schedule types" : activeTab}
          </button>
        </div>
      </motion.div>
    </motion.section>
  );
}
