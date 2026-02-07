import { calculateDurationHours, getCitationId, parseTimeToMinutes } from "@core/rules/utils";
import type { RulesContext } from "@core/rules/types";

describe("rules/utils", () => {
  describe("parseTimeToMinutes", () => {
    it("returns the minute offset for a well-formed time and rounds seconds", () => {
      expect(parseTimeToMinutes("08:30:00")).toBe(510);
      expect(parseTimeToMinutes("23:59:59")).toBe(1440);
    });

    it("parses 12-hour clock values with meridiem", () => {
      expect(parseTimeToMinutes("7:00 AM")).toBe(420);
      expect(parseTimeToMinutes("06:30PM")).toBe(1110);
      expect(parseTimeToMinutes("12:00 AM")).toBe(0);
      expect(parseTimeToMinutes("12:00 PM")).toBe(720);
    });

    it("returns 0 for malformed or empty times", () => {
      expect(parseTimeToMinutes("bad:input")).toBe(0);
      expect(parseTimeToMinutes("")).toBe(0);
      expect(parseTimeToMinutes("13:00 PM")).toBe(0);
    });
  });

  describe("calculateDurationHours", () => {
    it("returns the difference in hours for a same-day interval", () => {
      expect(calculateDurationHours("08:00", "12:00")).toBe(4);
    });

    it("wraps around midnight when the end time is earlier than the start time", () => {
      expect(calculateDurationHours("22:00", "02:00")).toBe(4);
    });

    it("returns 0 when parsed times are invalid", () => {
      expect(calculateDurationHours("bad", "input")).toBe(0);
    });
  });

  describe("getCitationId", () => {
    const sampleContext: RulesContext = {
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [],
      fieldTripTypes: [],
      scheduleDays: [],
      rulePolicyCitations: {
        "shift-break-limits": "policy-shift-override"
      },
      operatingHours: []
    };

    it("returns the override citation when available", () => {
      expect(getCitationId(sampleContext, "shift-break-limits", "policy-default")).toBe(
        "policy-shift-override"
      );
    });

    it("falls back to the provided citation when no override exists", () => {
      expect(getCitationId(sampleContext, "ratio-segment", "policy-default")).toBe("policy-default");
    });
  });
});
