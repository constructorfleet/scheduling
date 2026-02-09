import { buildLegacyWeekId, buildWeekId } from "../../apps/ui/data/scheduleUtils";

describe("scheduleUtils", () => {
  it("builds school-scoped week ids", () => {
    expect(buildWeekId("school-evergreen", "2026-02-15")).toBe("week-school-evergreen-2026-02-15");
  });

  it("builds legacy week ids", () => {
    expect(buildLegacyWeekId("2026-02-15")).toBe("week-2026-02-15");
  });
});
