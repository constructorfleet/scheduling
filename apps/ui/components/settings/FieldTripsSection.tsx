import { motion, AnimatePresence } from "framer-motion";
import type { FieldTripType } from "@core/domain/types";

interface FieldTripsSectionProps {
  draftFieldTrips: FieldTripType[];
  onChange: (next: FieldTripType[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  canSave: boolean;
}

export default function FieldTripsSection({
  draftFieldTrips,
  onChange,
  onAdd,
  onRemove,
  onSave,
  canSave
}: FieldTripsSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          fontSize: "0.875rem",
          color: "#4b5563",
          padding: "0.75rem",
          background: "#f9fafb",
          borderRadius: 10,
          border: "1px solid #e5e7eb"
        }}
      >
        <strong>Note:</strong> If the leader ratio is set to 0:0, it will be ignored and only the adult ratio will be enforced for that field trip.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 88px",
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
            gridTemplateColumns: "1.2fr 200px 200px",
            gap: "0.75rem",
            alignItems: "center"
          }}
        >
          <span style={{ textAlign: "center", justifySelf: "center" }}>Field trip</span>
          <span style={{ textAlign: "center", justifySelf: "center" }}>Adult ratio</span>
          <span style={{ textAlign: "center", justifySelf: "center" }}>Leader ratio</span>
        </div>
        <span />
      </div>
      <AnimatePresence initial={false}>
      {draftFieldTrips.map((trip, index) => {
        return (
          <motion.div
            key={trip.id}
            initial={{ opacity: 0, maxHeight: 0 }}
            animate={{ opacity: 1, maxHeight: "200px" }}
            exit={{ opacity: 0, maxHeight: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: "0.75rem",
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "1.2fr 200px 200px 88px",
              alignItems: "center",
              overflow: "hidden"
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
                value={trip.adultRatioAdults}
                onChange={(event) => {
                  const nextAdults = Math.max(1, Number(event.target.value) || 1);
                  const next = [...draftFieldTrips];
                  next[index] = {
                    ...trip,
                    adultRatioAdults: nextAdults
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
                value={trip.adultRatioStudents}
                onChange={(event) => {
                  const nextStudents = Math.max(1, Number(event.target.value) || 1);
                  const next = [...draftFieldTrips];
                  next[index] = {
                    ...trip,
                    adultRatioStudents: nextStudents
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
                min={0}
                value={trip.leaderRatioAdults}
                onChange={(event) => {
                  const nextAdults = Math.max(0, Number(event.target.value) || 0);
                  const next = [...draftFieldTrips];
                  next[index] = {
                    ...trip,
                    leaderRatioAdults: nextAdults,
                    leaderRatioStudents: nextAdults === 0 ? 0 : trip.leaderRatioStudents
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
                min={0}
                value={trip.leaderRatioStudents}
                onChange={(event) => {
                  const nextStudents = Math.max(0, Number(event.target.value) || 0);
                  const next = [...draftFieldTrips];
                  next[index] = {
                    ...trip,
                    leaderRatioAdults: nextStudents === 0 ? 0 : trip.leaderRatioAdults,
                    leaderRatioStudents: nextStudents
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
