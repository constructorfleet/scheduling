import type { Employee } from "@core/domain/types";
import type { DayOfWeek, EmployeeAvailabilityDay, EmployeeTimeOffRequest } from "@core/domain/types";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { colors } from "../../theme";

interface EmployeesSectionProps {
  draftEmployees: Employee[];
  jobTitleOptions: string[];
  roleOptions: string[];
  onChange: (next: Employee[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  canSave: boolean;
}

export default function EmployeesSection({
  draftEmployees,
  jobTitleOptions,
  roleOptions,
  onChange,
  onAdd,
  onRemove,
  onSave,
  canSave
}: EmployeesSectionProps) {
  const [expandedEmployeeIds, setExpandedEmployeeIds] = useState<string[]>([]);
  const daySequence: DayOfWeek[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
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

  const normalizeRoles = (roles: string[] | undefined) => {
    const unique = new Set<string>();
    (roles ?? []).forEach((role) => {
      const trimmed = role.trim();
      if (trimmed) {
        unique.add(trimmed);
      }
    });
    return Array.from(unique);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1.35fr 1fr .9fr 1fr .15fr .15fr 165px",
          gap: "0.75rem",
          fontSize: "0.75rem",
          color: "#6b7280",
          paddingLeft: "0.75rem",
          paddingRight: "0.75rem",
          alignItems: "center",
          justifyItems: "center",
          boxSizing: "border-box"
        }}
      >
        <span style={{ textAlign: "center", width: "100%" }}>Employee</span>
        <span style={{ textAlign: "center", width: "100%" }}>Email</span>
        <span style={{ textAlign: "center", width: "100%" }}>Phone</span>
        <span style={{ textAlign: "center", width: "100%" }}>Job title</span>
        <span style={{ textAlign: "center", width: "100%" }}>Roles</span>
        <span style={{ textAlign: "center", width: "100%" }}>Max hours/day</span>
        <span style={{ textAlign: "center", width: "100%" }}>Max hours/week</span>
        <span />
      </div>
      <AnimatePresence initial={false}>
      {draftEmployees.map((employee, index) => {
        const isExpanded = expandedSet.has(employee.id);
        const availabilityDays = ensureAvailabilityDays(employee);
        const daysOff = employee.requestedDaysOff ?? [];
        return (
          <motion.div
            key={employee.id}
            initial={{ opacity: 0, maxHeight: 0 }}
            animate={{ opacity: 1, maxHeight: "5000px" }}
            exit={{ opacity: 0, maxHeight: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "1.1fr 1.35fr 1fr .9fr 1fr .15fr .15fr 170px",
                paddingLeft: "0.75rem",
                paddingRight: "0.75rem",
                boxSizing: "border-box",
                width: "100%"
              }}
            >
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
              <input
                type="email"
                value={employee.email ?? ""}
                onChange={(event) => {
                  setEmployee(index, { ...employee, email: event.target.value });
                }}
                style={{
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0.45rem 0.6rem"
                }}
                placeholder="Email"
              />
              <input
                type="tel"
                value={employee.phone ?? ""}
                onChange={(event) => {
                  setEmployee(index, { ...employee, phone: event.target.value });
                }}
                style={{
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0.45rem 0.6rem"
                }}
                placeholder="Phone"
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
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                  {normalizeRoles(employee.roles).map((role) => (
                    <button
                      key={`${employee.id}-${role}`}
                      type="button"
                      onClick={() => {
                        setEmployee(index, {
                          ...employee,
                          roles: normalizeRoles(employee.roles).filter((existingRole) => existingRole !== role)
                        });
                      }}
                      style={{
                        borderRadius: 999,
                        border: "1px solid #bfdbfe",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        padding: "0.12rem 0.5rem",
                        fontSize: "0.7rem"
                      }}
                      title="Remove role"
                    >
                      {role} x
                    </button>
                  ))}
                </div>
                <select
                  value=""
                  onChange={(event) => {
                    const selectedRole = event.target.value;
                    if (!selectedRole) {
                      return;
                    }
                    const currentRoles = normalizeRoles(employee.roles);
                    if (currentRoles.includes(selectedRole)) {
                      return;
                    }
                    setEmployee(index, { ...employee, roles: [...currentRoles, selectedRole] });
                  }}
                  style={{
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    padding: "0.3rem 0.45rem"
                  }}
                >
                  <option value="">Add role</option>
                  {roleOptions.map((roleOption) => (
                    <option key={`${employee.id}-${roleOption}`} value={roleOption}>
                      {roleOption}
                    </option>
                  ))}
                </select>
              </div>
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
                  padding: "0.45rem 0.6rem",
                  width: "2rem",
                  justifySelf: "center",
                  textAlign: "center"
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
                  padding: "0.45rem 0.6rem",
                  width: "2rem",
                  justifySelf: "center",
                  textAlign: "center"
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
                    background: colors.surfaceAlt,
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

            <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, maxHeight: 0 }}
                animate={{ opacity: 1, maxHeight: "4000px" }}
                exit={{ opacity: 0, maxHeight: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  background: colors.surfaceAlt,
                  overflow: "hidden"
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
                      <AnimatePresence initial={false}>
                      {day.blocks.map((block, blockIndex) => (
                        <motion.div
                          key={`${employee.id}-${day.dayOfWeek}-${blockIndex}`}
                          initial={{ opacity: 0, maxHeight: 0 }}
                          animate={{ opacity: 1, maxHeight: "100px" }}
                          exit={{ opacity: 0, maxHeight: 0 }}
                          transition={{ duration: 0.15, ease: "easeInOut" }}
                          style={{ display: "flex", gap: "0.35rem", alignItems: "center", overflow: "hidden" }}
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
                        </motion.div>
                      ))}
                      </AnimatePresence>
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
                <AnimatePresence initial={false}>
                {daysOff.map((request, requestIndex) => (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, maxHeight: 0 }}
                    animate={{ opacity: 1, maxHeight: "100px" }}
                    exit={{ opacity: 0, maxHeight: 0 }}
                    transition={{ duration: 0.15, ease: "easeInOut" }}
                    style={{ display: "grid", gridTemplateColumns: "150px 150px 1fr auto", gap: "0.45rem", overflow: "hidden" }}
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
                  </motion.div>
                ))}
                </AnimatePresence>
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
              </motion.div>
            )}
            </AnimatePresence>
          </motion.div>
        );
      })}
      </AnimatePresence>
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
