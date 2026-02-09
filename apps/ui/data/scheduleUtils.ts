export const buildWeekId = (schoolId: string, weekStartIso: string) =>
  `week-${schoolId}-${weekStartIso}`;

export const buildLegacyWeekId = (weekStartIso: string) => `week-${weekStartIso}`;
