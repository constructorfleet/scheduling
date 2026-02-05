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
  segmentBlocks,
  segmentSlotDefinitions,
  staffAssignments,
  substituteRequests,
  weekMeta,
  schools
} from "./data/mockScheduleData";
import { GuidedStep, RuleViolation as UiRuleViolation, SubstituteAssignmentCard } from "./types";
import { ScheduleStatus, PolicyCitation } from "../domain/types";
import { createRulesEngine } from "../rules/engine";
import type { RuleViolation as EngineRuleViolation, RulesContext } from "../rules/types";

const RULE_TITLES: Record<string, string> = {
  "ratio-segment": "Ratio staffing gap",
  "certification-per-segment": "Certification missing",
  "segment-coverage": "Coverage guardrail",
  "shift-break-limits": "Shift limit breach",
  "substitute-parity": "Substitute metadata",
  "field-trip-ratios": "Field trip ratio",
  "field-trip-signoff": "Field trip sign-off"
};

const RECOMMENDED_ACTIONS: Record<string, string> = {
  "ratio-segment": "Add a certified staff member or adjust child counts so the segment meets the ratio.",
  "certification-per-segment": "Reassign staff with the required CPR, medical delegation, or leader qualification.",
  "segment-coverage": "Bring a leader-qualified or medically delegated staff member into the block.",
  "shift-break-limits": "Split the shift into shorter blocks or assign a break to stay under the cap.",
  "substitute-parity": "Capture the missing substitute metadata (approver, timestamp, parity) before confirming.",
  "field-trip-ratios": "Reconcile adult and leader counts with the ratio required for this trip.",
  "field-trip-signoff": "Add the director approver name and timestamp so the trip can publish."
};

const RULE_POLICY_CITATIONS = {
  "ratio-segment": policyCitations.ratio.id,
  "certification-per-segment": policyCitations.ratio.id,
  "segment-coverage": policyCitations.leaderCoverage.id,
  "shift-break-limits": policyCitations.breakPolicy.id,
  "substitute-parity": policyCitations.leaderCoverage.id,
  "field-trip-ratios": policyCitations.fieldTrip.id,
  "field-trip-signoff": policyCitations.fieldTrip.id
} as const;

const SEVERITY_MAP: Record<EngineRuleViolation["severity"], UiRuleViolation["severity"]> = {
  error: "critical",
  warning: "warning"
};

