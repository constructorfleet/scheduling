import { useMemo, useState } from "react";
import WeekNavigationBanner from "./components/WeekNavigationBanner";
import StaffPalette from "./components/StaffPalette";
import ScheduleGrid from "./components/ScheduleGrid";
import ViolationNavigator from "./components/ViolationNavigator";
import GuidedStatusTracker from "./components/GuidedStatusTracker";
import FieldTripApprovalPanel from "./components/FieldTripApprovalPanel";
import SubstituteAssignmentPanel from "./components/SubstituteAssignmentPanel";
import AuditTimeline from "./components/AuditTimeline";
import {
  auditTimeline,
  dayDisplayNames,
  daySequence,
  employees,
  fieldTripEvents,
  fieldTripTypes,
  policyCitations,
  ruleViolations,
  segmentBlocks,
  segmentSlotDefinitions,
  staffAssignments,
  substituteRequests,
  weekMeta,
  schools
} from "./data/mockScheduleData";
import { GuidedStep, RuleViolation, SubstituteAssignmentCard } from "./types";
import { ScheduleStatus } from "../domain/types";

type WeekDirection = "prev" | "next";

const formatWeekRange = (startDate: Date) => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startLabel = startDate.toLocaleDateString(undefined, options);
  const endLabel = endDate.toLocaleDateString(undefined, options);
  return `${startLabel} – ${endLabel}, ${endDate.getFullYear()}`;
};

