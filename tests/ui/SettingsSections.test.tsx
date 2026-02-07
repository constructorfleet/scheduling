import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FieldTripsSection from "../../apps/ui/components/settings/FieldTripsSection";
import JobTitlesSection from "../../apps/ui/components/settings/JobTitlesSection";
import ScheduleTypesSection from "../../apps/ui/components/settings/ScheduleTypesSection";
import SchoolSettingsSection from "../../apps/ui/components/settings/SchoolSettingsSection";
import OperatingHoursSection from "../../apps/ui/components/settings/OperatingHoursSection";
import EmployeesSection from "../../apps/ui/components/settings/EmployeesSection";
import type { Employee, FieldTripType } from "@core/domain/types";
import type { ScheduleTypeOption } from "../../apps/ui/components/DayMetadataStrip";
import type { JobTitleSetting, OperatingHoursConfig, SchoolRules } from "../../apps/ui/components/SettingsPanel";

const ratioToPair = (ratio: number) => {
  if (!Number.isFinite(ratio)) {
    return { adults: 1, students: 1 };
  }
  if (ratio === 0) {
    return { adults: 0, students: 0 };
  }
  if (ratio < 0) {
    return { adults: 1, students: 1 };
  }
  if (ratio >= 1) {
    return { adults: Math.max(1, Math.round(ratio)), students: 1 };
  }
  return { adults: 1, students: Math.max(1, Math.round(1 / ratio)) };
};

