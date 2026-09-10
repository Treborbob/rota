/**
 * The weekly planner. Pure: no database, no React, no clock.
 *
 * Given the week, the members' minute budgets for each day, the candidate
 * tasks and a little history, it decides who does what on which evening and
 * explains every decision with a code. Same inputs, same plan.
 */
import {
  addDaysLocal,
  daysBetween,
  isoWeekday,
  type LocalDate,
} from "@/lib/dates";
import {
  PLANNER_WEIGHTS,
  type PlannerWeights,
} from "@/lib/domain/planner-config";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "ESSENTIAL";
export type AssignmentMode = "FIXED" | "ALTERNATE" | "BALANCED";

export type PlannerMember = { id: string; name: string };

/** One person's minutes on one date, after any override. */
export type PlannerBucket = {
  userId: string;
  date: LocalDate;
  minutes: number;
};

export type PlannerTask = {
  id: string;
  name: string;
  estimatedMinutes: number;
  priority: Priority;
  unpleasant: boolean;
  assignmentMode: AssignmentMode;
  fixedAssigneeId: string | null;
  nextDueOn: LocalDate | null;
  dueSoonDays: number;
  preferredWeekday: number | null;
  /** ISO weekdays; empty means any. */
  allowedWeekdays: number[];
  deferredUntil: LocalDate | null;
  /** Who did it last, for ALTERNATE. */
  lastCompletedById: string | null;
};

/** Work already fixed in this week that the planner must plan around. */
export type PreservedPlacement = {
  taskId: string;
  userId: string;
  date: LocalDate;
  minutes: number;
  heavy: boolean;
};

export type PlannerInput = {
  weekStart: LocalDate;
  /** Nothing is placed before today. */
  today: LocalDate;
  members: PlannerMember[];
  buckets: PlannerBucket[];
  tasks: PlannerTask[];
  /** Task ids a person has explicitly added to this week. */
  pinnedTaskIds: string[];
  /** Completed minutes per member over the previous 28 days. */
  recentMinutes: Record<string, number>;
  preserved: PreservedPlacement[];
  weights?: PlannerWeights;
};

export type PlacementCode =
  | "OVERDUE"
  | "DUE_THIS_WEEK"
  | "PINNED"
  | "PULLED_FORWARD"
  | "ESSENTIAL_OVERFLOW";

export type UnscheduledCode =
  | "NO_CAPACITY"
  | "ASSIGNEE_UNAVAILABLE"
  | "NO_ALLOWED_DAY"
  | "FIXED_ASSIGNEE_OVERLOADED"
  | "TOO_LONG_FOR_ANY_SLOT";

export type Placement = {
  taskId: string;
  userId: string;
  date: LocalDate;
  score: number;
  code: PlacementCode;
  sortOrder: number;
};

export type Unscheduled = {
  taskId: string;
  score: number;
  code: UnscheduledCode;
};

export type PlannerOutput = {
  placements: Placement[];
  unscheduled: Unscheduled[];
  /** Everything needed to explain the plan later. */
  snapshot: {
    weekStart: LocalDate;
    today: LocalDate;
    weights: PlannerWeights;
    buckets: PlannerBucket[];
    recentMinutes: Record<string, number>;
    pinnedTaskIds: string[];
    candidateCount: number;
  };
};

export const UNSCHEDULED_MESSAGES: Record<UnscheduledCode, string> = {
  NO_CAPACITY: "Not enough time left this week",
  ASSIGNEE_UNAVAILABLE: "The person who always does this has no time this week",
  NO_ALLOWED_DAY: "None of its allowed days have any time this week",
  FIXED_ASSIGNEE_OVERLOADED: "The person who always does this is already full",
  TOO_LONG_FOR_ANY_SLOT: "Longer than any single evening's budget",
};

export const PLACEMENT_MESSAGES: Record<PlacementCode, string> = {
  OVERDUE: "Overdue",
  DUE_THIS_WEEK: "Due this week",
  PINNED: "Added by hand",
  PULLED_FORWARD: "Pulled forward into spare time",
  ESSENTIAL_OVERFLOW: "Essential, squeezed in over budget",
};

