import { fetchEmployeeScheduleView } from "../../apps/ui/data/apiClient";

const originalFetch = global.fetch;

describe("fetchEmployeeScheduleView", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("requests the employee schedule view endpoint", async () => {
    const payload = {
      weekId: "week-1",
      scheduleDays: [
        {
          id: "day-1",
          dayOfWeek: "mon",
          date: "2026-02-02",
          scheduleType: null,
          dayScheduleType: "full_day"
        }
      ],
      segmentBlocks: [],
      staffAssignments: [],
      employees: []
    };
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    });
    global.fetch = fetchSpy;

    const result = await fetchEmployeeScheduleView("week-1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/schedule/week-1/employee-view",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "content-type": "application/json"
        })
      })
    );
    expect(result).toEqual(payload);
  });

  it("returns null when the schedule week is missing", async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Schedule week week-404 not found" })
    });
    global.fetch = fetchSpy;

    const result = await fetchEmployeeScheduleView("week-404");

    expect(result).toBeNull();
  });
});
