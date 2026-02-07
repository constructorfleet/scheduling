import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AuditEvent } from "../types";

interface AuditTimelineProps {
  events: AuditEvent[];
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditTimeline({
  events,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isOpen,
  onClose
}: AuditTimelineProps) {
  const [position, setPosition] = useState({ x: 420, y: 140 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLElement | null>(null);

  const clampPosition = (x: number, y: number) => {
    const overlay = containerRef.current;
    const width = overlay?.offsetWidth ?? 380;
    const height = overlay?.offsetHeight ?? 420;
    const margin = 12;
    return {
      x: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      y: Math.max(margin, Math.min(y, window.innerHeight - height - margin))
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y
    };
    event.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;
    const handlePointerMove = (event: PointerEvent) => {
      const next = clampPosition(event.clientX - dragOffset.current.x, event.clientY - dragOffset.current.y);
      setPosition(next);
    };
    const handlePointerUp = () => {
      setIsDragging(false);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <motion.section
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, ease: "linear" }}
      style={{
        position: "fixed",
        top: position.y,
        left: position.x,
        width: 380,
        maxHeight: "70vh",
        overflow: "hidden",
        background: "#ffffff",
        borderRadius: 18,
        padding: "0.75rem",
        boxShadow: "0 25px 50px rgba(15, 23, 42, 0.25)",
        border: "1px solid #e2e8f0",
        zIndex: 40
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
            flex: 1
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 6,
              border: "1px solid #cbd5f5",
              background: "repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 2px, #f8fafc 2px, #f8fafc 4px)"
            }}
          />
          <h3 style={{ margin: 0 }}>Audit timeline</h3>
        </div>
        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            style={{
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: canUndo ? "#eff6ff" : "#f1f5f9",
              color: canUndo ? "#2563eb" : "#94a3b8",
              padding: "0.3rem 0.7rem"
            }}
          >
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            style={{
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: canRedo ? "#eff6ff" : "#f1f5f9",
              color: canRedo ? "#2563eb" : "#94a3b8",
              padding: "0.3rem 0.7rem"
            }}
          >
            Redo
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#0f172a",
              padding: "0.3rem 0.7rem",
              fontSize: "0.8rem"
            }}
          >
            Close
          </button>
        </div>
      </div>
      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
          maxHeight: "60vh",
          overflowY: "auto",
          paddingRight: "0.25rem"
        }}
      >
        {events.length === 0 ? (
          <div style={{ padding: "0.5rem 0.25rem", color: "#6b7280", fontSize: "0.85rem" }}>
            No audit events recorded yet.
          </div>
        ) : (
          events.map((event) => (
            <article
              key={event.id}
              style={{
                borderBottom: "1px solid #e5e7eb",
                paddingBottom: "0.5rem",
                display: "flex",
                justifyContent: "space-between",
                gap: "0.5rem"
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{event.action}</p>
                <p style={{ margin: "0.15rem 0", fontSize: "0.85rem", color: "#6b7280" }}>{event.user}</p>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
                  {new Date(event.timestamp).toLocaleString()} · {event.policyCitation.name}
                </p>
              </div>
              {event.notes && (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#0f172a" }}>{event.notes}</p>
              )}
            </article>
          ))
        )}
      </div>
    </motion.section>
  );
}
