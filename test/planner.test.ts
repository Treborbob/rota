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
  it("takes overdue and due-this-week, pulls forward only within the due-soon window", () => {
    const tasks = [
      task({ id: "overdue", nextDueOn: "2026-09-01" }),
      task({ id: "thisweek", nextDueOn: SUN }),
      task({ id: "soon", nextDueOn: "2026-09-16", dueSoonDays: 7 }),
      task({ id: "later", nextDueOn: "2026-09-30" }),
      task({ id: "whenever", nextDueOn: null }),
      task({ id: "deferred", nextDueOn: MON, deferredUntil: "2026-09-20" }),
    ];
    const { primary, pullForward } = selectCandidates(
      { tasks, weekStart: WEEK, today: MON, pinnedTaskIds: [] },
      PLANNER_WEIGHTS,
    );
    expect(primary.map((c) => c.task.id)).toEqual(["overdue", "thisweek"]);
    expect(primary.map((c) => c.code)).toEqual(["OVERDUE", "DUE_THIS_WEEK"]);
    expect(pullForward.map((c) => c.task.id)).toEqual(["soon"]);
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
    const { primary } = selectCandidates(
      { tasks, weekStart: WEEK, today: MON, pinnedTaskIds: ["pinned"] },
      PLANNER_WEIGHTS,
    );
    expect(primary[0].task.id).toBe("pinned");
    expect(primary[0].code).toBe("PINNED");
  });

  it("breaks ties deterministically: due date, then minutes desc, then id", () => {
    const tasks = [
      task({ id: "b", nextDueOn: WED, estimatedMinutes: 10 }),
      task({ id: "a", nextDueOn: WED, estimatedMinutes: 10 }),
      task({ id: "c", nextDueOn: WED, estimatedMinutes: 20 }),
      task({ id: "d", nextDueOn: TUE, estimatedMinutes: 5 }),
    ];
    // All NORMAL; d is due sooner so it scores higher (dueSoon weight).
    const { primary } = selectCandidates(
      { tasks, weekStart: WEEK, today: MON, pinnedTaskIds: [] },
      PLANNER_WEIGHTS,
    );
    expect(primary.map((c) => c.task.id)).toEqual(["d", "c", "a", "b"]);
  });
});

describe("planWeek", () => {
  it("Scenario B: a Saturday-due task lands Monday–Thursday by default", () => {
    const out = planWeek(
      input({ tasks: [task({ id: "sat", nextDueOn: SAT })] }),
    );
    expect(out.placements).toHaveLength(1);
    expect([MON, TUE, WED, THU]).toContain(out.placements[0].date);
    expect(out.unscheduled).toEqual([]);
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

  it("prefers the preferred weekday when it fits", () => {
    const out = planWeek(
      input({
        tasks: [task({ id: "t", preferredWeekday: 3, nextDueOn: SUN })],
      }),
    );
    expect(out.placements[0].date).toBe(WED);
  });

  it("places on or before the due date when possible", () => {
    const out = planWeek(input({ tasks: [task({ id: "t", nextDueOn: TUE })] }));
    expect([MON, TUE]).toContain(out.placements[0].date);
  });

  it("does not stack two heavy jobs on one person in one night if it can help it", () => {
    const out = planWeek(
      input({
        buckets: buckets({
          rob: { [MON]: 60, [TUE]: 60 },
          hannah: { [MON]: 60, [TUE]: 60 },
        }),
        tasks: [
          task({ id: "h1", estimatedMinutes: 30, nextDueOn: SUN }),
          task({ id: "h2", estimatedMinutes: 30, nextDueOn: SUN }),
          task({ id: "h3", estimatedMinutes: 30, nextDueOn: SUN }),
          task({ id: "h4", estimatedMinutes: 30, nextDueOn: SUN }),
        ],
      }),
    );
    const perNight = out.placements.reduce<Record<string, number>>((acc, p) => {
      const key = `${p.userId}:${p.date}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    // Four heavy jobs, two people, 60 minutes each on Monday and Tuesday:
    // they could all fit on Monday. The spread rule says one heavy per night.
    expect(Math.max(...Object.values(perNight))).toBe(1);
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
          task({ id: "high", priority: "HIGH", estimatedMinutes: 30 }),
          task({ id: "normal", priority: "NORMAL", estimatedMinutes: 30 }),
          task({ id: "low", priority: "LOW", estimatedMinutes: 30 }),
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
            nextDueOn: WED,
          }),
          task({
            id: "must",
            estimatedMinutes: 20,
            priority: "ESSENTIAL",
            nextDueOn: WED,
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

  it("pulls due-soon work forward only into spare time, silently", () => {
    const soon = task({
      id: "soon",
      nextDueOn: "2026-09-15",
      dueSoonDays: 7,
      estimatedMinutes: 25,
    });
    const relaxed = planWeek(input({ tasks: [soon] }));
    expect(relaxed.placements[0]).toMatchObject({
      taskId: "soon",
      code: "PULLED_FORWARD",
    });

    const busy = planWeek(
      input({
        tasks: [
          soon,
          ...Array.from({ length: 8 }, (_, i) =>
            task({ id: `t${i}`, estimatedMinutes: 25, nextDueOn: MON }),
          ),
        ],
      }),
    );
    expect(busy.placements.some((p) => p.taskId === "soon")).toBe(false);
    expect(busy.unscheduled.some((u) => u.taskId === "soon")).toBe(false);
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