describe("Settings section components", () => {
  it("updates schedule type ratios and labels", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const scheduleTypes: ScheduleTypeOption[] = [
      { value: "regular", label: "Regular day", ratio: { adults: 1, students: 12 }, description: "Base" }
    ];

    render(
      <ScheduleTypesSection
        draftScheduleTypes={scheduleTypes}
        onChange={onChange}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onSave={jest.fn()}
        canSave={true}
      />
    );

    const labelInput = screen.getByPlaceholderText("Label");
    await act(async () => {
      await user.clear(labelInput);
      await user.type(labelInput, "Regular");
    });
    expect(onChange).toHaveBeenCalled();

    const ratioInputs = screen.getAllByPlaceholderText("A");
    await act(async () => {
      await user.clear(ratioInputs[0]);
      await user.type(ratioInputs[0], "2");
    });
    expect(onChange).toHaveBeenCalled();
  });

  it("updates field trip ratios and removes entries", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onRemove = jest.fn();
    const fieldTrips: FieldTripType[] = [
      {
        id: "trip-1",
        name: "Zoo Visit",
        minAdultStudentRatio: 1 / 8,
        minLeaderStudentRatio: 1 / 25,
        policyCitationId: "policy"
      }
    ];

    render(
      <FieldTripsSection
        draftFieldTrips={fieldTrips}
        onChange={onChange}
        onAdd={jest.fn()}
        onRemove={onRemove}
        onSave={jest.fn()}
        canSave={true}
        ratioToPair={ratioToPair}
      />
    );

    const adultInputs = screen.getAllByPlaceholderText("A");
    await act(async () => {
      await user.clear(adultInputs[0]);
      await user.type(adultInputs[0], "2");
    });
    expect(onChange).toHaveBeenCalled();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Remove" }));
    });
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it("displays explanation text for 0:0 leader ratio behavior", () => {
    const fieldTrips: FieldTripType[] = [
      {
        id: "trip-1",
        name: "Zoo Visit",
        minAdultStudentRatio: 1 / 8,
        minLeaderStudentRatio: 1 / 25,
        policyCitationId: "policy"
      }
    ];

    render(
      <FieldTripsSection
        draftFieldTrips={fieldTrips}
        onChange={jest.fn()}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onSave={jest.fn()}
        canSave={true}
        ratioToPair={ratioToPair}
      />
    );

    expect(screen.getByText(/If the leader ratio is set to 0:0/i)).toBeInTheDocument();
    expect(screen.getByText(/it will be ignored and only the adult ratio will be enforced/i)).toBeInTheDocument();
  });

  it("displays 0:0 for disabled field trip ratios", () => {
    const fieldTrips: FieldTripType[] = [
      {
        id: "trip-1",
        name: "Zoo Visit",
        minAdultStudentRatio: 1 / 10,
        minLeaderStudentRatio: 0,
        policyCitationId: "policy"
      }
    ];

    render(
      <FieldTripsSection
        draftFieldTrips={fieldTrips}
        onChange={jest.fn()}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onSave={jest.fn()}
        canSave={true}
        ratioToPair={ratioToPair}
      />
    );

    const allInputs = screen.getAllByRole("spinbutton");
    // The inputs are in order: Adult-L, Adult-S, Leader-L, Leader-S
    // When leader ratio is 0, both leader inputs should show 0
    const leaderAdults = allInputs[2];
    const leaderStudents = allInputs[3];
    
    expect(leaderAdults).toHaveValue(0);
    expect(leaderStudents).toHaveValue(0);
  });

  it("edits job titles and toggles flags", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const jobTitles: JobTitleSetting[] = [
      { id: "job-1", title: "Assistant", leaderQualified: false, requiresLeaderForOpenClose: false }
    ];

    render(
      <JobTitlesSection
        draftJobTitles={jobTitles}
        onChange={onChange}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onSave={jest.fn()}
        canSave={true}
      />
    );

    const titleInput = screen.getByPlaceholderText("Job title");
    await act(async () => {
      await user.clear(titleInput);
      await user.type(titleInput, "Support Lead");
    });
    expect(onChange).toHaveBeenCalled();

    const toggles = screen.getAllByRole("checkbox");
    await act(async () => {
      await user.click(toggles[0]);
    });
    expect(onChange).toHaveBeenCalled();
  });

  it("updates school settings, rules, and closed days", async () => {
    const user = userEvent.setup();
    const onSchoolNameChange = jest.fn();
    const onSchoolRulesChange = jest.fn();
    const onClosedDaysChange = jest.fn();
    const rules: SchoolRules = {
      openerCount: 2,
      closerCount: 2,
      minimumMedicalDelegated: 1,
      requireCurrentCpr: false
    };

    render(
      <SchoolSettingsSection
        draftSchoolName="Evergreen"
        draftSchoolRules={rules}
        draftClosedDays={["sat"]}
        allDays={["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}
        onSchoolNameChange={onSchoolNameChange}
        onSchoolRulesChange={onSchoolRulesChange}
        onClosedDaysChange={onClosedDaysChange}
        onSave={jest.fn()}
        canSave={true}
      />
    );

    const nameInput = screen.getByPlaceholderText("School name");
    await act(async () => {
      await user.clear(nameInput);
      await user.type(nameInput, "Evergreen Prep");
    });
    expect(onSchoolNameChange).toHaveBeenCalled();

    const openerInput = screen.getByLabelText("Number of openers");
    await act(async () => {
      await user.clear(openerInput);
      await user.type(openerInput, "3");
    });
    expect(onSchoolRulesChange).toHaveBeenCalled();

    await act(async () => {
      await user.click(screen.getByText("SUN"));
    });
    expect(onClosedDaysChange).toHaveBeenCalled();
  });

  it("prevents selecting closed or already-used operating days", () => {
    const onChange = jest.fn();
    const operatingHours: OperatingHoursConfig[] = [
      {
        id: "hours-1",
        scheduleType: "regular",
        daysOfWeek: ["mon", "tue"],
        open: "07:00",
        close: "17:00"
      },
      {
        id: "hours-2",
        scheduleType: "regular",
        daysOfWeek: ["wed"],
        open: "08:00",
        close: "18:00"
      }
    ];
    const scheduleTypes: ScheduleTypeOption[] = [
      { value: "regular", label: "Regular", ratio: { adults: 1, students: 10 }, description: "Base" }
    ];

    render(
      <OperatingHoursSection
        draftOperatingHours={operatingHours}
        draftScheduleTypes={scheduleTypes}
        draftClosedDays={["fri"]}
        allDays={["mon", "tue", "wed", "thu", "fri"]}
        operatingHoursOverlap={[]}
        onChange={onChange}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onSave={jest.fn()}
        canSave={true}
      />
    );

    const friCheckboxes = screen.getAllByLabelText("FRI") as HTMLInputElement[];
    expect(friCheckboxes[0]).toBeDisabled();

    const monCheckboxes = screen.getAllByLabelText("MON") as HTMLInputElement[];
    expect(monCheckboxes[1]).toBeDisabled();
  });

  it("expands employee availability and manages time off ranges", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const employees: Employee[] = [
      {
        id: "emp-1",
        name: "Jordan Lee",
        jobTitle: "Assistant",
        maxHoursPerDay: 8,
        maxHoursPerWeek: 40,
        employmentStatus: "active",
        leaderQualified: false,
        medicallyDelegated: false,
        cprCurrent: true,
        availability: [],
        requestedDaysOff: []
      }
    ];

    render(
      <EmployeesSection
        draftEmployees={employees}
        jobTitleOptions={["Assistant"]}
        onChange={onChange}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onSave={jest.fn()}
        canSave={true}
      />
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Availability" }));
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Add time off" }));
    });
    expect(onChange).toHaveBeenCalled();

    const latestEmployees = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Employee[];
    expect(latestEmployees[0].requestedDaysOff?.length).toBe(1);
    expect(latestEmployees[0].requestedDaysOff?.[0].startDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(latestEmployees[0].requestedDaysOff?.[0].endDate).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
