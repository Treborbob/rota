import { describe, expect, it } from "vitest";
import { addDaysLocal } from "@/lib/dates";
import {
  type PlannerBucket,
  type PlannerInput,
  type PlannerTask,
  planWeek,
  selectCandidates,
  urgencyScore,
} from "@/lib/domain/planner";
import { PLANNER_WEIGHTS } from "@/lib/domain/planner-config";

const ROB = { id: "rob", name: "Rob" };
const HANNAH = { id: "hannah", name: "Hannah" };
const WEEK = "2026-09-07"; // Monday
const DAYS = Array.from({ length: 7 }, (_, i) => addDaysLocal(WEEK, i));
const [MON, TUE, WED, THU, FRI, SAT, SUN] = DAYS;

/** Default budgets: 30/30/30/20/0/0/0 for both, optionally overridden. */
function buckets(
  overrides: Partial<Record<string, Partial<Record<string, number>>>> = {},
): PlannerBucket[] {
  const base = [30, 30, 30, 20, 0, 0, 0];
  const out: PlannerBucket[] = [];
  for (const member of [ROB, HANNAH]) {
    DAYS.forEach((date, i) => {
      const minutes = overrides[member.id]?.[date] ?? base[i];
      out.push({ userId: member.id, date, minutes });
    });
  }
  return out;
}

function task(partial: Partial<PlannerTask> & { id: string }): PlannerTask {
  return {
    name: partial.id,
    estimatedMinutes: 15,
    priority: "NORMAL",
    unpleasant: false,
    assignmentMode: "BALANCED",
    fixedAssigneeId: null,
    nextDueOn: WED,
    dueSoonDays: 7,
    preferredWeekday: null,
    allowedWeekdays: [],
    deferredUntil: null,
    lastCompletedById: null,
    ...partial,
  };
}

function input(partial: Partial<PlannerInput>): PlannerInput {
  return {
    weekStart: WEEK,
    today: MON,
    members: [ROB, HANNAH],
    buckets: buckets(),
    tasks: [],
    pinnedTaskIds: [],
    recentMinutes: {},
    preserved: [],
    ...partial,
  };
}

const byTask = (out: ReturnType<typeof planWeek>) =>
  Object.fromEntries(out.placements.map((p) => [p.taskId, p]));

describe("urgencyScore", () => {
  it("follows the documented formula", () => {
    const t = task({ id: "t", priority: "HIGH", nextDueOn: "2026-09-05" });
    // HIGH 600 + 2 days overdue * 20 + (7 - (-2)) * 5 = 600 + 40 + 45
    expect(urgencyScore(t, MON, false)).toBe(685);
    expect(urgencyScore(t, MON, true)).toBe(685 + PLANNER_WEIGHTS.manualPin);
  });

  it("ignores dates for undated tasks", () => {
    expect(urgencyScore(task({ id: "t", nextDueOn: null }), MON, false)).toBe(
      300,
    );
  });
});

