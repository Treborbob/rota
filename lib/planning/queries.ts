import {
  addDaysLocal,
  formatDayAhead,
  formatLocalDate,
  fromDbDate,
  type LocalDate,
  startOfWeekLocal,
  toDbDate,
  todayLocal,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { pushTarget } from "@/lib/domain/carry-over";
import { classifyDueState, describeDueState } from "@/lib/domain/due-state";
import {
  isShortfall,
  PLACEMENT_MESSAGES,
  type PlacementCode,
  UNSCHEDULED_MESSAGES,
  type UnscheduledCode,
} from "@/lib/domain/planner";
import type { PlannedTaskState, Priority } from "@/lib/generated/prisma/client";
import { firstName, listMembers, type Member } from "@/lib/members";
import {
  type CapacityCell,
  loadAwayDays,
  loadCapacityCells,
  weekDates,
} from "@/lib/planning/capacity";
import { carryOverMissed } from "@/lib/planning/carry-over";
import { generatePlan } from "@/lib/planning/generate";
import { getDueSoonDaysDefault } from "@/lib/tasks/queries";
import { formatMinutes } from "@/lib/tasks/view";

export type PlanItemView = {
  id: string;
  taskId: string;
  name: string;
  notes: string | null;
  area: {
    id: string;
    name: string;
    icon: string | null;
    colour: string | null;
  };
  minutes: number;
  minutesLabel: string;
  priority: Priority;
  unpleasant: boolean;
  assignedTo: { id: string; name: string } | null;
  date: LocalDate | null;
  /** Where "push to tomorrow" would put it; only tonight's undone jobs. */
  pushTo: { date: LocalDate; label: string } | null;
  state: PlannedTaskState;
  code: string;
  codeLabel: string;
  manualOverride: boolean;
  dueLabel: string;
  dueOn: LocalDate | null;
  startedAt: Date | null;
  completion: { id: string; actualMinutes: number | null } | null;
};

export type PlanMemberDay = {
  userId: string;
  name: string;
  capacity: number;
  defaultCapacity: number;
  overridden: boolean;
  note: string | null;
  planned: number;
  /** Minutes of that carried over from earlier days; part of `planned`. */
  carried: number;
  items: PlanItemView[];
};

export type PlanDayView = {
  date: LocalDate;
  label: string;
  shortLabel: string;
  isToday: boolean;
  isPast: boolean;
  capacity: number;
  planned: number;
  members: PlanMemberDay[];
};

export type PlanView = {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  previousWeekStart: LocalDate;
  nextWeekStart: LocalDate;
  isCurrentWeek: boolean;
  generatedAt: Date;
  members: Member[];
  days: PlanDayView[];
  /** Didn't fit: more minutes in an evening would fix it. */
  overflow: PlanItemView[];
  /** Due after the last evening with any time; next week's problem. */
  waiting: PlanItemView[];
  /** Minutes of overflow, the honest size of the week's shortfall. */
  shortfallMinutes: number;
  /** "Rob's jobs are 40 min over; Hannah has 30 min free on Thursday." */
  shortfallNote: string | null;
  done: PlanItemView[];
  totalPlanned: number;
  totalCapacity: number;
};

export function currentWeekStart(today: LocalDate = todayLocal()): LocalDate {
  return startOfWeekLocal(today);
}

function codeLabel(code: string): string {
  return (
    PLACEMENT_MESSAGES[code as PlacementCode] ??
    UNSCHEDULED_MESSAGES[code as UnscheduledCode] ??
    code
  );
}

/** The plan for a week, generated lazily the first time it is asked for. */
export async function getPlanView(
  weekStart: LocalDate,
  options: { generateIfMissing?: boolean } = {},
): Promise<PlanView | null> {
  const today = todayLocal();
  const weekEnd = addDaysLocal(weekStart, 6);
  const generateIfMissing = options.generateIfMissing ?? weekEnd >= today; // never auto-plan the past

  // First, so leftovers are where they belong before anything is read.
  if (weekEnd >= today) await carryOverMissed(today);

  let plan = await db.weeklyPlan.findUnique({
    where: { weekStartDate: toDbDate(weekStart) },
    select: { id: true, generatedAt: true },
  });
  if (!plan && generateIfMissing) {
    await generatePlan(weekStart);
    plan = await db.weeklyPlan.findUnique({
      where: { weekStartDate: toDbDate(weekStart) },
      select: { id: true, generatedAt: true },
    });
  }
  if (!plan) return null;

  const [members, dueSoonDaysDefault, items] = await Promise.all([
    listMembers(),
    getDueSoonDaysDefault(),
    db.plannedTask.findMany({
      where: { weeklyPlanId: plan.id },
      orderBy: [{ plannedDate: "asc" }, { sortOrder: "asc" }],
      include: {
        task: {
          select: {
            id: true,
            name: true,
            notes: true,
            unpleasant: true,
            nextDueOn: true,
            dueSoonDays: true,
            pausedAt: true,
            deferredUntil: true,
            assignmentMode: true,
            fixedAssigneeId: true,
            area: {
              select: { id: true, name: true, icon: true, colour: true },
            },
          },
        },
        assignedTo: { select: { id: true, name: true } },
        completion: { select: { id: true, actualMinutes: true } },
      },
    }),
  ]);
  const [cells, away] = await Promise.all([
    loadCapacityCells(
      weekStart,
      members.map((m) => m.id),
    ),
    loadAwayDays(
      members.map((m) => m.id),
      today,
    ),
  ]);

  const views: PlanItemView[] = items.map((item) => {
    const dueOn = fromDbDate(item.dueOnSnapshot);
    const dueState = classifyDueState({
      nextDueOn: dueOn,
      dueSoonDays: item.task.dueSoonDays ?? dueSoonDaysDefault,
      paused: false,
      deferredUntil: null,
      today,
    });
    const date = fromDbDate(item.plannedDate);
    const pushTo =
      item.state === "PLANNED" && date === today && item.assignedToId
        ? pushTarget(item.assignedToId, today, away)
        : null;
    return {
      id: item.id,
      taskId: item.taskId,
      name: item.task.name,
      notes: item.task.notes,
      area: item.task.area,
      minutes: item.estimatedMinutesSnapshot,
      minutesLabel: formatMinutes(item.estimatedMinutesSnapshot),
      priority: item.prioritySnapshot,
      unpleasant: item.task.unpleasant,
      assignedTo: item.assignedTo,
      date,
      pushTo: pushTo
        ? { date: pushTo, label: formatDayAhead(pushTo, today) }
        : null,
      state: item.state,
      code: item.explanationCode,
      codeLabel: codeLabel(item.explanationCode),
      manualOverride: item.manualOverride,
      dueLabel: describeDueState(dueState),
      dueOn,
      startedAt: item.startedAt,
      completion: item.completion,
    };
  });

  const cellFor = (userId: string, date: LocalDate): CapacityCell | undefined =>
    cells.find((c) => c.userId === userId && c.date === date);

  const days: PlanDayView[] = weekDates(weekStart).map((date) => {
    const memberDays: PlanMemberDay[] = members.map((m) => {
      const cell = cellFor(m.id, date);
      const mine = views.filter(
        (v) =>
          v.date === date &&
          v.assignedTo?.id === m.id &&
          (v.state === "PLANNED" || v.state === "COMPLETED"),
      );
      return {
        userId: m.id,
        name: firstName(m.name),
        capacity: cell?.minutes ?? 0,
        defaultCapacity: cell?.defaultMinutes ?? 0,
        overridden: cell?.overridden ?? false,
        note: cell?.note ?? null,
        planned: mine.reduce((sum, v) => sum + v.minutes, 0),
        carried: mine
          .filter((v) => v.code === "CARRIED_OVER")
          .reduce((sum, v) => sum + v.minutes, 0),
        items: mine,
      };
    });
    return {
      date,
      label: formatLocalDate(date, "EEEE d MMMM"),
      shortLabel: formatLocalDate(date, "EEE d"),
      isToday: date === today,
      isPast: date < today,
      capacity: memberDays.reduce((s, m) => s + m.capacity, 0),
      planned: memberDays.reduce((s, m) => s + m.planned, 0),
      members: memberDays,
    };
  });

  const unscheduled = views.filter((v) => v.state === "UNSCHEDULED");
  const overflow = unscheduled.filter((v) => isShortfall(v.code));
  const waiting = unscheduled.filter((v) => !isShortfall(v.code));
  const shortfallMinutes = overflow.reduce((s, v) => s + v.minutes, 0);

  // When the whole shortfall is one person's fixed jobs and someone else has
  // time to spare, say so: that's the reassign nudge, without a button.
  let shortfallNote: string | null = null;
  const fixedOwners = new Set(
    overflow.map((v) => {
      const raw = items.find((i) => i.id === v.id);
      return raw?.task.assignmentMode === "FIXED"
        ? raw.task.fixedAssigneeId
        : null;
    }),
  );
  const [ownerId] = fixedOwners;
  const owner = members.find((m) => m.id === ownerId);
  if (overflow.length > 0 && fixedOwners.size === 1 && owner) {
    let best: { name: string; minutes: number; day: string } | null = null;
    for (const d of days) {
      if (d.date < today) continue;
      for (const m of d.members) {
        const spare = m.capacity - m.planned;
        if (
          m.userId !== owner.id &&
          spare > 0 &&
          spare > (best?.minutes ?? 0)
        ) {
          best = {
            name: m.name,
            minutes: spare,
            day: formatLocalDate(d.date, "EEEE"),
          };
        }
      }
    }
    if (best) {
      shortfallNote = `${firstName(owner.name)}'s jobs are ${formatMinutes(shortfallMinutes)} over; ${best.name} has ${formatMinutes(best.minutes)} free on ${best.day}.`;
    }
  }

  return {
    weekStart,
    weekEnd,
    previousWeekStart: addDaysLocal(weekStart, -7),
    nextWeekStart: addDaysLocal(weekStart, 7),
    isCurrentWeek: weekStart === currentWeekStart(today),
    generatedAt: plan.generatedAt,
    members,
    days,
    overflow,
    waiting,
    shortfallMinutes,
    shortfallNote,
    done: views.filter((v) => v.state === "COMPLETED"),
    totalPlanned: days.reduce((s, d) => s + d.planned, 0),
    totalCapacity: days.reduce((s, d) => s + d.capacity, 0),
  };
}

/** Tasks that could be added to a week by hand: active, not already in it. */
export async function listAddableTasks(weekStart: LocalDate) {
  const inPlan = await db.plannedTask.findMany({
    where: {
      weeklyPlan: { weekStartDate: toDbDate(weekStart) },
      state: { in: ["PLANNED", "COMPLETED"] },
    },
    select: { taskId: true },
  });
  const exclude = inPlan.map((p) => p.taskId);
  return db.task.findMany({
    where: { archivedAt: null, pausedAt: null, id: { notIn: exclude } },
    orderBy: [{ nextDueOn: "asc" }, { name: "asc" }],
    select: { id: true, name: true, estimatedMinutes: true, nextDueOn: true },
  });
}
