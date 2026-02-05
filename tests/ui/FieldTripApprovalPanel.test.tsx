import { render, screen } from "@testing-library/react";
import FieldTripApprovalPanel from "../../src/ui/components/FieldTripApprovalPanel";
import type { DayOfWeek, FieldTripEvent } from "../../src/domain/types";

const tripType = {
  id: "ft-test",
  name: "City Aquarium",
  minAdultStudentRatio: 0.2,
  minLeaderStudentRatio: 0.1,
  policyCitationId: "policy-field-trip",
  notes: "Test trip"
};

const citation = {
  id: "cit-field-test",
  name: "Field trip governance",
  document: "Field Trip Handbook",
  section: "2.8",
  notes: "Requires director sign-off"
};

describe("FieldTripApprovalPanel", () => {
  it("shows pending status and keeps the sign-off button enabled when metadata is missing", () => {
    const event: FieldTripEvent = {
      id: "ev-missing",
      scheduleWeekId: "week-1",
      dayOfWeek: "fri" as DayOfWeek,
      segment: "mid",
      fieldTripTypeId: tripType.id
    };

    render(<FieldTripApprovalPanel event={event} tripType={tripType} citation={citation} onSignOff={() => {}} />);

    expect(screen.getByText("Sign-off required")).toBeVisible();
    const button = screen.getByRole("button", { name: "Add director sign-off" });
    expect(button).toBeEnabled();
  });

  it("shows approved status and disables the button once metadata exists", () => {
    const event: FieldTripEvent = {
      id: "ev-signed",
      scheduleWeekId: "week-1",
      dayOfWeek: "sat" as DayOfWeek,
      segment: "open",
      fieldTripTypeId: tripType.id,
      approverId: "Director X",
      signedOffAt: "2026-02-05T12:00:00Z"
    };

    render(<FieldTripApprovalPanel event={event} tripType={tripType} citation={citation} onSignOff={() => {}} />);

    expect(screen.getByText("Approved")).toBeVisible();
    const button = screen.getByRole("button", { name: "Signed off" });
    expect(button).toBeDisabled();
  });
});