describe("selectCandidates", () => {
  it("takes overdue and due-this-week; never pulls later work forward", () => {
    const tasks = [
      task({ id: "overdue", nextDueOn: "2026-09-01" }),
      task({ id: "thisweek", nextDueOn: SUN }),
      task({ id: "soon", nextDueOn: "2026-09-16", dueSoonDays: 7 }),
      task({ id: "later", nextDueOn: "2026-09-30" }),
      task({ id: "whenever", nextDueOn: null }),
      task({ id: "deferred", nextDueOn: MON, deferredUntil: "2026-09-20" }),
    ];
    const candidates = selectCandidates(
      { tasks, weekStart: WEEK, today: MON, pinnedTaskIds: [] },
      PLANNER_WEIGHTS,
    );
    expect(candidates.map((c) => c.task.id)).toEqual(["overdue", "thisweek"]);
    expect(candidates.map((c) => c.code)).toEqual(["OVERDUE", "DUE_THIS_WEEK"]);
  });

  it("pins beat everything, even a deferral", () => {
    const tasks = [
      task({ id: "big", priority: "ESSENTIAL", nextDueOn: "2026-08-01" }),
      task({
        id: "pinned",
        nextDueOn: "2026-12-01",
        deferredUntil: "2026-11-01",
      }),
    ];
    const candidates = selectCandidates(
      { tasks, weekStart: WEEK, today: MON, pinnedTaskIds: ["pinned"] },
      PLANNER_WEIGHTS,
    );
    expect(candidates[0].task.id).toBe("pinned");
    expect(candidates[0].code).toBe("PINNED");
  });

  it("breaks ties deterministically: due date, then minutes desc, then id", () => {
    const tasks = [
      task({ id: "b", nextDueOn: WED, estimatedMinutes: 10 }),
      task({ id: "a", nextDueOn: WED, estimatedMinutes: 10 }),
      task({ id: "c", nextDueOn: WED, estimatedMinutes: 20 }),
      task({ id: "d", nextDueOn: TUE, estimatedMinutes: 5 }),
    ];
    // All NORMAL; d is due sooner so it scores higher (dueSoon weight).
    const candidates = selectCandidates(
      { tasks, weekStart: WEEK, today: MON, pinnedTaskIds: [] },
      PLANNER_WEIGHTS,
    );
    expect(candidates.map((c) => c.task.id)).toEqual(["d", "c", "a", "b"]);
  });
});

