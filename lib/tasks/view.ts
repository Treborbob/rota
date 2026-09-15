/**
 * View models for tasks. Everything the UI needs, precomputed on the server,
 * with no Prisma Date objects or timezone decisions leaking into components.
 */
import { fromDbDate, type LocalDate, todayLocal } from "@/lib/dates";
import {
  classifyDueState,
  DUE_STATE_ORDER,
  type DueState,
  describeDueState,
  describeNextDue,
} from "@/lib/domain/due-state";
import {
  type DurationStats,
  effectiveMinutes,
  summariseDurations,
} from "@/lib/domain/duration";
import { describeCadence, type Recurrence } from "@/lib/domain/recurrence";
import type {
  Area,
  AssignmentMode,
  Priority,
  Task,
  TaskType,
} from "@/lib/generated/prisma/client";
import { firstName } from "@/lib/members";

export type TaskWithArea = Task & {
  area: Pick<Area, "id" | "name" | "icon" | "colour">;
  fixedAssignee: { id: string; name: string } | null;
};

export type TaskView = {
  id: string;
  name: string;
  notes: string | null;
  area: {
    id: string;
    name: string;
    icon: string | null;
    colour: string | null;
  };
  estimatedMinutes: number;
  minutesLabel: string;
  priority: Priority;
  unpleasant: boolean;
  taskType: TaskType;
  assignmentMode: AssignmentMode;
  fixedAssignee: { id: string; name: string } | null;
  assignmentLabel: string;
  recurrence: Recurrence | null;
  cadenceLabel: string;
  dueSoonDays: number | null;
  preferredWeekday: number | null;
  allowedWeekdays: number[];
  lastCompletedAt: Date | null;
  nextDueOn: LocalDate | null;
  deferredUntil: LocalDate | null;
  paused: boolean;
  archived: boolean;
  dueState: DueState;
  dueLabel: string;
  nextDueLabel: string;
  sortKey: number;
  /** Recorded durations, when the caller loaded them (detail page only). */
  durations: DurationStats | null;
  /** Minutes the planner will use: learned typical, or the estimate. */
  planningMinutes: number;
};

export function recurrenceOf(task: Task): Recurrence | null {
  if (
    task.taskType !== "RECURRING" ||
    !task.recurrenceValue ||
    !task.recurrenceUnit
  ) {
    return null;
  }
  return {
    value: task.recurrenceValue,
    unit: task.recurrenceUnit,
    anchor: task.recurrenceAnchor,
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

export function describeAssignment(
  mode: AssignmentMode,
  fixedAssignee: { name: string } | null,
): string {
  switch (mode) {
    case "FIXED":
      return fixedAssignee
        ? `Always ${firstName(fixedAssignee.name)}`
        : "Fixed";
    case "ALTERNATE":
      return "Take turns";
    case "BALANCED":
      return "Whoever's free";
  }
}

export function toTaskView(
  task: TaskWithArea,
  options: {
    today?: LocalDate;
    dueSoonDaysDefault: number;
    durationSamples?: number[];
  },
): TaskView {
  const samples = options.durationSamples ?? [];
  const today = options.today ?? todayLocal();
  const recurrence = recurrenceOf(task);
  const nextDueOn = fromDbDate(task.nextDueOn);
  const deferredUntil = fromDbDate(task.deferredUntil);
  const dueState = classifyDueState({
    nextDueOn,
    dueSoonDays: task.dueSoonDays ?? options.dueSoonDaysDefault,
    paused: task.pausedAt !== null,
    deferredUntil,
    today,
  });

  return {
    id: task.id,
    name: task.name,
    notes: task.notes,
    area: task.area,
    estimatedMinutes: task.estimatedMinutes,
    minutesLabel: formatMinutes(task.estimatedMinutes),
    priority: task.priority,
    unpleasant: task.unpleasant,
    taskType: task.taskType,
    assignmentMode: task.assignmentMode,
    fixedAssignee: task.fixedAssignee,
    assignmentLabel: describeAssignment(
      task.assignmentMode,
      task.fixedAssignee,
    ),
    recurrence,
    cadenceLabel: recurrence ? describeCadence(recurrence) : "One-off",
    dueSoonDays: task.dueSoonDays,
    preferredWeekday: task.preferredWeekday,
    allowedWeekdays: task.allowedWeekdays,
    lastCompletedAt: task.lastCompletedAt,
    nextDueOn,
    deferredUntil,
    paused: task.pausedAt !== null,
    archived: task.archivedAt !== null,
    dueState,
    dueLabel: describeDueState(dueState),
    nextDueLabel: describeNextDue(dueState, today),
    sortKey: DUE_STATE_ORDER[dueState.kind],
    durations: summariseDurations(samples),
    planningMinutes: effectiveMinutes(task.estimatedMinutes, samples).minutes,
  };
}

/** Most urgent first, then soonest due, then name. */
export function compareTaskViews(a: TaskView, b: TaskView): number {
  if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
  const ad = a.nextDueOn ?? "9999-12-31";
  const bd = b.nextDueOn ?? "9999-12-31";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.name.localeCompare(b.name);
}
