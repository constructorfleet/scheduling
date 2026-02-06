import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DayOfWeek, FieldTripType, Employee, ScheduleType } from "../../../src/domain/types";
import type { ScheduleTypeOption } from "./DayMetadataStrip";

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
  minAdultStudentRatio: 10,
  minLeaderStudentRatio: 12,
  policyCitationId: "policy-field-trip",
  notes: ""
});

const emptyEmployee = (): Employee => ({
  id: `emp-${Date.now()}`,
  name: "New employee",
  jobTitle: "Staff",
  maxHoursPerDay: 8,
  maxHoursPerWeek: 40,
  employmentStatus: "active",
  leaderQualified: false,
  medicallyDelegated: false,
  cprCurrent: false,
  notes: ""
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
  closeAttempt
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("school");
  const jobTitleOptions = useMemo(() => jobTitles.map((title) => title.title), [jobTitles]);
  const ratioToPair = (ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return { adults: 1, students: 1 };
    }
    if (ratio >= 1) {
      return { adults: Math.max(1, Math.round(ratio)), students: 1 };
    }
    return { adults: 1, students: Math.max(1, Math.round(1 / ratio)) };
  };
  const allDays: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  const [draftSchoolName, setDraftSchoolName] = useState(schoolName);
  const [draftClosedDays, setDraftClosedDays] = useState<DayOfWeek[]>(closedDays);
  const [draftSchoolRules, setDraftSchoolRules] = useState<SchoolRules>(schoolRules);
  const [draftScheduleTypes, setDraftScheduleTypes] = useState<ScheduleTypeOption[]>(scheduleTypes);
  const [draftOperatingHours, setDraftOperatingHours] = useState<OperatingHoursConfig[]>(operatingHoursConfig);
  const [draftFieldTrips, setDraftFieldTrips] = useState<FieldTripType[]>(fieldTripTypes);
  const [draftJobTitles, setDraftJobTitles] = useState<JobTitleSetting[]>(jobTitles);
  const [draftEmployees, setDraftEmployees] = useState<Employee[]>(employees);

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
        padding: "3rem 2rem",
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
          background: "#ffffff",
          borderRadius: 18,
          boxShadow: "0 30px 60px rgba(15, 23, 42, 0.2)",
          border: "1px solid #e2e8f0",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc"
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Settings</h3>
            <p style={{ margin: 0, color: "#6b7280" }}>Manage schedule types, field trips, and staff.</p>
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
              background: "#fff",
              padding: "0.35rem 0.9rem"
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
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
                background: activeTab === tab.id ? "#eef2ff" : "transparent",
                color: activeTab === tab.id ? "#1d4ed8" : "#475569",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {tabWarning && (
            <div style={{ border: "1px solid #fecaca", background: "#fee2e2", color: "#b91c1c", padding: "0.5rem 0.75rem", borderRadius: 10 }}>
              {tabWarning}
            </div>
          )}
          {activeTab === "school" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>School name</label>
                <input
                  value={draftSchoolName}
                  onChange={(event) => {
                    setDraftSchoolName(event.target.value);
                    markDirty("school");
                  }}
                  style={{
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    padding: "0.45rem 0.6rem",
                    maxWidth: 360
                  }}
                  placeholder="School name"
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.75rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
                  Number of openers
                  <input
                    type="number"
                    min={0}
                    value={draftSchoolRules.openerCount}
                    onChange={(event) => {
                      setDraftSchoolRules({
                        ...draftSchoolRules,
                        openerCount: Number(event.target.value) || 0
                      });
                      markDirty("school");
                    }}
                    style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.45rem 0.6rem" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
                  Number of closers
                  <input
                    type="number"
                    min={0}
                    value={draftSchoolRules.closerCount}
                    onChange={(event) => {
                      setDraftSchoolRules({
                        ...draftSchoolRules,
                        closerCount: Number(event.target.value) || 0
                      });
                      markDirty("school");
                    }}
                    style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.45rem 0.6rem" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
                  Required Med. Del. at all times
                  <input
                    type="number"
                    min={0}
                    value={draftSchoolRules.minimumMedicalDelegated}
                    onChange={(event) => {
                      setDraftSchoolRules({
                        ...draftSchoolRules,
                        minimumMedicalDelegated: Number(event.target.value) || 0
                      });
                      markDirty("school");
                    }}
                    style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.45rem 0.6rem" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
                  Require current CPR
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <input
                      type="checkbox"
                      checked={draftSchoolRules.requireCurrentCpr}
                      onChange={(event) => {
                        setDraftSchoolRules({
                          ...draftSchoolRules,
                          requireCurrentCpr: event.target.checked
                        });
                        markDirty("school");
                      }}
                    />
                    <span style={{ fontSize: "0.8rem", color: "#334155" }}>
                      CPR must be current to schedule
                    </span>
                  </label>
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>Closed days</span>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {allDays.map((day) => (
                    <label key={`closed-${day}`} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <input
                        type="checkbox"
                        checked={draftClosedDays.includes(day)}
                        onChange={(event) => {
                          const next = new Set(draftClosedDays);
                          if (event.target.checked) {
                            next.add(day);
                          } else {
                            next.delete(day);
                          }
                          setDraftClosedDays(Array.from(next));
                          markDirty("school");
                        }}
                      />
                      <span style={{ fontSize: "0.8rem", color: "#334155" }}>{day.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={!dirtyTabs.school}
                onClick={() => {
                  onUpdateSchoolName(draftSchoolName);
                  onUpdateClosedDays(draftClosedDays);
                  onUpdateSchoolRules(draftSchoolRules);
                  resetDirty("school");
                  setTabWarning(null);
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "none",
                  background: dirtyTabs.school ? "#2563eb" : "#cbd5f5",
                  color: "#fff",
                  padding: "0.45rem 0.9rem",
                  cursor: dirtyTabs.school ? "pointer" : "not-allowed"
                }}
              >
                Save school settings
              </button>
            </div>
          )}
          {activeTab === "scheduleTypes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 200px 1fr auto",
                  gap: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  paddingLeft: "0.75rem",
                  paddingRight: "0.75rem",
                  alignItems: "center"
                }}
              >
                <span>Schedule type</span>
                <span style={{ textAlign: "center" }}>Adult:Student Ratio</span>
                <span>Description</span>
                <span />
              </div>
              {draftScheduleTypes.map((type, index) => (
                <div
                  key={`${type.value}-${index}`}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: "0.75rem",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "160px 200px 1fr auto",
                    alignItems: "center"
                  }}
                >
                  <input
                    value={type.label}
                    onChange={(event) => {
                      const next = [...draftScheduleTypes];
                      next[index] = { ...type, label: event.target.value };
                      setDraftScheduleTypes(next);
                      markDirty("scheduleTypes");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                    placeholder="Label"
                  />
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <input
                      type="number"
                      min={1}
                      value={type.ratio.adults}
                      onChange={(event) => {
                        const next = [...draftScheduleTypes];
                        next[index] = {
                          ...type,
                          ratio: { ...type.ratio, adults: Math.max(1, Number(event.target.value)) }
                        };
                        setDraftScheduleTypes(next);
                        markDirty("scheduleTypes");
                      }}
                      style={{
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        padding: "0.45rem 0.6rem",
                        width: 52,
                        textAlign: "center"
                      }}
                      placeholder="A"
                    />
                    <span style={{ color: "#6b7280", fontWeight: 600 }}>:</span>
                    <input
                      type="number"
                      min={1}
                      value={type.ratio.students}
                      onChange={(event) => {
                        const next = [...draftScheduleTypes];
                        next[index] = {
                          ...type,
                          ratio: { ...type.ratio, students: Math.max(1, Number(event.target.value)) }
                        };
                        setDraftScheduleTypes(next);
                        markDirty("scheduleTypes");
                      }}
                      style={{
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        padding: "0.45rem 0.6rem",
                        width: 52,
                        textAlign: "center"
                      }}
                      placeholder="S"
                    />
                  </div>
                  <input
                    value={type.description}
                    onChange={(event) => {
                      const next = [...draftScheduleTypes];
                      next[index] = { ...type, description: event.target.value };
                      setDraftScheduleTypes(next);
                      markDirty("scheduleTypes");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                    placeholder="Description"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDraftScheduleTypes(draftScheduleTypes.filter((_, idx) => idx !== index));
                      markDirty("scheduleTypes");
                    }}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #fecaca",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "0.3rem 0.75rem"
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setDraftScheduleTypes([...draftScheduleTypes, emptyScheduleType()]);
                  markDirty("scheduleTypes");
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "1px solid #cbd5f5",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "0.4rem 0.9rem"
                }}
              >
                Add schedule type
              </button>
              <button
                type="button"
                disabled={!dirtyTabs.scheduleTypes}
                onClick={() => {
                  onUpdateScheduleTypes(draftScheduleTypes);
                  resetDirty("scheduleTypes");
                  setTabWarning(null);
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "none",
                  background: dirtyTabs.scheduleTypes ? "#2563eb" : "#cbd5f5",
                  color: "#fff",
                  padding: "0.45rem 0.9rem",
                  cursor: dirtyTabs.scheduleTypes ? "pointer" : "not-allowed"
                }}
              >
                Save schedule types
              </button>
            </div>
          )}

          {activeTab === "operatingHours" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "160px 1.5fr 1fr 1fr auto", gap: "0.75rem", fontSize: "0.75rem", color: "#6b7280", paddingLeft: "0.75rem", paddingRight:"0.75rem" }}>
                <span>Schedule type</span>
                <span>Days of week</span>
                <span>Open</span>
                <span>Close</span>
                <span />
              </div>
              {draftOperatingHours.map((entry, index) => (
                (() => {
                  const usedDays = new Set<DayOfWeek>();
                  draftOperatingHours.forEach((other, otherIndex) => {
                    if (otherIndex === index) return;
                    if (other.scheduleType !== entry.scheduleType) return;
                    other.daysOfWeek.forEach((day) => usedDays.add(day));
                  });
                  return (
                    <div
                      key={entry.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        padding: "0.75rem",
                        display: "grid",
                        gap: "0.75rem",
                        gridTemplateColumns: "160px 1.5fr 1fr 1fr auto"
                      }}
                    >
                  <select
                    value={entry.scheduleType}
                    onChange={(event) => {
                      const next = [...draftOperatingHours];
                      next[index] = { ...entry, scheduleType: event.target.value as ScheduleType };
                      setDraftOperatingHours(next);
                      markDirty("operatingHours");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                  >
                    {draftScheduleTypes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {allDays.map((day) => {
                      const isClosed = draftClosedDays.includes(day);
                      const isUsedElsewhere = usedDays.has(day);
                      const isDisabled = isClosed || isUsedElsewhere;
                      return (
                      <label
                        key={`${entry.id}-${day}`}
                        style={{
                          display: "flex",
                          gap: "0.25rem",
                          fontSize: "0.8rem",
                          color: isDisabled ? "#9ca3af" : "#334155"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={entry.daysOfWeek.includes(day)}
                          disabled={isDisabled && !entry.daysOfWeek.includes(day)}
                          onChange={(event) => {
                            const next = [...draftOperatingHours];
                            const days = new Set(entry.daysOfWeek);
                            if (event.target.checked) {
                              days.add(day);
                            } else {
                              days.delete(day);
                            }
                            next[index] = { ...entry, daysOfWeek: Array.from(days) };
                            setDraftOperatingHours(next);
                            markDirty("operatingHours");
                          }}
                        />
                        {day.toUpperCase()}
                      </label>
                    )})}
                  </div>
                  <input
                    type="time"
                    value={entry.open}
                    onChange={(event) => {
                      const next = [...draftOperatingHours];
                      next[index] = { ...entry, open: event.target.value };
                      setDraftOperatingHours(next);
                      markDirty("operatingHours");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                  />
                  <input
                    type="time"
                    value={entry.close}
                    onChange={(event) => {
                      const next = [...draftOperatingHours];
                      next[index] = { ...entry, close: event.target.value };
                      setDraftOperatingHours(next);
                      markDirty("operatingHours");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDraftOperatingHours(draftOperatingHours.filter((_, idx) => idx !== index));
                      markDirty("operatingHours");
                    }}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #fecaca",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "0.3rem 0.75rem"
                    }}
                  >
                    Remove
                  </button>
                </div>
                  );
                })()
              ))}
              {operatingHoursOverlap.length > 0 && (
                <div style={{ border: "1px solid #fecaca", background: "#fee2e2", color: "#b91c1c", padding: "0.5rem 0.75rem", borderRadius: 10 }}>
                  {operatingHoursOverlap.map((message) => (
                    <div key={message}>{message}</div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  (() => {
                    setDraftOperatingHours([
                      ...draftOperatingHours,
                      emptyOperatingHours(draftScheduleTypes[0]?.value ?? "regular")
                    ]);
                    markDirty("operatingHours");
                  })()
                }
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "1px solid #cbd5f5",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "0.4rem 0.9rem"
                }}
              >
                Add operating hours set
              </button>
              <button
                type="button"
                disabled={!canSaveOperatingHours}
                onClick={() => {
                  if (operatingHoursOverlap.length > 0) {
                    return;
                  }
                  onUpdateOperatingHoursConfig(draftOperatingHours);
                  resetDirty("operatingHours");
                  setTabWarning(null);
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "none",
                  background: canSaveOperatingHours ? "#2563eb" : "#cbd5f5",
                  color: "#fff",
                  padding: "0.45rem 0.9rem",
                  cursor: canSaveOperatingHours ? "pointer" : "not-allowed"
                }}
              >
                Save operating hours
              </button>
            </div>
          )}

          {activeTab === "fieldTrips" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 200px 200px 88px",
                  gap: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  paddingLeft: "0.75rem",
                  paddingRight: "0.75rem",
                  alignItems: "center"
                }}
              >
                <span>Field trip</span>
                <span style={{ textAlign: "center", justifySelf: "center" }}>Adult ratio</span>
                <span style={{ textAlign: "center", justifySelf: "center" }}>Leader ratio</span>
                <span />
              </div>
              {draftFieldTrips.map((trip, index) => (
                (() => {
                  const adultPair = ratioToPair(trip.minAdultStudentRatio);
                  const leaderPair = ratioToPair(trip.minLeaderStudentRatio);
                  return (
                <div
                  key={trip.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: "0.75rem",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "1.2fr 200px 200px 88px",
                    alignItems: "center"
                  }}
                >
                  <input
                    value={trip.name}
                    onChange={(event) => {
                      const next = [...draftFieldTrips];
                      next[index] = { ...trip, name: event.target.value };
                      setDraftFieldTrips(next);
                      markDirty("fieldTrips");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                    placeholder="Trip name"
                  />
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <input
                      type="number"
                      min={1}
                      value={adultPair.adults}
                      onChange={(event) => {
                        const nextAdults = Math.max(1, Number(event.target.value) || 1);
                        const next = [...draftFieldTrips];
                        next[index] = {
                          ...trip,
                          minAdultStudentRatio: nextAdults / Math.max(1, adultPair.students)
                        };
                        setDraftFieldTrips(next);
                        markDirty("fieldTrips");
                      }}
                      style={{
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        padding: "0.45rem 0.6rem",
                        width: 52,
                        textAlign: "center"
                      }}
                      placeholder="A"
                    />
                    <span style={{ color: "#6b7280", fontWeight: 600 }}>:</span>
                    <input
                      type="number"
                      min={1}
                      value={adultPair.students}
                      onChange={(event) => {
                        const nextStudents = Math.max(1, Number(event.target.value) || 1);
                        const next = [...draftFieldTrips];
                        next[index] = {
                          ...trip,
                          minAdultStudentRatio: Math.max(1, adultPair.adults) / nextStudents
                        };
                        setDraftFieldTrips(next);
                        markDirty("fieldTrips");
                      }}
                      style={{
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        padding: "0.45rem 0.6rem",
                        width: 52,
                        textAlign: "center"
                      }}
                      placeholder="S"
                    />
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <input
                      type="number"
                      min={1}
                      value={leaderPair.adults}
                      onChange={(event) => {
                        const nextAdults = Math.max(1, Number(event.target.value) || 1);
                        const next = [...draftFieldTrips];
                        next[index] = {
                          ...trip,
                          minLeaderStudentRatio: nextAdults / Math.max(1, leaderPair.students)
                        };
                        setDraftFieldTrips(next);
                        markDirty("fieldTrips");
                      }}
                      style={{
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        padding: "0.45rem 0.6rem",
                        width: 52,
                        textAlign: "center"
                      }}
                      placeholder="L"
                    />
                    <span style={{ color: "#6b7280", fontWeight: 600 }}>:</span>
                    <input
                      type="number"
                      min={1}
                      value={leaderPair.students}
                      onChange={(event) => {
                        const nextStudents = Math.max(1, Number(event.target.value) || 1);
                        const next = [...draftFieldTrips];
                        next[index] = {
                          ...trip,
                          minLeaderStudentRatio: Math.max(1, leaderPair.adults) / nextStudents
                        };
                        setDraftFieldTrips(next);
                        markDirty("fieldTrips");
                      }}
                      style={{
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        padding: "0.45rem 0.6rem",
                        width: 52,
                        textAlign: "center"
                      }}
                      placeholder="S"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftFieldTrips(draftFieldTrips.filter((_, idx) => idx !== index));
                      markDirty("fieldTrips");
                    }}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #fecaca",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "0.3rem 0.75rem"
                    }}
                  >
                    Remove
                  </button>
                </div>
                  );
                })()
              ))}
              <button
                type="button"
                onClick={() => {
                  setDraftFieldTrips([...draftFieldTrips, emptyFieldTrip()]);
                  markDirty("fieldTrips");
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "1px solid #cbd5f5",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "0.4rem 0.9rem"
                }}
              >
                Add field trip
              </button>
              <button
                type="button"
                disabled={!dirtyTabs.fieldTrips}
                onClick={() => {
                  onUpdateFieldTrips(draftFieldTrips);
                  resetDirty("fieldTrips");
                  setTabWarning(null);
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "none",
                  background: dirtyTabs.fieldTrips ? "#2563eb" : "#cbd5f5",
                  color: "#fff",
                  padding: "0.45rem 0.9rem",
                  cursor: dirtyTabs.fieldTrips ? "pointer" : "not-allowed"
                }}
              >
                Save field trips
              </button>
            </div>
          )}

          {activeTab === "jobTitles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 180px 220px 88px",
                  gap: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  paddingLeft: "0.75rem",
                  paddingRight: "0.75rem",
                  alignItems: "center"
                }}
              >
                <span>Job title</span>
                <span style={{ textAlign: "center", justifySelf: "center" }}>Leader qualified</span>
                <span style={{ textAlign: "center", justifySelf: "center" }}>Requires leader to open/close</span>
                <span />
              </div>
              {draftJobTitles.map((title, index) => (
                <div
                  key={title.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: "0.75rem",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "1fr 180px 220px 88px"
                  }}
                >
                  <input
                    value={title.title}
                    onChange={(event) => {
                      const next = [...draftJobTitles];
                      next[index] = { ...title, title: event.target.value };
                      setDraftJobTitles(next);
                      markDirty("jobTitles");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                    placeholder="Job title"
                  />
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.4rem",
                      fontSize: "0.85rem"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={title.leaderQualified}
                      onChange={(event) => {
                        const next = [...draftJobTitles];
                        next[index] = { ...title, leaderQualified: event.target.checked };
                        setDraftJobTitles(next);
                        markDirty("jobTitles");
                      }}
                    />
                    Leader qualified
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.4rem",
                      fontSize: "0.85rem"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={title.requiresLeaderForOpenClose}
                      onChange={(event) => {
                        const next = [...draftJobTitles];
                        next[index] = { ...title, requiresLeaderForOpenClose: event.target.checked };
                        setDraftJobTitles(next);
                        markDirty("jobTitles");
                      }}
                    />
                    Requires leader present for open/close
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftJobTitles(draftJobTitles.filter((_, idx) => idx !== index));
                      markDirty("jobTitles");
                    }}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #fecaca",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "0.3rem 0.75rem"
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setDraftJobTitles([...draftJobTitles, emptyJobTitle()]);
                  markDirty("jobTitles");
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "1px solid #cbd5f5",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "0.4rem 0.9rem"
                }}
              >
                Add job title
              </button>
              <button
                type="button"
                disabled={!dirtyTabs.jobTitles}
                onClick={() => {
                  onUpdateJobTitles(draftJobTitles);
                  resetDirty("jobTitles");
                  setTabWarning(null);
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "none",
                  background: dirtyTabs.jobTitles ? "#2563eb" : "#cbd5f5",
                  color: "#fff",
                  padding: "0.45rem 0.9rem",
                  cursor: dirtyTabs.jobTitles ? "pointer" : "not-allowed"
                }}
              >
                Save job titles
              </button>
            </div>
          )}

          {activeTab === "employees" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto", gap: "0.75rem", fontSize: "0.75rem", color: "#6b7280", paddingLeft: "0.25rem" }}>
                <span>Employee</span>
                <span>Job title</span>
                <span>Max hours/day</span>
                <span>Max hours/week</span>
                <span />
              </div>
              {draftEmployees.map((employee, index) => (
                <div
                  key={employee.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: "0.75rem",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto"
                  }}
                >
                  <input
                    value={employee.name}
                    onChange={(event) => {
                      const next = [...draftEmployees];
                      next[index] = { ...employee, name: event.target.value };
                      setDraftEmployees(next);
                      markDirty("employees");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                    placeholder="Name"
                  />
                  <select
                    value={employee.jobTitle}
                    onChange={(event) => {
                      const next = [...draftEmployees];
                      next[index] = { ...employee, jobTitle: event.target.value };
                      setDraftEmployees(next);
                      markDirty("employees");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                  >
                    {jobTitleOptions.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={employee.maxHoursPerDay}
                    onChange={(event) => {
                      const next = [...draftEmployees];
                      next[index] = { ...employee, maxHoursPerDay: Number(event.target.value) || 0 };
                      setDraftEmployees(next);
                      markDirty("employees");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                    placeholder="Max hours/day"
                  />
                  <input
                    type="number"
                    min={1}
                    value={employee.maxHoursPerWeek}
                    onChange={(event) => {
                      const next = [...draftEmployees];
                      next[index] = { ...employee, maxHoursPerWeek: Number(event.target.value) || 0 };
                      setDraftEmployees(next);
                      markDirty("employees");
                    }}
                    style={{
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      padding: "0.45rem 0.6rem"
                    }}
                    placeholder="Max hours/week"
                  />
                  <button
                    type="button"
                    onClick={() => onUpdateEmployees(employees.filter((_, idx) => idx !== index))}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #fecaca",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "0.3rem 0.75rem"
                    }}
                  >
                    Remove
                  </button>
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    {([
                      { key: "cprCurrent", label: "CPR current" },
                      { key: "medicallyDelegated", label: "Med delegated" }
                    ] as const).map((flag) => (
                      <label key={flag.key} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <input
                          type="checkbox"
                          checked={employee[flag.key]}
                          onChange={(event) => {
                            const next = [...draftEmployees];
                            next[index] = { ...employee, [flag.key]: event.target.checked };
                            setDraftEmployees(next);
                            markDirty("employees");
                          }}
                        />
                        <span style={{ fontSize: "0.85rem", color: "#334155" }}>{flag.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setDraftEmployees([...draftEmployees, emptyEmployee()]);
                  markDirty("employees");
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "1px solid #cbd5f5",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "0.4rem 0.9rem"
                }}
              >
                Add employee
              </button>
              <button
                type="button"
                disabled={!dirtyTabs.employees}
                onClick={() => {
                  onUpdateEmployees(draftEmployees);
                  resetDirty("employees");
                  setTabWarning(null);
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  border: "none",
                  background: dirtyTabs.employees ? "#2563eb" : "#cbd5f5",
                  color: "#fff",
                  padding: "0.45rem 0.9rem",
                  cursor: dirtyTabs.employees ? "pointer" : "not-allowed"
                }}
              >
                Save employees
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.section>
  );
}
