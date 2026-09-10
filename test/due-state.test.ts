import { describe, expect, it } from "vitest";
import {
  classifyDueState,
  describeDueState,
  describeNextDue,
} from "@/lib/domain/due-state";

const base = {
  dueSoonDays: 7,
  paused: false,
  deferredUntil: null,
  today: "2026-09-10",
};

describe("classifyDueState", () => {
  it("paused beats everything", () => {
    expect(
      classifyDueState({ ...base, paused: true, nextDueOn: "2020-01-01" }),
    ).toEqual({ kind: "PAUSED" });
  });

  it("an active deferral hides overdue-ness", () => {
    expect(
      classifyDueState({
        ...base,
        deferredUntil: "2026-09-20",
        nextDueOn: "2026-09-01",
      }),
    ).toEqual({ kind: "DEFERRED", until: "2026-09-20" });
  });

  it("an expired deferral is ignored", () => {
    expect(
      classifyDueState({
        ...base,
        deferredUntil: "2026-09-10",
        nextDueOn: "2026-09-01",
      }).kind,
    ).toBe("OVERDUE");
  });

  it("no date means whenever", () => {
    expect(classifyDueState({ ...base, nextDueOn: null })).toEqual({
      kind: "ANYTIME",
    });
  });

  it.each([
    ["2026-09-07", "OVERDUE"],
    ["2026-09-09", "OVERDUE"],
    ["2026-09-10", "DUE"],
    ["2026-09-11", "DUE_SOON"],
    ["2026-09-17", "DUE_SOON"],
    ["2026-09-18", "NOT_DUE"],
  ])("due %s on 10 Sep → %s", (dueOn, kind) => {
    expect(classifyDueState({ ...base, nextDueOn: dueOn }).kind).toBe(kind);
  });

  it("counts overdue days", () => {
    expect(classifyDueState({ ...base, nextDueOn: "2026-09-07" })).toEqual({
      kind: "OVERDUE",
      dueOn: "2026-09-07",
      daysOverdue: 3,
    });
  });
});

describe("descriptions", () => {
  it("uses calm, plain wording", () => {
    expect(
      describeDueState(classifyDueState({ ...base, nextDueOn: "2026-09-07" })),
    ).toBe("3 days overdue");
    expect(
      describeDueState(classifyDueState({ ...base, nextDueOn: "2026-09-09" })),
    ).toBe("1 day overdue");
    expect(
      describeDueState(classifyDueState({ ...base, nextDueOn: "2026-09-10" })),
    ).toBe("Due today");
    expect(
      describeDueState(classifyDueState({ ...base, nextDueOn: "2026-09-11" })),
    ).toBe("Due tomorrow");
    expect(
      describeDueState(classifyDueState({ ...base, nextDueOn: "2026-09-13" })),
    ).toBe("Due in 3 days");
    expect(
      describeDueState(classifyDueState({ ...base, nextDueOn: "2026-10-22" })),
    ).toBe("Due Thu 22 Oct");
  });

  it("gives the long form for detail views", () => {
    expect(
      describeNextDue(
        classifyDueState({ ...base, nextDueOn: "2026-10-22" }),
        base.today,
      ),
    ).toBe("Next due Thursday 22 October");
    expect(
      describeNextDue(
        classifyDueState({ ...base, nextDueOn: "2027-01-05" }),
        base.today,
      ),
    ).toBe("Next due Tuesday 5 January 2027");
  });
});
