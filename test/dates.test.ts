import { describe, expect, it } from "vitest";
import {
  daysBetween,
  fromDbDate,
  isoWeekday,
  startOfLocalDay,
  startOfWeekLocal,
  toDbDate,
  toLocalDate,
} from "@/lib/dates";

describe("local dates in Europe/London", () => {
  it("converts instants across GMT and BST", () => {
    // 23:30 UTC in summer is 00:30 the next day in London.
    expect(toLocalDate(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    // In winter, 23:30 UTC is still the same day.
    expect(toLocalDate(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-01");
  });

  it("finds local midnight either side of the DST switch", () => {
    // BST starts 29 Mar 2026 at 01:00 UTC.
    expect(startOfLocalDay("2026-03-28").toISOString()).toBe(
      "2026-03-28T00:00:00.000Z",
    );
    expect(startOfLocalDay("2026-03-30").toISOString()).toBe(
      "2026-03-29T23:00:00.000Z",
    );
    // BST ends 25 Oct 2026.
    expect(startOfLocalDay("2026-10-26").toISOString()).toBe(
      "2026-10-26T00:00:00.000Z",
    );
  });

  it("round-trips @db.Date columns without drifting a day", () => {
    const db = toDbDate("2026-09-10");
    expect(db.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(fromDbDate(db)).toBe("2026-09-10");
    expect(fromDbDate(null)).toBeNull();
  });

  it("knows its weekdays", () => {
    expect(isoWeekday("2026-09-07")).toBe(1); // Monday
    expect(isoWeekday("2026-09-13")).toBe(7); // Sunday
    expect(startOfWeekLocal("2026-09-10")).toBe("2026-09-07");
    expect(startOfWeekLocal("2026-09-13")).toBe("2026-09-07");
    expect(startOfWeekLocal("2026-09-07")).toBe("2026-09-07");
  });

  it("counts days across a DST weekend as calendar days", () => {
    expect(daysBetween("2026-03-27", "2026-03-30")).toBe(3);
    expect(daysBetween("2026-10-23", "2026-10-26")).toBe(3);
  });
});
