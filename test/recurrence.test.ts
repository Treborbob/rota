import { describe, expect, it } from "vitest";
import {
  addInterval,
  describeCadence,
  initialDueFromLastDone,
  nextDueAfterCompletion,
  nextDueAfterSkip,
  type Recurrence,
} from "@/lib/domain/recurrence";

const weekly: Recurrence = { value: 1, unit: "WEEK", anchor: "COMPLETION" };
const fourWeekly: Recurrence = { value: 4, unit: "WEEK", anchor: "COMPLETION" };
const monthly: Recurrence = { value: 1, unit: "MONTH", anchor: "COMPLETION" };
const yearly: Recurrence = { value: 1, unit: "YEAR", anchor: "COMPLETION" };

describe("addInterval", () => {
  it.each([
    ["2026-01-01", { value: 3, unit: "DAY" }, "2026-01-04"],
    ["2026-01-29", { value: 1, unit: "WEEK" }, "2026-02-05"],
    ["2026-01-31", { value: 1, unit: "MONTH" }, "2026-02-28"],
    ["2028-01-31", { value: 1, unit: "MONTH" }, "2028-02-29"],
    ["2026-03-31", { value: 1, unit: "MONTH" }, "2026-04-30"],
    ["2026-10-31", { value: 4, unit: "MONTH" }, "2027-02-28"],
    ["2028-02-29", { value: 1, unit: "YEAR" }, "2029-02-28"],
    ["2026-12-31", { value: 1, unit: "DAY" }, "2027-01-01"],
    // DST weekends are just calendar days here; no 23/25-hour surprises.
    ["2026-03-28", { value: 2, unit: "DAY" }, "2026-03-30"],
    ["2026-10-24", { value: 1, unit: "WEEK" }, "2026-10-31"],
  ] as const)("%s + %o = %s", (from, rec, expected) => {
    expect(addInterval(from, rec)).toBe(expected);
  });
});

describe("nextDueAfterCompletion — COMPLETION anchor", () => {
  it("advances from the actual completion, not the old due date", () => {
    // Scenario E: four-week task due 1 Mar, done five days late on 6 Mar.
    expect(
      nextDueAfterCompletion({
        recurrence: fourWeekly,
        previousDueOn: "2026-03-01",
        completedOn: "2026-03-06",
      }),
    ).toBe("2026-04-03");
  });

  it("clamps month ends", () => {
    expect(
      nextDueAfterCompletion({
        recurrence: monthly,
        previousDueOn: null,
        completedOn: "2026-01-31",
      }),
    ).toBe("2026-02-28");
  });

  it("clamps leap days", () => {
    expect(
      nextDueAfterCompletion({
        recurrence: yearly,
        previousDueOn: "2028-02-29",
        completedOn: "2028-02-29",
      }),
    ).toBe("2029-02-28");
  });

  it("works for early completion too", () => {
    expect(
      nextDueAfterCompletion({
        recurrence: weekly,
        previousDueOn: "2026-05-10",
        completedOn: "2026-05-07",
      }),
    ).toBe("2026-05-14");
  });
});

describe("nextDueAfterCompletion — SCHEDULE anchor", () => {
  const scheduledWeekly: Recurrence = {
    value: 1,
    unit: "WEEK",
    anchor: "SCHEDULE",
  };

  it("keeps the cadence when done late", () => {
    // Due Mon 4 May, done Wed 6 May → next is Mon 11 May, not Wed 13.
    expect(
      nextDueAfterCompletion({
        recurrence: scheduledWeekly,
        previousDueOn: "2026-05-04",
        completedOn: "2026-05-06",
      }),
    ).toBe("2026-05-11");
  });

  it("skips past missed occurrences without stacking them", () => {
    // Due 4 May, done 20 May: 11 and 18 May are gone; next is 25 May.
    expect(
      nextDueAfterCompletion({
        recurrence: scheduledWeekly,
        previousDueOn: "2026-05-04",
        completedOn: "2026-05-20",
      }),
    ).toBe("2026-05-25");
  });

  it("does not produce an occurrence on the completion day itself", () => {
    expect(
      nextDueAfterCompletion({
        recurrence: scheduledWeekly,
        previousDueOn: "2026-05-04",
        completedOn: "2026-05-11",
      }),
    ).toBe("2026-05-18");
  });

  it("keeps the cadence when done early", () => {
    expect(
      nextDueAfterCompletion({
        recurrence: scheduledWeekly,
        previousDueOn: "2026-05-04",
        completedOn: "2026-05-02",
      }),
    ).toBe("2026-05-11");
  });

  it("falls back to the completion anchor with no previous due date", () => {
    expect(
      nextDueAfterCompletion({
        recurrence: scheduledWeekly,
        previousDueOn: null,
        completedOn: "2026-05-06",
      }),
    ).toBe("2026-05-13");
  });
});

describe("skip and initial due", () => {
  it("skip advances once from the current due date", () => {
    expect(
      nextDueAfterSkip({ recurrence: fourWeekly, currentDueOn: "2026-03-01" }),
    ).toBe("2026-03-29");
  });

  it("initial due comes from last done", () => {
    expect(
      initialDueFromLastDone({ recurrence: monthly, lastDoneOn: "2026-08-31" }),
    ).toBe("2026-09-30");
  });
});

describe("describeCadence", () => {
  it.each([
    [{ value: 1, unit: "DAY" }, "Daily"],
    [{ value: 3, unit: "DAY" }, "Every 3 days"],
    [{ value: 1, unit: "WEEK" }, "Every week"],
    [{ value: 6, unit: "WEEK" }, "Every 6 weeks"],
    [{ value: 1, unit: "MONTH" }, "Every month"],
    [{ value: 2, unit: "YEAR" }, "Every 2 years"],
  ] as const)("%o → %s", (rec, expected) => {
    expect(describeCadence(rec)).toBe(expected);
  });
});