export function isHeavy(
  task: Pick<PlannerTask, "estimatedMinutes" | "priority" | "unpleasant">,
  weights: PlannerWeights = PLANNER_WEIGHTS,
): boolean {
  return (
    task.estimatedMinutes >= weights.heavyMinutes ||
    task.priority === "ESSENTIAL" ||
    task.unpleasant
  );
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function urgencyScore(
  task: Pick<PlannerTask, "priority" | "nextDueOn" | "dueSoonDays">,
  today: LocalDate,
  pinned: boolean,
  weights: PlannerWeights = PLANNER_WEIGHTS,
): number {
  let score: number = weights.priority[task.priority];
  if (task.nextDueOn) {
    const daysUntil = daysBetween(today, task.nextDueOn);
    if (daysUntil < 0) score += -daysUntil * weights.overduePerDay;
    score += Math.max(0, task.dueSoonDays - daysUntil) * weights.dueSoonPerDay;
  }
  if (pinned) score += weights.manualPin;
  return score;
}

/** Score desc, due date asc, minutes desc, id asc. Fully deterministic. */
export function compareCandidates(
  a: { score: number; task: PlannerTask },
  b: { score: number; task: PlannerTask },
): number {
  if (a.score !== b.score) return b.score - a.score;
  const ad = a.task.nextDueOn ?? "9999-12-31";
  const bd = b.task.nextDueOn ?? "9999-12-31";
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.task.estimatedMinutes !== b.task.estimatedMinutes) {
    return b.task.estimatedMinutes - a.task.estimatedMinutes;
  }
  return a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

type Candidate = { task: PlannerTask; score: number; code: PlacementCode };

export function selectCandidates(
  input: Pick<PlannerInput, "tasks" | "weekStart" | "today" | "pinnedTaskIds">,
  weights: PlannerWeights,
): { primary: Candidate[]; pullForward: Candidate[] } {
  const weekEnd = addDaysLocal(input.weekStart, 6);
  const pinned = new Set(input.pinnedTaskIds);
  const primary: Candidate[] = [];
  const pullForward: Candidate[] = [];

  for (const task of input.tasks) {
    const isPinned = pinned.has(task.id);
    if (task.deferredUntil && task.deferredUntil > weekEnd && !isPinned)
      continue;
    if (task.deferredUntil && task.deferredUntil > input.today && !isPinned)
      continue;

    const score = urgencyScore(task, input.today, isPinned, weights);
    if (isPinned) {
      primary.push({ task, score, code: "PINNED" });
      continue;
    }
    if (!task.nextDueOn) continue; // "whenever" one-offs are for Pick, not plans
    if (task.nextDueOn < input.today) {
      primary.push({ task, score, code: "OVERDUE" });
    } else if (task.nextDueOn <= weekEnd) {
      primary.push({ task, score, code: "DUE_THIS_WEEK" });
    } else if (daysBetween(weekEnd, task.nextDueOn) <= task.dueSoonDays) {
      pullForward.push({ task, score, code: "PULLED_FORWARD" });
    }
  }

  primary.sort(compareCandidates);
  pullForward.sort(compareCandidates);
  return { primary, pullForward };
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

type Slot = {
  userId: string;
  date: LocalDate;
  capacity: number;
  used: number;
  heavyCount: number;
};

export function planWeek(input: PlannerInput): PlannerOutput {
  const weights = input.weights ?? PLANNER_WEIGHTS;
  const weekEnd = addDaysLocal(input.weekStart, 6);
  const memberOrder = new Map(input.members.map((m, i) => [m.id, i]));

  // Slots: one per member per day with any capacity, from today onwards.
  const slots: Slot[] = input.buckets
    .filter(
      (b) =>
        b.minutes > 0 &&
        b.date >= input.weekStart &&
        b.date <= weekEnd &&
        b.date >= input.today &&
        memberOrder.has(b.userId),
    )
    .map((b) => ({
      userId: b.userId,
      date: b.date,
      capacity: b.minutes,
      used: 0,
      heavyCount: 0,
    }));

  const load: Record<string, number> = {};
  for (const m of input.members) {
    load[m.id] = (input.recentMinutes[m.id] ?? 0) * weights.recentLoadFactor;
  }

  // Preserved work consumes capacity and counts towards load.
  const preservedTaskIds = new Set<string>();
  for (const p of input.preserved) {
    preservedTaskIds.add(p.taskId);
    load[p.userId] = (load[p.userId] ?? 0) + p.minutes;
    const slot = slots.find((s) => s.userId === p.userId && s.date === p.date);
    if (slot) {
      slot.used += p.minutes;
      if (p.heavy) slot.heavyCount += 1;
    }
  }

  const { primary, pullForward } = selectCandidates(input, weights);
  const placements: Placement[] = [];
  const unscheduled: Unscheduled[] = [];
  let sortOrder = 0;

  const eligibleMembers = (task: PlannerTask): string[] => {
    const all = input.members.map((m) => m.id);
    switch (task.assignmentMode) {
      case "FIXED":
        return task.fixedAssigneeId && memberOrder.has(task.fixedAssigneeId)
          ? [task.fixedAssigneeId]
          : [];
      case "ALTERNATE": {
        const others = all.filter((id) => id !== task.lastCompletedById);
        return others.length > 0 ? others : all;
      }
      case "BALANCED":
        return all;
    }
  };

  const tryPlace = (
    candidate: Candidate,
    options: { allowOverflow: boolean; report: boolean },
  ): boolean => {
    const { task } = candidate;
    if (preservedTaskIds.has(task.id)) return true; // already in the week
    const heavy = isHeavy(task, weights);
    const members = eligibleMembers(task);

    const memberSlots = slots.filter((s) => members.includes(s.userId));
    if (memberSlots.length === 0) {
      if (options.report) {
        unscheduled.push({
          taskId: task.id,
          score: candidate.score,
          code: "ASSIGNEE_UNAVAILABLE",
        });
      }
      return false;
    }

    const daySlots =
      task.allowedWeekdays.length > 0
        ? memberSlots.filter((s) =>
            task.allowedWeekdays.includes(isoWeekday(s.date)),
          )
        : memberSlots;
    if (daySlots.length === 0) {
      if (options.report) {
        unscheduled.push({
          taskId: task.id,
          score: candidate.score,
          code: "NO_ALLOWED_DAY",
        });
      }
      return false;
    }

    // Rank every slot by projected utilisation after adding this task.
    type Ranked = { slot: Slot; ratio: number; fits: boolean };
    const ranked: Ranked[] = daySlots.map((slot) => {
      let ratio = (slot.used + task.estimatedMinutes) / slot.capacity;
      if (heavy && slot.heavyCount > 0) ratio += weights.heavyStackPenalty;
      return {
        slot,
        ratio,
        fits: slot.used + task.estimatedMinutes <= slot.capacity,
      };
    });

    const byPreference = (rs: Ranked[]): Ranked[] => {
      // Prefer the task's preferred weekday, then days on or before the due date.
      if (task.preferredWeekday !== null) {
        const pref = rs.filter(
          (r) => isoWeekday(r.slot.date) === task.preferredWeekday,
        );
        if (pref.length > 0) rs = pref;
      }
      if (task.nextDueOn) {
        const due = task.nextDueOn;
        const before = rs.filter((r) => r.slot.date <= due);
        if (before.length > 0) rs = before;
      }
      return rs;
    };

    const order = (a: Ranked, b: Ranked): number => {
      if (a.ratio !== b.ratio) return a.ratio - b.ratio;
      const la = load[a.slot.userId] ?? 0;
      const lb = load[b.slot.userId] ?? 0;
      if (la !== lb) return la - lb;
      if (a.slot.date !== b.slot.date)
        return a.slot.date < b.slot.date ? -1 : 1;
      return (
        (memberOrder.get(a.slot.userId) ?? 0) -
        (memberOrder.get(b.slot.userId) ?? 0)
      );
    };

    const fitting = byPreference(ranked.filter((r) => r.fits)).sort(order);
    let chosen: Ranked | undefined = fitting[0];
    let code = candidate.code;

    if (!chosen && options.allowOverflow && task.priority === "ESSENTIAL") {
      chosen = byPreference([...ranked]).sort(order)[0];
      code = "ESSENTIAL_OVERFLOW";
    }

    if (!chosen) {
      if (options.report) {
        const maxCapacity = Math.max(...daySlots.map((s) => s.capacity));
        let reason: UnscheduledCode = "NO_CAPACITY";
        if (task.estimatedMinutes > maxCapacity) {
          reason = "TOO_LONG_FOR_ANY_SLOT";
        } else if (task.assignmentMode === "FIXED") {
          reason = "FIXED_ASSIGNEE_OVERLOADED";
        }
        unscheduled.push({
          taskId: task.id,
          score: candidate.score,
          code: reason,
        });
      }
      return false;
    }

    chosen.slot.used += task.estimatedMinutes;
    if (heavy) chosen.slot.heavyCount += 1;
    load[chosen.slot.userId] =
      (load[chosen.slot.userId] ?? 0) + task.estimatedMinutes;
    placements.push({
      taskId: task.id,
      userId: chosen.slot.userId,
      date: chosen.slot.date,
      score: candidate.score,
      code,
      sortOrder: sortOrder++,
    });
    return true;
  };

  for (const candidate of primary) {
    tryPlace(candidate, { allowOverflow: true, report: true });
  }
  // Only into genuinely spare time, and never worth an overflow entry.
  for (const candidate of pullForward) {
    tryPlace(candidate, { allowOverflow: false, report: false });
  }

  return {
    placements,
    unscheduled,
    snapshot: {
      weekStart: input.weekStart,
      today: input.today,
      weights,
      buckets: input.buckets,
      recentMinutes: input.recentMinutes,
      pinnedTaskIds: input.pinnedTaskIds,
      candidateCount: primary.length,
    },
  };
}
