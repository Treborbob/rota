/**
 * All calendar logic in Rota happens in the household timezone. Instants are
 * stored in UTC; anything a person reads or plans against is a local date.
 * Local dates travel as ISO "yyyy-MM-dd" strings so a timezone conversion can
 * never shift them by accident.
 */
import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import { enGB } from "date-fns/locale";

export const HOUSEHOLD_TZ = "Europe/London";

/** A local calendar date as "yyyy-MM-dd". */
export type LocalDate = string;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: unknown): value is LocalDate {
  return typeof value === "string" && LOCAL_DATE_RE.test(value);
}

/** Naive Date at local midnight for calendar arithmetic. Never persist this. */
function naive(date: LocalDate): Date {
  return parseISO(date);
}

function fromNaive(date: Date): LocalDate {
  return format(date, "yyyy-MM-dd");
}

/** The local calendar date on which an instant falls. */
export function toLocalDate(instant: Date): LocalDate {
  return format(new TZDate(instant, HOUSEHOLD_TZ), "yyyy-MM-dd");
}

export function todayLocal(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

/**
 * Prisma returns @db.Date columns as a Date at UTC midnight. Read the UTC
 * fields, not the local ones, or the day shifts west of Greenwich.
 */
export function fromDbDate(value: Date): LocalDate;
export function fromDbDate(value: Date | null): LocalDate | null;
export function fromDbDate(value: Date | null): LocalDate | null {
  if (!value) return null;
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The Date to hand Prisma for a @db.Date column. */
export function toDbDate(value: LocalDate): Date;
export function toDbDate(value: LocalDate | null): Date | null;
export function toDbDate(value: LocalDate | null): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

/** Midnight at the start of a local date, as a real instant. */
export function startOfLocalDay(date: LocalDate): Date {
  const n = naive(date);
  return new Date(
    new TZDate(
      n.getFullYear(),
      n.getMonth(),
      n.getDate(),
      HOUSEHOLD_TZ,
    ).getTime(),
  );
}

export function addDaysLocal(date: LocalDate, days: number): LocalDate {
  return fromNaive(addDays(naive(date), days));
}

export function addWeeksLocal(date: LocalDate, weeks: number): LocalDate {
  return fromNaive(addWeeks(naive(date), weeks));
}

/** Calendar-month arithmetic; clamps to the last valid day (31 Jan → 28 Feb). */
export function addMonthsLocal(date: LocalDate, months: number): LocalDate {
  return fromNaive(addMonths(naive(date), months));
}

/** Calendar-year arithmetic; 29 Feb → 28 Feb in a non-leap year. */
export function addYearsLocal(date: LocalDate, years: number): LocalDate {
  return fromNaive(addYears(naive(date), years));
}

/** b - a in whole days. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return differenceInCalendarDays(naive(b), naive(a));
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxLocalDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

/** ISO weekday for a local date: Monday = 1 … Sunday = 7. */
export function isoWeekday(date: LocalDate): number {
  const day = naive(date).getDay();
  return day === 0 ? 7 : day;
}

/** The Monday on or before the given date. */
export function startOfWeekLocal(date: LocalDate): LocalDate {
  return addDaysLocal(date, 1 - isoWeekday(date));
}

export function formatLocalDate(date: LocalDate, pattern: string): string {
  return format(naive(date), pattern, { locale: enGB });
}

/** "Thursday 22 October", with the year only when it isn't this year. */
export function formatFriendlyDate(
  date: LocalDate,
  today: LocalDate = todayLocal(),
): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return formatLocalDate(date, sameYear ? "EEEE d MMMM" : "EEEE d MMMM yyyy");
}

/** "Thu 22 Oct" */
export function formatShortDate(date: LocalDate): string {
  return formatLocalDate(date, "EEE d MMM");
}

export function formatInstant(instant: Date, pattern = "EEE d MMM, HH:mm") {
  return format(new TZDate(instant, HOUSEHOLD_TZ), pattern, { locale: enGB });
}
