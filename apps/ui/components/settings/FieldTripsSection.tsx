import type { FieldTripType } from "@core/domain/types";

interface FieldTripsSectionProps {
  draftFieldTrips: FieldTripType[];
  onChange: (next: FieldTripType[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  canSave: boolean;
  ratioToPair: (ratio: number) => { adults: number; students: number };
}

export default function FieldTripsSection({
  draftFieldTrips,
  onChange,
  onAdd,
  onRemove,
  onSave,
  canSave,
  ratioToPair
}: FieldTripsSectionProps) {
  return (
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
      {draftFieldTrips.map((trip, index) => {
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
                onChange(next);
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
                value={adultPair.students}
                onChange={(event) => {
                  const nextStudents = Math.max(1, Number(event.target.value) || 1);
                  const next = [...draftFieldTrips];
                  next[index] = {
                    ...trip,
                    minAdultStudentRatio: Math.max(1, adultPair.adults) / nextStudents
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
                  onChange(next);
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
        Add field trip
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
        Save field trips
      </button>
    </div>
  );
}