describe("planWeek", () => {
  it("Scenario B: a Saturday-due task waits for next week rather than going early", () => {
    const out = planWeek(
      input({ tasks: [task({ id: "sat", nextDueOn: SAT })] }),
    );
    expect(out.placements).toEqual([]);
    expect(out.unscheduled).toEqual([
      {
        taskId: "sat",
        score: expect.any(Number),
        code: "DUE_AFTER_LAST_EVENING",
      },
    ]);
  });

  it("Scenario B (cont.): next week it is overdue and lands on the first evening", () => {
    const nextWeek = addDaysLocal(WEEK, 7);
    const out = planWeek(
      input({
        weekStart: nextWeek,
        today: nextWeek,
        buckets: buckets().map((b) => ({
          ...b,
          date: addDaysLocal(b.date, 7),
        })),
        tasks: [task({ id: "sat", nextDueOn: SAT })],
      }),
    );
    expect(out.placements[0]).toMatchObject({
      taskId: "sat",
      date: nextWeek,
      code: "OVERDUE",
    });
  });

  it("goes on the due day even when an earlier evening is emptier (no ratchet)", () => {
    const out = planWeek(
      input({
        buckets: buckets({ rob: { [MON]: 120 }, hannah: { [MON]: 120 } }),
        tasks: [task({ id: "t", nextDueOn: WED })],
      }),
    );
    expect(out.placements[0].date).toBe(WED);
  });

  it("a full due day pushes the task later, never earlier", () => {
    const out = planWeek(
      input({
        buckets: buckets({ rob: { [WED]: 0 }, hannah: { [WED]: 0 } }),
        tasks: [task({ id: "t", nextDueOn: WED })],
      }),
    );
    expect(out.placements[0].date).toBe(THU);
  });

  it("a task added by hand may go anywhere in the week", () => {
    const out = planWeek(
      input({
        pinnedTaskIds: ["far"],
        tasks: [task({ id: "far", nextDueOn: "2026-12-01" })],
      }),
    );
    expect(out.placements[0]).toMatchObject({
      taskId: "far",
      date: MON,
      code: "PINNED",
    });
  });

  it("Scenario B (cont.): giving Saturday minutes allows Saturday placement", () => {
    const out = planWeek(
      input({
        buckets: buckets({ rob: { [SAT]: 60 } }),
        tasks: [task({ id: "mow", nextDueOn: SAT, allowedWeekdays: [6] })],
      }),
    );
    expect(out.placements[0]).toMatchObject({
      taskId: "mow",
      userId: "rob",
      date: SAT,
    });
  });

  it("never places anything on a zero-capacity day", () => {
    const out = planWeek(
      input({
        tasks: Array.from({ length: 12 }, (_, i) =>
          task({ id: `t${i}`, estimatedMinutes: 20 }),
        ),
      }),
    );
    for (const p of out.placements) {
      expect([FRI, SAT, SUN]).not.toContain(p.date);
    }
    expect(out.unscheduled.length).toBeGreaterThan(0);
  });

  it("Scenario C: balances by minutes, not task count", () => {
    const out = planWeek(
      input({
        buckets: buckets({
          rob: { [TUE]: 0, [WED]: 0, [THU]: 0 },
          hannah: { [TUE]: 0, [WED]: 0, [THU]: 0 },
        }),
        tasks: [
          task({ id: "big", estimatedMinutes: 30, nextDueOn: MON }),
          task({ id: "s1", estimatedMinutes: 15, nextDueOn: MON }),
          task({ id: "s2", estimatedMinutes: 15, nextDueOn: MON }),
        ],
      }),
    );
    const p = byTask(out);
    expect(out.unscheduled).toEqual([]);
    // 30 to one person, 15 + 15 to the other.
    expect(p.s1.userId).toBe(p.s2.userId);
    expect(p.big.userId).not.toBe(p.s1.userId);
  });

  it("respects FIXED and ALTERNATE", () => {
    const out = planWeek(
      input({
        tasks: [
          task({
            id: "laundry",
            assignmentMode: "FIXED",
            fixedAssigneeId: "hannah",
          }),
          task({
            id: "bins",
            assignmentMode: "ALTERNATE",
            lastCompletedById: "rob",
          }),
          task({
            id: "bins2",
            assignmentMode: "ALTERNATE",
            lastCompletedById: "hannah",
          }),
        ],
      }),
    );
    const p = byTask(out);
    expect(p.laundry.userId).toBe("hannah");
    expect(p.bins.userId).toBe("hannah");
    expect(p.bins2.userId).toBe("rob");
  });

  it("Scenario D: an unavailable evening gets nothing", () => {
    const out = planWeek(
      input({
        buckets: buckets({ hannah: { [TUE]: 0 } }),
        tasks: Array.from({ length: 8 }, (_, i) =>
          task({ id: `t${i}`, estimatedMinutes: 15 }),
        ),
      }),
    );
    expect(
      out.placements.some((p) => p.userId === "hannah" && p.date === TUE),
    ).toBe(false);
  });

  it("uses recent history as a light thumb on the scale", () => {
    const out = planWeek(
      input({
        recentMinutes: { rob: 400, hannah: 0 }, // Rob did a lot lately
        tasks: [task({ id: "t", nextDueOn: MON })],
      }),
    );
    expect(out.placements[0].userId).toBe("hannah");
  });

  describe("preferred weekday", () => {
    const LAST_THU = addDaysLocal(WEEK, -4);
    it.each([
      {
        name: "wins over the due day when it comes after it",
        preferredWeekday: 3,
        nextDueOn: MON,
        pinned: false,
        expected: WED,
      },
      {
        name: "never pulls a task before its due date (weekly job done Saturday)",
        preferredWeekday: 1,
        nextDueOn: THU,
        pinned: false,
        expected: THU,
      },
      {
        name: "is ignored when it has passed, leaving the due day",
        preferredWeekday: 2,
        nextDueOn: WED,
        pinned: false,
        expected: WED,
      },
      {
        name: "applies to overdue work from today",
        preferredWeekday: 2,
        nextDueOn: LAST_THU,
        pinned: false,
        expected: TUE,
      },
      {
        name: "applies anywhere in the week to a task added by hand",
        preferredWeekday: 3,
        nextDueOn: "2026-12-01",
        pinned: true,
        expected: WED,
      },
      {
        name: "does not place a task due after the last evening",
        preferredWeekday: 3,
        nextDueOn: SUN,
        pinned: false,
        expected: null,
      },
    ])("$name", ({ preferredWeekday, nextDueOn, pinned, expected }) => {
      const out = planWeek(
        input({
          pinnedTaskIds: pinned ? ["t"] : [],
          tasks: [task({ id: "t", preferredWeekday, nextDueOn })],
        }),
      );
      expect(out.placements[0]?.date ?? null).toBe(expected);
    });
  });

  it("places on the due date, not before it", () => {
    const out = planWeek(input({ tasks: [task({ id: "t", nextDueOn: TUE })] }));
    expect(out.placements[0].date).toBe(TUE);
  });

  it("splits two heavy jobs due the same night between people", () => {
    const out = planWeek(
      input({
        buckets: buckets({ rob: { [MON]: 60 }, hannah: { [MON]: 60 } }),
        tasks: [
          task({ id: "h1", estimatedMinutes: 30, nextDueOn: MON }),
          task({ id: "h2", estimatedMinutes: 30, nextDueOn: MON }),
        ],
      }),
    );
    const p = byTask(out);
    expect(p.h1.date).toBe(MON);
    expect(p.h2.date).toBe(MON);
    expect(p.h1.userId).not.toBe(p.h2.userId);
  });

  it("but being on time beats spreading heavy work", () => {
    const out = planWeek(
      input({
        buckets: buckets({
          rob: { [MON]: 60 },
          hannah: { [MON]: 0, [TUE]: 0, [WED]: 0, [THU]: 0 },
        }),
        tasks: [
          task({ id: "h1", estimatedMinutes: 30, nextDueOn: MON }),
          task({ id: "h2", estimatedMinutes: 30, nextDueOn: MON }),
        ],
      }),
    );
    expect(out.placements.map((p) => p.date)).toEqual([MON, MON]);
  });

  it("Scenario I: overflow is explained, lower priority first", () => {
    const out = planWeek(
      input({
        buckets: buckets({
          rob: { [TUE]: 0, [WED]: 0, [THU]: 0 },
          hannah: { [TUE]: 0, [WED]: 0, [THU]: 0 },
        }),
        tasks: [
          task({
            id: "high",
            priority: "HIGH",
            estimatedMinutes: 30,
            nextDueOn: MON,
          }),
          task({
            id: "normal",
            priority: "NORMAL",
            estimatedMinutes: 30,
            nextDueOn: MON,
          }),
          task({
            id: "low",
            priority: "LOW",
            estimatedMinutes: 30,
            nextDueOn: MON,
          }),
        ],
      }),
    );
    expect(out.placements.map((p) => p.taskId).sort()).toEqual([
      "high",
      "normal",
    ]);
    expect(out.unscheduled).toEqual([
      { taskId: "low", score: expect.any(Number), code: "NO_CAPACITY" },
    ]);
  });

  it("explains a fixed assignee with no time at all", () => {
    const out = planWeek(
      input({
        buckets: buckets({
          hannah: { [MON]: 0, [TUE]: 0, [WED]: 0, [THU]: 0 },
        }),
        tasks: [
          task({
            id: "laundry",
            assignmentMode: "FIXED",
            fixedAssigneeId: "hannah",
          }),
        ],
      }),
    );
    expect(out.unscheduled[0].code).toBe("ASSIGNEE_UNAVAILABLE");
  });

  it("explains a task longer than any evening", () => {
    const out = planWeek(
      input({ tasks: [task({ id: "huge", estimatedMinutes: 45 })] }),
    );
    expect(out.unscheduled[0].code).toBe("TOO_LONG_FOR_ANY_SLOT");
  });

  it("explains an allowed-days clash", () => {
    const out = planWeek(
      input({ tasks: [task({ id: "weekend", allowedWeekdays: [6, 7] })] }),
    );
    expect(out.unscheduled[0].code).toBe("NO_ALLOWED_DAY");
  });

  it("squeezes an ESSENTIAL task in over budget rather than dropping it", () => {
    const out = planWeek(
      input({
        buckets: buckets({
          rob: { [TUE]: 0, [WED]: 0, [THU]: 0 },
          hannah: { [MON]: 0, [TUE]: 0, [WED]: 0, [THU]: 0 },
        }),
        preserved: [
          {
            taskId: "fill",
            userId: "rob",
            date: MON,
            minutes: 30,
            heavy: true,
          },
        ],
        tasks: [
          task({
            id: "nice",
            estimatedMinutes: 20,
            priority: "HIGH",
            nextDueOn: MON,
          }),
          task({
            id: "must",
            estimatedMinutes: 20,
            priority: "ESSENTIAL",
            nextDueOn: MON,
          }),
        ],
      }),
    );
    const p = byTask(out);
    expect(p.must).toMatchObject({
      userId: "rob",
      date: MON,
      code: "ESSENTIAL_OVERFLOW",
    });
    expect(out.unscheduled).toEqual([
      { taskId: "nice", score: expect.any(Number), code: "NO_CAPACITY" },
    ]);
  });

  it("leaves work due after the week alone, however much time is spare", () => {
    // A fortnightly hob clean done on Saturday is due two weeks later. With
    // an empty week it must still wait: the cadence is deliberate.
    const soon = task({
      id: "soon",
      nextDueOn: addDaysLocal(SUN, 1),
      dueSoonDays: 7,
      estimatedMinutes: 25,
    });
    const out = planWeek(input({ tasks: [soon] }));
    expect(out.placements).toEqual([]);
    expect(out.unscheduled).toEqual([]);
    expect(out.snapshot.candidateCount).toBe(0);
  });

  it("plans around preserved work and never re-places it", () => {
    const out = planWeek(
      input({
        preserved: [
          {
            taskId: "done",
            userId: "rob",
            date: MON,
            minutes: 30,
            heavy: true,
          },
        ],
        tasks: [
          task({ id: "done" }),
          task({ id: "new", estimatedMinutes: 30, nextDueOn: MON }),
        ],
      }),
    );
    expect(out.placements.map((p) => p.taskId)).toEqual(["new"]);
    // Rob's Monday is full, so "new" goes to Hannah on Monday.
    expect(out.placements[0]).toMatchObject({ userId: "hannah", date: MON });
  });

  it("carried-over work sits on top of the budget, not inside it", () => {
    // Rob missed a 30-minute job on Monday; it now sits on his Tuesday.
    // Tuesday's own 30 minutes must still be his to fill.
    const out = planWeek(
      input({
        today: TUE,
        preserved: [
          {
            taskId: "missed",
            userId: "rob",
            date: TUE,
            minutes: 30,
            heavy: true,
            carried: true,
          },
        ],
        tasks: [
          task({ id: "missed" }),
          task({
            id: "tonight",
            estimatedMinutes: 30,
            nextDueOn: TUE,
            assignmentMode: "FIXED",
            fixedAssigneeId: "rob",
          }),
        ],
      }),
    );
    expect(out.placements).toHaveLength(1);
    expect(out.placements[0]).toMatchObject({
      taskId: "tonight",
      userId: "rob",
      date: TUE,
    });
  });

  it("never places before today when generating mid-week", () => {
    const out = planWeek(
      input({
        today: WED,
        tasks: [
          task({ id: "a", nextDueOn: MON }),
          task({ id: "b", nextDueOn: TUE }),
        ],
      }),
    );
    for (const p of out.placements) expect(p.date >= WED).toBe(true);
    expect(out.placements.every((p) => p.code === "OVERDUE")).toBe(true);
  });

  it("is deterministic", () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      task({
        id: `t${i}`,
        estimatedMinutes: 5 + (i % 4) * 5,
        priority: i % 3 === 0 ? "HIGH" : "NORMAL",
      }),
    );
    const a = planWeek(input({ tasks }));
    const b = planWeek(input({ tasks: [...tasks].reverse() }));
    expect(a.placements).toEqual(b.placements);
    expect(a.unscheduled).toEqual(b.unscheduled);
  });
});
