import type { Employee } from "@core/domain/types";
import type { DayOfWeek, EmployeeAvailabilityDay, EmployeeTimeOffRequest } from "@core/domain/types";
import { useMemo, useState } from "react";

interface EmployeesSectionProps {
  draftEmployees: Employee[];
  jobTitleOptions: string[];
  onChange: (next: Employee[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  canSave: boolean;
}

export default function EmployeesSection({
  draftEmployees,
  jobTitleOptions,
  onChange,
  onAdd,
  onRemove,
  onSave,
  canSave
}: EmployeesSectionProps) {
  const [expandedEmployeeIds, setExpandedEmployeeIds] = useState<string[]>([]);
  const daySequence: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const dayLabels: Record<DayOfWeek, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun"
  };

  const setEmployee = (index: number, nextEmployee: Employee) => {
    const next = [...draftEmployees];
    next[index] = nextEmployee;
    onChange(next);
  };

  const ensureAvailabilityDays = (employee: Employee): EmployeeAvailabilityDay[] => {
    const byDay = new Map<DayOfWeek, EmployeeAvailabilityDay>();
    (employee.availability ?? []).forEach((day) => {
      byDay.set(day.dayOfWeek, {
        dayOfWeek: day.dayOfWeek,
        blocks: (day.blocks ?? []).slice(0, 3)
      });
    });
    return daySequence.map((dayOfWeek) => byDay.get(dayOfWeek) ?? { dayOfWeek, blocks: [] });
  };

  const toggleExpanded = (employeeId: string) => {
    setExpandedEmployeeIds((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId]
    );
  };

  const expandedSet = useMemo(() => new Set(expandedEmployeeIds), [expandedEmployeeIds]);

  const updateAvailabilityBlocks = (
    employee: Employee,
    dayOfWeek: DayOfWeek,
    updater: (blocks: EmployeeAvailabilityDay["blocks"]) => EmployeeAvailabilityDay["blocks"]
  ): Employee => {
    const availability = ensureAvailabilityDays(employee).map((day) =>
      day.dayOfWeek === dayOfWeek
        ? {
            ...day,
            blocks: updater(day.blocks).slice(0, 3)
          }
        : day
    );
    return { ...employee, availability };
  };

  const updateRequestedDaysOff = (
    employee: Employee,
    updater: (daysOff: EmployeeTimeOffRequest[]) => EmployeeTimeOffRequest[]
  ): Employee => {
    return { ...employee, requestedDaysOff: updater(employee.requestedDaysOff ?? []) };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto",
          gap: "0.75rem",
          fontSize: "0.75rem",
          color: "#6b7280",
          paddingLeft: "0.25rem"
        }}
      >
        <span>Employee</span>
        <span>Job title</span>
        <span>Max hours/day</span>
        <span>Max hours/week</span>
        <span />
      </div>
      {draftEmployees.map((employee, index) => {
        const isExpanded = expandedSet.has(employee.id);
        const availabilityDays = ensureAvailabilityDays(employee);
        const daysOff = employee.requestedDaysOff ?? [];
        return (
          <div
            key={employee.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem"
            }}
          >
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto" }}>
              <input
                value={employee.name}
                onChange={(event) => {
                  setEmployee(index, { ...employee, name: event.target.value });
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
                  setEmployee(index, { ...employee, jobTitle: event.target.value });
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
                  setEmployee(index, { ...employee, maxHoursPerDay: Number(event.target.value) || 0 });
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
                  setEmployee(index, { ...employee, maxHoursPerWeek: Number(event.target.value) || 0 });
                }}
                style={{
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0.45rem 0.6rem"
                }}
                placeholder="Max hours/week"
              />
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button
                  type="button"
                  onClick={() => toggleExpanded(employee.id)}
                  style={{
                    borderRadius: 999,
                    border: "1px solid #cbd5e1",
                    background: "#e2e8f0",
                    color: "#0f172a",
                    padding: "0.3rem 0.75rem"
                  }}
                >
                  {isExpanded ? "Hide" : "Availability"}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
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
            </div>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {([
                { key: "cprCurrent", label: "CPR current" },
                { key: "medicallyDelegated", label: "Med delegated" }
              ] as const).map((flag) => (
                <label key={flag.key} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <input
                    type="checkbox"
                    checked={employee[flag.key]}
                    onChange={(event) => {
                      setEmployee(index, { ...employee, [flag.key]: event.target.checked });
                    }}
                  />
                  <span style={{ fontSize: "0.85rem", color: "#334155" }}>{flag.label}</span>
                </label>
              ))}
            </div>

            {isExpanded && (
              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  background: "#e2e8f0"
                }}
              >
                <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Availability (up to 3 blocks/day)</h4>
                {availabilityDays.map((day) => (
                  <div
                    key={`${employee.id}-${day.dayOfWeek}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 1fr auto",
                      gap: "0.5rem",
                      alignItems: "start"
                    }}
                  >
                    <strong style={{ fontSize: "0.8rem", paddingTop: "0.4rem" }}>{dayLabels[day.dayOfWeek]}</strong>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      {day.blocks.map((block, blockIndex) => (
                        <div
                          key={`${employee.id}-${day.dayOfWeek}-${blockIndex}`}
                          style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}
                        >
                          <input
                            type="time"
                            value={block.startTime}
                            onChange={(event) => {
                              setEmployee(
                                index,
                                updateAvailabilityBlocks(employee, day.dayOfWeek, (blocks) =>
                                  blocks.map((item, idx) =>
                                    idx === blockIndex ? { ...item, startTime: event.target.value } : item
                                  )
                                )
                              );
                            }}
                            style={{ borderRadius: 8, border: "1px solid #cbd5e1", padding: "0.3rem 0.45rem" }}
                          />
                          <span style={{ color: "#64748b", fontSize: "0.8rem" }}>to</span>
                          <input
                            type="time"
                            value={block.endTime}
                            onChange={(event) => {
                              setEmployee(
                                index,
                                updateAvailabilityBlocks(employee, day.dayOfWeek, (blocks) =>
                                  blocks.map((item, idx) =>
                                    idx === blockIndex ? { ...item, endTime: event.target.value } : item
                                  )
                                )
                              );
                            }}
                            style={{ borderRadius: 8, border: "1px solid #cbd5e1", padding: "0.3rem 0.45rem" }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEmployee(
                                index,
                                updateAvailabilityBlocks(employee, day.dayOfWeek, (blocks) =>
                                  blocks.filter((_, idx) => idx !== blockIndex)
                                )
                              );
                            }}
                            style={{
                              borderRadius: 999,
                              border: "1px solid #fecaca",
                              background: "#fff1f2",
                              color: "#be123c",
                              padding: "0.2rem 0.6rem",
                              fontSize: "0.75rem"
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={day.blocks.length >= 3}
                      onClick={() => {
                        setEmployee(
                          index,
                          updateAvailabilityBlocks(employee, day.dayOfWeek, (blocks) => [
                            ...blocks,
                            { startTime: "09:00", endTime: "17:00" }
                          ])
                        );
                      }}
                      style={{
                        borderRadius: 999,
                        border: "1px solid #bfdbfe",
                        background: day.blocks.length >= 3 ? "#e2e8f0" : "#eff6ff",
                        color: day.blocks.length >= 3 ? "#94a3b8" : "#1d4ed8",
                        padding: "0.2rem 0.65rem",
                        fontSize: "0.75rem"
                      }}
                    >
                      Add block
                    </button>
                  </div>
                ))}

                <h4 style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>Requested time off</h4>
                {daysOff.length === 0 && (
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem" }}>No requested days off.</p>
                )}
                {daysOff.map((request, requestIndex) => (
                  <div
                    key={request.id}
                    style={{ display: "grid", gridTemplateColumns: "150px 150px 1fr auto", gap: "0.45rem" }}
                  >
                    <input
                      type="date"
                      value={request.startDate}
                      onChange={(event) => {
                        setEmployee(
                          index,
                          updateRequestedDaysOff(employee, (items) =>
                            items.map((item, idx) =>
                              idx === requestIndex ? { ...item, startDate: event.target.value } : item
                            )
                          )
                        );
                      }}
                      style={{ borderRadius: 8, border: "1px solid #cbd5e1", padding: "0.35rem 0.45rem" }}
                    />
                    <input
                      type="date"
                      value={request.endDate}
                      onChange={(event) => {
                        setEmployee(
                          index,
                          updateRequestedDaysOff(employee, (items) =>
                            items.map((item, idx) =>
                              idx === requestIndex ? { ...item, endDate: event.target.value } : item
                            )
                          )
                        );
                      }}
                      style={{ borderRadius: 8, border: "1px solid #cbd5e1", padding: "0.35rem 0.45rem" }}
                    />
                    <input
                      value={request.note ?? ""}
                      onChange={(event) => {
                        setEmployee(
                          index,
                          updateRequestedDaysOff(employee, (items) =>
                            items.map((item, idx) =>
                              idx === requestIndex ? { ...item, note: event.target.value } : item
                            )
                          )
                        );
                      }}
                      placeholder="Reason (optional)"
                      style={{ borderRadius: 8, border: "1px solid #cbd5e1", padding: "0.35rem 0.45rem" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEmployee(
                          index,
                          updateRequestedDaysOff(employee, (items) =>
                            items.filter((_, idx) => idx !== requestIndex)
                          )
                        );
                      }}
                      style={{
                        borderRadius: 999,
                        border: "1px solid #fecaca",
                        background: "#fff1f2",
                        color: "#be123c",
                        padding: "0.2rem 0.65rem",
                        fontSize: "0.75rem"
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split("T")[0];
                    setEmployee(
                      index,
                      updateRequestedDaysOff(employee, (items) => [
                        ...items,
                        {
                          id: `timeoff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          startDate: today,
                          endDate: today,
                          note: ""
                        }
                      ])
                    );
                  }}
                  style={{
                    alignSelf: "flex-start",
                    borderRadius: 999,
                    border: "1px solid #bfdbfe",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    padding: "0.3rem 0.8rem",
                    fontSize: "0.8rem"
                  }}
                >
                  Add time off
                </button>
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
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
        disabled={!canSave}
        onClick={onSave}
        style={{
          alignSelf: "flex-start",
          borderRadius: 999,
          border: "none",
          background: canSave ? "#2563eb" : "#cbd5f5",
          color: "#fff",
          padding: "0.45rem 0.9rem",
          cursor: canSave ? "pointer" : "not-allowed"
        }}
      >
        Save employees
      </button>
    </div>
  );
}
