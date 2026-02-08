import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RuleViolation } from "../types";
import HelpIconButton from "./HelpIconButton";
import type { HelpTopicId } from "./helpContent";
import { colors, shadows } from "../theme";

interface ViolationNavigatorProps {
  violations: RuleViolation[];
  onFocusSegments: (segmentIds: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenHelpTopic?: (topicId: HelpTopicId) => void;
}

const severityStyles: Record<RuleViolation["severity"], { label: string; color: string }> = {
  critical: { label: "Critical", color: "#dc2626" },
  warning: { label: "Warning", color: "#d97706" },
  info: { label: "Info", color: "#0ea5e9" }
};

export default function ViolationNavigator({
  violations,
  onFocusSegments,
  isOpen,
  onClose,
  onOpenHelpTopic
}: ViolationNavigatorProps) {
  const [position, setPosition] = useState({ x: 16, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLElement | null>(null);

  const clampPosition = (x: number, y: number) => {
    const overlay = containerRef.current;
    const width = overlay?.offsetWidth ?? 360;
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

  useEffect(() => {
    if (!isOpen) return;
    setPosition((prev) => clampPosition(prev.x, prev.y));
  }, [isOpen]);

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const getTargetForSegment = (segmentId: string, dayOfWeek?: string) => {
    const visibleBlock = document.querySelector<HTMLElement>(
      `[data-segment-id="${segmentId}"]`
    );
    if (visibleBlock && visibleBlock.offsetParent !== null) {
      return visibleBlock;
    }
    const visibleTimeline = document.querySelector<HTMLElement>(`[data-timeline-segment-id="${segmentId}"]`);
    if (visibleTimeline && visibleTimeline.offsetParent !== null) {
      return visibleTimeline;
    }
    if (dayOfWeek) {
      const header = document.querySelector<HTMLElement>(`[data-day-column-header="${dayOfWeek}"]`);
      if (header && header.offsetParent !== null) {
        return header;
      }
    }
    const anchor = document.querySelector<HTMLElement>(`[data-segment-anchor-id="${segmentId}"]`);
    if (anchor && anchor.offsetParent !== null) {
      return anchor;
    }
    return anchor;
  };

  const adjustForTarget = (segmentIds: string[], dayOfWeek?: string) => {
    const overlay = containerRef.current;
    const targetFromSegments =
      segmentIds.map((segmentId) => getTargetForSegment(segmentId, dayOfWeek)).find(Boolean) ?? null;
    const targetFromDay =
      dayOfWeek ? document.querySelector<HTMLElement>(`[data-day-column-header="${dayOfWeek}"]`) : null;
    const target = targetFromSegments ?? targetFromDay;
    if (!overlay || !target) return;
    const overlayRect = overlay.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const overlaps = !(
      overlayRect.right < targetRect.left ||
      overlayRect.left > targetRect.right ||
      overlayRect.bottom < targetRect.top ||
      overlayRect.top > targetRect.bottom
    );
    if (!overlaps) return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16;
    let nextX = position.x;
    let nextY = position.y;
    const rightSpace = viewportWidth - targetRect.right - overlayRect.width - padding;
    const leftSpace = targetRect.left - overlayRect.width - padding;
    const belowSpace = viewportHeight - targetRect.bottom - overlayRect.height - padding;
    if (rightSpace > 0) {
      nextX = targetRect.right + padding;
      nextY = Math.min(position.y, viewportHeight - overlayRect.height - padding);
    } else if (leftSpace > 0) {
      nextX = Math.max(padding, targetRect.left - overlayRect.width - padding);
      nextY = Math.min(position.y, viewportHeight - overlayRect.height - padding);
    } else if (belowSpace > 0) {
      nextY = targetRect.bottom + padding;
      nextX = Math.min(position.x, viewportWidth - overlayRect.width - padding);
    } else {
      nextY = Math.max(padding, targetRect.top - overlayRect.height - padding);
      nextX = Math.min(position.x, viewportWidth - overlayRect.width - padding);
    }
    setPosition(clampPosition(nextX, nextY));
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
        width: "min(360px, calc(100vw - 1.5rem))",
        maxHeight: "70vh",
        overflow: "hidden",
        background: colors.surfaceAlt,
        borderRadius: 18,
        padding: "0.75rem",
        boxShadow: shadows.card,
        border: `1px solid ${colors.borderSubtle}`,
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
              background: "repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 2px, #e2e8f0 2px, #e2e8f0 4px)"
            }}
          />
          <h3 style={{ margin: 0 }}>Violation navigator</h3>
          <HelpIconButton
            label="Violation navigator"
            onClick={() => onOpenHelpTopic?.("violations")}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>{violations.length} active</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: "1px solid #e2e8f0",
              background: "#e2e8f0",
              color: "#0f172a",
              padding: "0.2rem 0.6rem",
              fontSize: "0.8rem"
            }}
          >
            Close
          </button>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          marginTop: "0.75rem",
          maxHeight: "60vh",
          overflowY: "auto",
          paddingRight: "0.25rem"
        }}
      >
        {violations.length === 0 ? (
          <div style={{ padding: "0.5rem 0.25rem", color: "#6b7280", fontSize: "0.85rem" }}>
            No active violations.
          </div>
        ) : (
          violations.map((violation, index) => {
          const severity = severityStyles[violation.severity];
          return (
            <article
              key={`${violation.id}-${index}`}
            style={{
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              padding: "0.75rem",
              background: colors.surfaceRaised,
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem"
            }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "1rem" }}>Rule: {violation.title}</h4>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.15rem 0.6rem",
                    borderRadius: 999,
                    background: `${severity.color}1a`,
                    color: severity.color,
                    border: `1px solid ${severity.color}`
                  }}
                >
                  {severity.label}
                </span>
              </div>
              {violation.dayLabel && (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#1d4ed8", fontWeight: 600 }}>
                  {violation.dayLabel}
                </p>
              )}
              <p style={{ margin: 0, color: "#4b5563" }}>
                Issue: {violation.issue ?? violation.description}
              </p>
              {violation.context && (
                <p style={{ margin: 0, color: "#4b5563" }}>
                  Context: {violation.context}
                </p>
              )}
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>
                Citation: {violation.policyCitation.name}{violation.policyCitation.section ? ' (' + violation.policyCitation.section + ')' : ''}
              </p>
              <p style={{ margin: 0, fontWeight: 600, color: "#166534" }}>
                Fix: {violation.recommendedAction}
              </p>
              {Boolean(violation.metadata?.operatingHoursId) && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.6rem",
                    borderRadius: 999,
                    background: "#86efac",
                    color: "#047857",
                    alignSelf: "flex-start"
                  }}
                >
                  Operating hours guardrail
                </span>
              )}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                <button
                  onClick={() => {
                    const segmentIds = [
                      violation.segmentBlockId,
                      ...(violation.relatedSegmentBlockIds ?? [])
                    ];
                    const uniqueSegmentIds = Array.from(new Set(segmentIds.filter(Boolean)));
                    if (uniqueSegmentIds.length > 0) {
                      onFocusSegments(uniqueSegmentIds);
                    } else {
                      const dayOfWeek = String(violation.metadata?.dayOfWeek ?? "");
                      if (dayOfWeek) {
                        const dayHeader = document.querySelector<HTMLElement>(
                          `[data-day-column-header="${dayOfWeek}"]`
                        );
                        dayHeader?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
                      }
                    }
                    window.setTimeout(
                      () => adjustForTarget(uniqueSegmentIds, String(violation.metadata?.dayOfWeek ?? "")),
                      220
                    );
                  }}
                  style={{
                    borderRadius: 999,
                    border: "1px solid #2563eb",
                    background: "#bfdbfe",
                    color: "#1d4ed8",
                    padding: "0.35rem 0.85rem"
                  }}
                >
                  Jump to block
                </button>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "#6b7280"
                  }}
                >
                  Live violation — edit the timeline to clear it.
                </span>
              </div>
            </article>
          );
        })
        )}
      </div>
    </motion.section>
  );
}
