/**
 * Default minutes per ISO weekday, Monday first. Friday to Sunday are zero,
 * which is what keeps the weekend free of routine chores by default.
 * These are seeds; every member edits their own in Settings.
 */
export const DEFAULT_WEEKDAY_CAPACITY: readonly number[] = [
  30, // Mon
  30, // Tue
  30, // Wed
  20, // Thu
  0, // Fri
  0, // Sat
  0, // Sun
];

export const WEEKDAY_LABELS: readonly string[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
