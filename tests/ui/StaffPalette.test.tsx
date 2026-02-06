import { fireEvent, render, screen } from "@testing-library/react";
import StaffPalette from "../../src/ui/components/StaffPalette";
import type { Employee, StaffAssignment } from "../../src/domain/types";

describe("StaffPalette", () => {
  const staff: Employee[] = [
    {
      id: "emp-aisha",
      name: "Aisha Patel",
      jobTitle: "Director",
      maxHoursPerDay: 8,
      maxHoursPerWeek: 40,
      employmentStatus: "active",
      leaderQualified: true,
      medicallyDelegated: true,
      cprCurrent: true
    },
    {
      id: "emp-rae",
      name: "Rae Morales",
      jobTitle: "Lead Teacher",
      maxHoursPerDay: 8,
      maxHoursPerWeek: 38,
      employmentStatus: "active",
      leaderQualified: true,
      medicallyDelegated: true,
      cprCurrent: true
    }
  ];

  const assignments: StaffAssignment[] = [
    {
      id: "assign-1",
      segmentBlockId: "segment-mon-open",
      employeeId: "emp-aisha",
      assignmentSource: "manual_adjustment",
      startTime: "07:00",
      endTime: "11:00",
      status: "active"
    },
    {
      id: "assign-2",
      segmentBlockId: "segment-mon-mid",
      employeeId: "emp-aisha",
      assignmentSource: "manual_adjustment",
      startTime: "12:00",
      endTime: "16:00",
      status: "active"
    },
    {
      id: "assign-3",
      segmentBlockId: "segment-wed-mid",
      employeeId: "emp-rae",
      assignmentSource: "manual_adjustment",
      startTime: "09:00",
      endTime: "13:00",
      status: "active"
    }
  ];

  it("aggregates non-contiguous assignments into a total hours summary", () => {
    render(<StaffPalette staff={staff} assignments={assignments} />);

    expect(screen.getByText("8.0 hrs")).toBeVisible();
    expect(screen.getByText("4.0 hrs")).toBeVisible();
  });

  it("auto-selects the first staff and reacts to manual selection", () => {
    const onSelect = jest.fn();
    render(<StaffPalette staff={staff} assignments={assignments} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Auto-select" }));
    expect(onSelect).toHaveBeenCalledWith("emp-aisha");

    onSelect.mockClear();
    const raeButton = screen.getByText("Rae Morales").closest("button");
    expect(raeButton).toBeTruthy();
    fireEvent.click(raeButton!);
    expect(onSelect).toHaveBeenCalledWith("emp-rae");
  });
});
