import { DayOfWeek, FieldTripEvent, FieldTripType, ScheduleDay, ScheduleType } from "@core/domain/types";

export interface ScheduleTypeOption {
  value: ScheduleType;
  label: string;
  ratio: { adults: number; students: number };
  description: string;
}

export type FieldTripSelection = { type: "trip"; fieldTripTypeId: string } | { type: "none" };

interface DayMetadataStripProps {
  days: ScheduleDay[];
  dayDisplayNames: Record<DayOfWeek, string>;
  scheduleTypeOptions: ScheduleTypeOption[];
  fieldTripTypes: FieldTripType[];
  fieldTripEventsByDay: Record<DayOfWeek, FieldTripEvent | undefined>;
  daySequence: DayOfWeek[];
  onEnrollmentChange: (dayId: string, enrollment: number | undefined) => void;
  onScheduleTypeChange: (dayId: string, scheduleType: ScheduleType | undefined) => void;
  onFieldTripSelection: (dayId: string, selection: FieldTripSelection) => void;
}

const FIELD_TRIP_OPTIONS = (fieldTripTypes: FieldTripType[]) => [
  {
    value: "no-field-trip",
    label: "No Field Trip",
    hint: "Stay on campus with the default ratio."
  },
  ...fieldTripTypes.map((type) => ({
    value: type.id,
    label: type.name,
    hint: `Adults 1:${type.minAdultStudentRatio} · Leaders 1:${type.minLeaderStudentRatio}`
  }))
];

const formatEnrollmentHint = (count?: number) => {
  if (count === undefined || count === null) {
    return "Enter the enrolled child count to trigger ratio math.";
  }
  return `${count} children recorded for the day.`;
};

export default function DayMetadataStrip({
  days,
  dayDisplayNames,
  daySequence,
  scheduleTypeOptions,
  fieldTripTypes,
  fieldTripEventsByDay,
  onEnrollmentChange,
  onScheduleTypeChange,
  onFieldTripSelection
}: DayMetadataStripProps) {
  const metadataByDay = Object.fromEntries(days.map((day) => [day.dayOfWeek, day]));
  const fieldTripDropDown = FIELD_TRIP_OPTIONS(fieldTripTypes);

  return (
    <section
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: "1rem",
        boxShadow: "0 15px 35px rgba(15, 23, 42, 0.08)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Day metadata</h3>
        <p style={{ margin: 0, color: "#6b7280" }}>Enrollment · Schedule type · Field trip status</p>
      </div>
      <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: `repeat(${daySequence.length}, minmax(0, 1fr))`, gap: "0.75rem" }}>
        {daySequence.map((dayOfWeek) => {
          const day = metadataByDay[dayOfWeek];
          const fieldTripEvent = fieldTripEventsByDay[dayOfWeek];
          const selectedType = scheduleTypeOptions.find((option) => option.value === day?.scheduleType);
          const hasMissingMetadata =
            !day || !day.scheduleType || day.enrollmentCount === undefined || !fieldTripEvent?.id;

          return (
            <article
              key={`metadata-${dayOfWeek}`}
              style={{
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                padding: "0.75rem",
                background: hasMissingMetadata ? "#fff7f6" : "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "0.45rem",
                minHeight: 220
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{dayDisplayNames[dayOfWeek]}</p>
                {hasMissingMetadata && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.15rem 0.5rem",
                      borderRadius: 999,
                      background: "#fee2e2",
                      color: "#b91c1c"
                    }}
                  >
                    Required
                  </span>
                )}
              </div>
              <label style={{ fontSize: "0.75rem", color: "#374151" }}>Enrollment</label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 22"
                value={day?.enrollmentCount ?? ""}
                onChange={(event) => {
                  if (!day) {
                    return;
                  }
                  const raw = event.target.value;
                  if (raw === "") {
                    onEnrollmentChange(day.id, undefined);
                    return;
                  }
                  const parsed = Number(raw);
                  if (!Number.isNaN(parsed)) {
                    onEnrollmentChange(day.id, parsed);
                  }
                }}
                style={{
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.85rem"
                }}
              />
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>{formatEnrollmentHint(day?.enrollmentCount)}</p>

              <label style={{ fontSize: "0.75rem", color: "#374151" }}>Schedule type</label>
              <select
                value={day?.scheduleType ?? ""}
                onChange={(event) => {
                  if (!day) {
                    return;
                  }
                  const nextValue = event.target.value as ScheduleType | "";
                  onScheduleTypeChange(day.id, nextValue === "" ? undefined : nextValue);
                }}
                style={{
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0.4rem 0.65rem"
                }}
              >
                <option value="">Select type</option>
                {scheduleTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedType && (
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#2563eb" }}>
                  Adult:Student {selectedType.ratio.adults}:{selectedType.ratio.students}
                </p>
              )}

              <label style={{ fontSize: "0.75rem", color: "#374151" }}>Field trip selection</label>
              <select
                value={
                  fieldTripEvent?.isNoFieldTrip
                    ? "no-field-trip"
                    : fieldTripEvent?.fieldTripTypeId ?? ""
                }
                onChange={(event) => {
                  const value = event.target.value;
                  if (!day) {
                    return;
                  }
                  if (value === "no-field-trip") {
                    onFieldTripSelection(day.id, { type: "none" });
                    return;
                  }
                  onFieldTripSelection(day.id, { type: "trip", fieldTripTypeId: value });
                }}
                style={{
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  padding: "0.4rem 0.65rem"
                }}
              >
                {fieldTripDropDown.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>
                {fieldTripEvent?.isNoFieldTrip
                  ? "No field trip assigned."
                  : `${fieldTripTypes.find((type) => type.id === fieldTripEvent?.fieldTripTypeId)?.name ?? ""}`}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
