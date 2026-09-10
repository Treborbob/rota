/**
 * Due-state classification. Pure.
 */
import {
  daysBetween,
  formatFriendlyDate,
  formatShortDate,
  type LocalDate,
} from "@/lib/dates";

export type DueStateKind =
  | "PAUSED"
  | "DEFERRED"
  | "ANYTIME"
  | "NOT_DUE"
  | "DUE_SOON"
  | "DUE"
  | "OVERDUE";

export type DueState =
  | { kind: "PAUSED" }
  | { kind: "DEFERRED"; until: LocalDate }
  | { kind: "ANYTIME" }
  | { kind: "NOT_DUE"; dueOn: LocalDate; daysUntil: number }
  | { kind: "DUE_SOON"; dueOn: LocalDate; daysUntil: number }
  | { kind: "DUE"; dueOn: LocalDate }
  | { kind: "OVERDUE"; dueOn: LocalDate; daysOverdue: number };

export type DueStateInput = {
  nextDueOn: LocalDate | null;
  dueSoonDays: number;
  paused: boolean;
  deferredUntil: LocalDate | null;
  today: LocalDate;
};

export function classifyDueState(input: DueStateInput): DueState {
  const { nextDueOn, dueSoonDays, paused, deferredUntil, today } = input;

  if (paused) return { kind: "PAUSED" };
  if (deferredUntil && deferredUntil > today) {
    return { kind: "DEFERRED", until: deferredUntil };
  }
  if (!nextDueOn) return { kind: "ANYTIME" };

  const daysUntil = daysBetween(today, nextDueOn);
  if (daysUntil < 0) {
    return { kind: "OVERDUE", dueOn: nextDueOn, daysOverdue: -daysUntil };
  }
  if (daysUntil === 0) return { kind: "DUE", dueOn: nextDueOn };
  if (daysUntil <= dueSoonDays) {
    return { kind: "DUE_SOON", dueOn: nextDueOn, daysUntil };
  }
  return { kind: "NOT_DUE", dueOn: nextDueOn, daysUntil };
}

/** Sort weight: most urgent first. */
export const DUE_STATE_ORDER: Record<DueStateKind, number> = {
  OVERDUE: 0,
  DUE: 1,
  DUE_SOON: 2,
  ANYTIME: 3,
  NOT_DUE: 4,
  DEFERRED: 5,
  PAUSED: 6,
};

/** Short badge text: "3 days overdue", "Due today", "Due in 4 days". */
export function describeDueState(state: DueState): string {
  switch (state.kind) {
    case "PAUSED":
      return "Paused";
    case "DEFERRED":
      return `Deferred until ${formatShortDate(state.until)}`;
    case "ANYTIME":
      return "Whenever";
    case "OVERDUE":
      return state.daysOverdue === 1
        ? "1 day overdue"
        : `${state.daysOverdue} days overdue`;
    case "DUE":
      return "Due today";
    case "DUE_SOON":
      return state.daysUntil === 1
        ? "Due tomorrow"
        : `Due in ${state.daysUntil} days`;
    case "NOT_DUE":
      return `Due ${formatShortDate(state.dueOn)}`;
  }
}

/** Longer text for detail views: "Next due Thursday 22 October". */
export function describeNextDue(state: DueState, today: LocalDate): string {
  switch (state.kind) {
    case "PAUSED":
      return "Paused";
    case "DEFERRED":
      return `Deferred until ${formatFriendlyDate(state.until, today)}`;
    case "ANYTIME":
      return "No due date";
    case "DUE":
      return "Due today";
    case "OVERDUE":
      return `Was due ${formatFriendlyDate(state.dueOn, today)}`;
    default:
      return `Next due ${formatFriendlyDate(state.dueOn, today)}`;
  }
}