const POLICY_CITATION_LIST = Object.values(policyCitations);

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
  const [fieldTripEventsState, setFieldTripEventsState] = useState(fieldTripEvents);
  const [substituteRequestsState, setSubstituteRequestsState] = useState(substituteRequests);
  const [resolvedViolationIds, setResolvedViolationIds] = useState<Set<string>>(() => new Set());
  const [undoCount, setUndoCount] = useState(2);
  const [redoCount, setRedoCount] = useState(0);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [scheduleDaysState, _] = useState([]);

  const engine = useMemo(() => createRulesEngine(), []);
  const ruleViolationsFromEngine = useMemo(() => {
    const context: RulesContext = {
      segmentBlocks,
      staffAssignments,
      employees,
      substituteRequests: substituteRequestsState,
      fieldTripEvents: fieldTripEventsState,
      fieldTripTypes,
      policyCitations: POLICY_CITATION_LIST,
      rulePolicyCitations: RULE_POLICY_CITATIONS,
      scheduleDays: scheduleDaysState
    };
    return engine.evaluate(context);
  }, [
    engine,
    substituteRequestsState,
    fieldTripEventsState,
    segmentBlocks,
    staffAssignments,
    employees,
    fieldTripTypes,
    POLICY_CITATION_LIST
  ]);

  const resolveSegmentBlockId = (target: EngineRuleViolation["target"]) => {
    if (target.entity === "SegmentBlock") {
      return target.id;
    }
    if (target.entity === "StaffAssignment") {
      const assignment = staffAssignments.find((item) => item.id === target.id);
      return assignment?.segmentBlockId;
    }
    if (target.entity === "FieldTripEvent") {
      return segmentBlocks.find((block) => block.fieldTripEventId === target.id)?.id;
    }
    return undefined;
  };

  const violationRecords = useMemo(() => {
    return ruleViolationsFromEngine.map((engineViolation) => {
      const citation: PolicyCitation =
        policyCitations[engineViolation.citationId ?? ""] ??
        ({
          id: engineViolation.citationId ?? "unknown",
          name: RULE_TITLES[engineViolation.ruleId] ?? "Policy violation",
          document: "Rules engine"
        } as PolicyCitation);
      const segmentBlockId = resolveSegmentBlockId(engineViolation.target) ?? engineViolation.target.id;

      return {
        id: engineViolation.id,
        title: RULE_TITLES[engineViolation.ruleId] ?? engineViolation.ruleId,
        severity: SEVERITY_MAP[engineViolation.severity] ?? "warning",
        description: engineViolation.message,
        segmentBlockId,
        policyCitation: citation,
        recommendedAction: RECOMMENDED_ACTIONS[engineViolation.ruleId] ?? "Review the segment and adjust coverage.",
        resolved: resolvedViolationIds.has(engineViolation.id)
      } satisfies UiRuleViolation;
    });
  }, [ruleViolationsFromEngine, resolvedViolationIds, policyCitations, segmentBlocks, staffAssignments]);

  const unresolvedViolations = violationRecords.filter((violation) => !violation.resolved);
  const validationComplete = unresolvedViolations.length === 0;
  const activeFieldTripEvent = fieldTripEventsState[0] ?? null;
  const fieldTripSigned = Boolean(activeFieldTripEvent?.approverId && activeFieldTripEvent?.signedOffAt);
  const readyToPublish = validationComplete && fieldTripSigned;
  const scheduleStatus: ScheduleStatus = readyToPublish ? "ready_for_review" : weekMeta.status;
  const weekLabel = formatWeekRange(weekStartDate);
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
    const nextViolation = violationRecords.find((violation) => !violation.resolved);
    if (nextViolation) {
      setFocusedSegmentId(nextViolation.segmentBlockId);
    }
  };

  const handleResolveViolation = (violationId: string) => {
    setResolvedViolationIds((prev) => {
      if (prev.has(violationId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(violationId);
      return next;
    });
  };

  const handleFieldTripSignOff = () => {
    if (!activeFieldTripEvent) return;
    setFieldTripEventsState((prev) =>
      prev.map((event) =>
        event.id === activeFieldTripEvent.id
          ? {
              ...event,
              approverId: "Aisha Patel",
              signedOffAt: new Date("2026-02-04T16:20:00Z").toISOString()
            }
          : event
      )
    );
  };

  const handleStepAction = (stepId: string) => {
    if (stepId === "validation") {
      setResolvedViolationIds((prev) => {
        const next = new Set(prev);
        ruleViolationsFromEngine.forEach((violation) => next.add(violation.id));
        return next;
      });
    }
    if (stepId === "field-trip") {
      handleFieldTripSignOff();
    }
  };

  const handleSubstituteAction = (requestId: string) => {
    setSubstituteRequestsState((prev) =>
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
    return substituteRequestsState.map((request) => {
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
  }, [substituteRequestsState, employees, segmentBlocks, segmentSlotDefinitions]);

  const fieldTripType =
    fieldTripTypes.find((type) => type.id === activeFieldTripEvent?.fieldTripTypeId) ?? fieldTripTypes[0];

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
        status={scheduleStatus}
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
            violations={violationRecords}
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
            violations={violationRecords}
            onFocusSegment={(segmentId) => setFocusedSegmentId(segmentId)}
            onResolveViolation={handleResolveViolation}
          />
          {activeFieldTripEvent && (
            <FieldTripApprovalPanel
              event={activeFieldTripEvent}
              tripType={fieldTripType}
              citation={policyCitations.fieldTrip}
              onSignOff={handleFieldTripSignOff}
            />
          )}
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
