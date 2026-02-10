import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ScheduleTypeOption } from "../DayMetadataStrip";

interface ScheduleTypesSectionProps {
  draftScheduleTypes: ScheduleTypeOption[];
  onChange: (next: ScheduleTypeOption[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  canSave: boolean;
}

export default function ScheduleTypesSection({
  draftScheduleTypes,
  onChange,
  onAdd,
  onRemove,
  onSave,
  canSave
}: ScheduleTypesSectionProps) {
  const [expandedScheduleTypes, setExpandedScheduleTypes] = useState<Set<string>>(new Set());

  const addTimeWindow = (scheduleTypeIndex: number) => {
    const next = [...draftScheduleTypes];
    const type = next[scheduleTypeIndex];
    next[scheduleTypeIndex] = {
      ...type,
      timeWindows: [
        ...(type.timeWindows || []),
        {
          id: undefined,
          startTime: "09:00",
          endTime: "15:00",
          ratioAdults: type.ratio.adults,
          ratioStudents: type.ratio.students
        }
      ]
    };
    onChange(next);
  };

  const removeTimeWindow = (scheduleTypeIndex: number, windowIndex: number) => {
    const next = [...draftScheduleTypes];
    const type = next[scheduleTypeIndex];
    next[scheduleTypeIndex] = {
      ...type,
      timeWindows: type.timeWindows?.filter((_, idx) => idx !== windowIndex)
    };
    onChange(next);
  };

  const updateTimeWindow = (
    scheduleTypeIndex: number,
    windowIndex: number,
    field: string,
    value: string | number
  ) => {
    const next = [...draftScheduleTypes];
    const type = next[scheduleTypeIndex];
    const windows = [...(type.timeWindows || [])];
    windows[windowIndex] = { ...windows[windowIndex], [field]: value };
    next[scheduleTypeIndex] = { ...type, timeWindows: windows };
    onChange(next);
  };

  const validateTimeWindows = (windows: ScheduleTypeOption['timeWindows']): string[] => {
    if (!windows || windows.length === 0) return [];

    const errors: string[] = [];
    const parseTime = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    // Check time order
    windows.forEach((window, idx) => {
      if (window.startTime >= window.endTime) {
        errors.push(`Window ${idx + 1}: Start must be before end time`);
      }
    });

    // Check for overlaps
    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const a = windows[i];
        const b = windows[j];
        const aStart = parseTime(a.startTime);
        const aEnd = parseTime(a.endTime);
        const bStart = parseTime(b.startTime);
        const bEnd = parseTime(b.endTime);

        if (aStart < bEnd && bStart < aEnd) {
          errors.push(`Windows ${i + 1} and ${j + 1} overlap`);
        }
      }
    }

    return errors;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 96px",
          gap: "0.75rem",
          fontSize: "0.75rem",
          color: "#6b7280",
          paddingLeft: "0.75rem",
          paddingRight: "0.75rem",
          alignItems: "center"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 200px 1fr",
            gap: "0.75rem",
            alignItems: "center"
          }}
        >
          <span style={{ textAlign: "center", justifySelf: "center" }}>Schedule type</span>
          <span style={{ textAlign: "center", justifySelf: "center" }}>Adult:Student Ratio</span>
          <span style={{ textAlign: "center", justifySelf: "center" }}>Description</span>
        </div>
        <span />
      </div>
      <AnimatePresence initial={false}>
      {draftScheduleTypes
        .filter(type => type.value.trim() !== "closed") // Don't allow editing the "closed" type
        .map((type, index) => (
        <motion.div
          key={`${type.value}-${index}`}
          initial={{ opacity: 0, maxHeight: 0 }}
          animate={{ opacity: 1, maxHeight: "1000px" }}
          exit={{ opacity: 0, maxHeight: 0 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem", overflow: "hidden" }}
        >
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: "0.75rem",
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "160px 200px 1fr 96px",
              alignItems: "center"
            }}
          >
          <input
            value={type.label}
            onChange={(event) => {
              const next = [...draftScheduleTypes];
              next[index] = { ...type, label: event.target.value };
              onChange(next);
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
                onChange(next);
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
                onChange(next);
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
              onChange(next);
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

        {/* Collapsible time windows section */}
        <div style={{ marginLeft: "0.75rem" }}>
          <button
            type="button"
            onClick={() => {
              const next = new Set(expandedScheduleTypes);
              if (next.has(type.value)) next.delete(type.value);
              else next.add(type.value);
              setExpandedScheduleTypes(next);
            }}
            style={{
              background: "none",
              border: "none",
              color: "#3b82f6",
              cursor: "pointer",
              fontSize: "0.875rem",
              padding: "0.25rem 0"
            }}
          >
            {expandedScheduleTypes.has(type.value) ? "▼" : "▶"} Configure time window ratios ({(type.timeWindows || []).length} windows)
          </button>

          <AnimatePresence initial={false}>
          {expandedScheduleTypes.has(type.value) && (
            <motion.div
              initial={{ opacity: 0, maxHeight: 0 }}
              animate={{ opacity: 1, maxHeight: "500px" }}
              exit={{ opacity: 0, maxHeight: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem",
                background: "#f9fafb",
                borderRadius: 8,
                overflow: "hidden"
              }}
            >
              <AnimatePresence initial={false}>
              {validateTimeWindows(type.timeWindows).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, maxHeight: 0 }}
                  animate={{ opacity: 1, maxHeight: "200px" }}
                  exit={{ opacity: 0, maxHeight: 0 }}
                  transition={{ duration: 0.15, ease: "easeInOut" }}
                  style={{
                    background: "#fee2e2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "0.5rem",
                    marginBottom: "0.75rem",
                    color: "#991b1b",
                    fontSize: "0.875rem",
                    overflow: "hidden"
                  }}
                >
                  {validateTimeWindows(type.timeWindows).map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </motion.div>
              )}
              </AnimatePresence>

              {(type.timeWindows || []).map((window, windowIdx) => (
                <div key={windowIdx} style={{
                  display: "grid",
                  gridTemplateColumns: "80px 80px 180px 80px",
                  gap: "0.5rem",
                  alignItems: "center",
                  marginBottom: "0.5rem"
                }}>
                  <input
                    type="time"
                    value={window.startTime}
                    onChange={(e) => updateTimeWindow(index, windowIdx, 'startTime', e.target.value)}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      padding: "0.35rem"
                    }}
                  />
                  <input
                    type="time"
                    value={window.endTime}
                    onChange={(e) => updateTimeWindow(index, windowIdx, 'endTime', e.target.value)}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      padding: "0.35rem"
                    }}
                  />
                  <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      value={window.ratioAdults}
                      onChange={(e) => updateTimeWindow(index, windowIdx, 'ratioAdults', Math.max(1, Number(e.target.value)))}
                      style={{
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        padding: "0.35rem",
                        width: 48,
                        textAlign: "center"
                      }}
                    />
                    <span>:</span>
                    <input
                      type="number"
                      min={1}
                      value={window.ratioStudents}
                      onChange={(e) => updateTimeWindow(index, windowIdx, 'ratioStudents', Math.max(1, Number(e.target.value)))}
                      style={{
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        padding: "0.35rem",
                        width: 48,
                        textAlign: "center"
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTimeWindow(index, windowIdx)}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #fecaca",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.75rem"
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => addTimeWindow(index)}
                style={{
                  borderRadius: 999,
                  border: "1px solid #cbd5f5",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "0.3rem 0.7rem",
                  fontSize: "0.875rem",
                  marginTop: "0.5rem"
                }}
              >
                + Add time window
              </button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
        </motion.div>
      ))}
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
        Add schedule type
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
        Save schedule types
      </button>
    </div>
  );
}