export default function App() {
  const [weekStartDate, setWeekStartDate] = useState(() => new Date(weekMeta.startDate));
  const [selectedSchoolId, setSelectedSchoolId] = useState(schools[0].id);
  const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>(undefined);
  const [violations, setViolations] = useState<RuleViolation[]>(ruleViolations);
  const [fieldTrip, setFieldTrip] = useState(fieldTripEvents[0]);
  const [substitutes, setSubstitutes] = useState(substituteRequests);
  const [undoCount, setUndoCount] = useState(2);
  const [redoCount, setRedoCount] = useState(0);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const weekLabel = formatWeekRange(weekStartDate);
  const unresolvedViolations = violations.filter((violation) => !violation.resolved);
  const validationComplete = unresolvedViolations.length === 0;
  const fieldTripSigned = Boolean(fieldTrip?.approverId && fieldTrip?.signedOffAt);
  const readyToPublish = validationComplete && fieldTripSigned;
  const complianceHighlights = [
    `${unresolvedViolations.length} violation${unresolvedViolations.length === 1 ? "" : "s"} outstanding`,
    fieldTripSigned ? "Field trip approved" : "Field trip pending sign-off",
    readyToPublish ? "Ready for publish" : "Resolve blockers before publishing"
  ];

  const guidedSteps: GuidedStep[] = [
    { id: "draft", label: "Draft workspace", detail: "Add staff and break coverage before running validation.", status: "complete" },
    {
      id: "validation",
      label: "Validation",
      detail: "Violations link directly to the grid; clear them so the tracker turns green.",
      status: validationComplete ? "complete" : "in_progress",
      actionLabel: validationComplete ? undefined : "Mark validations addressed"
    },
    {
      id: "field-trip",
      label: "Field trip sign-off",
      detail: "Director approval metadata gates any trip overrides.",
      status: fieldTripSigned ? "complete" : "blocked",
      actionLabel: fieldTripSigned ? undefined : "Add director sign-off",
      blockingReason: fieldTripSigned ? undefined : "Field trip needs a director signature"
    },
    {
      id: "publish",
      label: "Ready to publish",
      detail: "Publish only when every validation step is clear.",
      status: readyToPublish ? "in_progress" : "blocked"
    }
  ];

  const handleWeekShift = (direction: WeekDirection) => {
    setWeekStartDate((current) => {
      const updated = new Date(current);
      updated.setDate(updated.getDate() + (direction === "next" ? 7 : -7));
      return updated;
    });
  };

  const handleAutoBalance = () => {
    const nextViolation = violations.find((violation) => !violation.resolved);
    if (nextViolation) {
      setFocusedSegmentId(nextViolation.segmentBlockId);
    }
  };

  const handleResolveViolation = (violationId: string) => {
    setViolations((prev) =>
      prev.map((violation) => (violation.id === violationId ? { ...violation, resolved: true } : violation))
    );
  };

  const handleFieldTripSignOff = () => {
    setFieldTrip((prev) => ({
      ...prev,
      approverId: "Aisha Patel",
      signedOffAt: new Date("2026-02-04T16:20:00Z").toISOString()
    }));
  };

  const handleStepAction = (stepId: string) => {
    if (stepId === "validation") {
      setViolations((prev) => prev.map((violation) => ({ ...violation, resolved: true })));
    }
    if (stepId === "field-trip") {
      handleFieldTripSignOff();
    }
  };

  const handleSubstituteAction = (requestId: string) => {
    setSubstitutes((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              approverId: "Aisha Patel",
              approvedAt: new Date("2026-02-04T15:10:00Z").toISOString()
            }
          : request
      )
    );
  };

  const substituteCards = useMemo<SubstituteAssignmentCard[]>(() => {
    return substitutes.map((request) => {
      const block = segmentBlocks.find((segment) => segment.id === request.segmentBlockId);
      const replacement = employees.find((employee) => employee.id === request.replacementEmployeeId);
      const issues: string[] = [];
      if (!request.approverId) {
        issues.push("Approver metadata missing");
      }
      if (!request.approvedAt) {
        issues.push("Approval timestamp missing");
      }
      if (!replacement?.leaderQualified) {
        issues.push("Leader parity needs review");
      }
      const slotLabel = block ? segmentSlotDefinitions[block.segment]?.label ?? "Segment" : "Segment";
      const state: SubstituteAssignmentCard["state"] = issues.length ? "blocked" : "ready";
      return {
        requestId: request.id,
        replacementName: replacement?.name ?? "Unknown",
        originalDay: block?.dayOfWeek ?? "mon",
        segmentLabel: slotLabel,
        approver: request.approverId,
        approvedAt: request.approvedAt,
        parityCheck: Boolean(replacement?.leaderQualified),
        issues,
        state
      };
    });
  }, [substitutes]);

  const fieldTripType = fieldTripTypes.find((type) => type.id === fieldTrip.fieldTripTypeId) ?? fieldTripTypes[0];

  const handlePublish = () => {
    if (!readyToPublish) return;
    setPublishMessage(`Schedule published ${new Date().toLocaleString()}`);
  };

  const handleUndo = () => {
    setUndoCount((value) => Math.max(0, value - 1));
    setRedoCount((value) => value + 1);
  };

  const handleRedo = () => {
    setRedoCount((value) => Math.max(0, value - 1));
    setUndoCount((value) => value + 1);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #eef2ff, #f8fafc)",
        padding: "2rem",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#111827"
      }}
    >
      <WeekNavigationBanner
        schoolOptions={schools}
        selectedSchoolId={selectedSchoolId}
        onSchoolChange={setSelectedSchoolId}
        weekLabel={weekLabel}
        status={weekMeta.status}
        complianceHighlights={complianceHighlights}
        onShiftWeek={handleWeekShift}
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: "1.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <StaffPalette
            staff={employees}
            assignments={staffAssignments}
            selectedId={selectedStaffId}
            onSelect={setSelectedStaffId}
          />
          <ScheduleGrid
            segments={segmentBlocks}
            assignments={staffAssignments}
            employees={employees}
            violations={violations}
            focusedSegmentId={focusedSegmentId ?? undefined}
            onFocusSegment={(segmentId) => setFocusedSegmentId(segmentId)}
            daySequence={daySequence}
            dayDisplayNames={dayDisplayNames}
            segmentDefinitions={segmentSlotDefinitions}
            onAutoBalance={handleAutoBalance}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <GuidedStatusTracker steps={guidedSteps} onStepAction={handleStepAction} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <button
              disabled={!readyToPublish}
              onClick={handlePublish}
              style={{
                borderRadius: 999,
                border: "none",
                background: readyToPublish ? "#0ea5e9" : "#cbd5f5",
                color: "#fff",
                padding: "0.65rem 1rem",
                fontWeight: 600,
                cursor: readyToPublish ? "pointer" : "not-allowed"
              }}
            >
              {readyToPublish ? "Publish schedule" : "Publish blocked"}
            </button>
            {publishMessage && <p style={{ margin: 0, color: "#0f172a", fontSize: "0.85rem" }}>{publishMessage}</p>}
          </div>
          <ViolationNavigator
            violations={violations}
            onFocusSegment={(segmentId) => setFocusedSegmentId(segmentId)}
            onResolveViolation={handleResolveViolation}
          />
          <FieldTripApprovalPanel
            event={fieldTrip}
            tripType={fieldTripType}
            citation={policyCitations.fieldTrip}
            onSignOff={handleFieldTripSignOff}
          />
          <SubstituteAssignmentPanel requests={substituteCards} onRequestAction={handleSubstituteAction} />
          <AuditTimeline
            events={auditTimeline}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoCount > 0}
            canRedo={redoCount > 0}
          />
        </div>
      </div>
    </div>
  );
}
