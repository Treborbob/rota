import { describe, expect, it } from "vitest";
import {
  describeDurations,
  effectiveMinutes,
  elapsedMinutes,
  summariseDurations,
} from "@/lib/domain/duration";

describe("summariseDurations", () => {
  it("returns null with nothing to go on", () => {
    expect(summariseDurations([])).toBeNull();
    expect(summariseDurations([0, -5, Number.NaN])).toBeNull();
  });

  it("uses the median so one bad night doesn't skew it", () => {
    expect(summariseDurations([20, 25, 30, 120])).toEqual({
      count: 4,
      min: 20,
      max: 120,
      typical: 28, // (25 + 30) / 2 = 27.5, rounded
    });
    expect(summariseDurations([30, 30, 60])?.typical).toBe(30);
  });
});

describe("effectiveMinutes", () => {
  it("sticks with the estimate until there are enough samples", () => {
    expect(effectiveMinutes(20, [40, 45])).toEqual({
      minutes: 20,
      learned: false,
    });
  });

  it("switches to the typical figure once there are", () => {
    expect(effectiveMinutes(20, [40, 45, 50])).toEqual({
      minutes: 45,
      learned: true,
    });
  });
});

describe("describeDurations", () => {
  it("reads naturally", () => {
    expect(describeDurations({ count: 4, min: 25, max: 35, typical: 30 })).toBe(
      "Actually 25–35 min, typically 30",
    );
    expect(describeDurations({ count: 1, min: 30, max: 30, typical: 30 })).toBe(
      "Actually 30 min, 1 time",
    );
  });
});

describe("elapsedMinutes", () => {
  it("rounds to whole minutes and never reports zero", () => {
    const start = new Date("2026-09-15T19:00:00Z");
    expect(elapsedMinutes(start, new Date("2026-09-15T19:00:20Z"))).toBe(1);
    expect(elapsedMinutes(start, new Date("2026-09-15T19:12:40Z"))).toBe(13);
  });
});
