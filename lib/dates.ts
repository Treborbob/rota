/**
 * All calendar logic in Rota happens in the household timezone. Instants are
 * stored in UTC; anything a person reads or plans against is a local date.
 * Local dates are passed around as ISO "yyyy-MM-dd" strings so they can't be
 * accidentally shifted by a timezone conversion.
 */
import { TZDate } from "@date-fns/tz";
import { format, parseISO, startOfDay } from "date-fns";
import { enGB } from "date-fns/locale";

export const HOUSEHOLD_TZ = "Europe/London";

/** A local calendar date as "yyyy-MM-dd". */
export type LocalDate = string;

export function toLocalDate(instant: Date): LocalDate {
  return format(new TZDate(instant, HOUSEHOLD_TZ), "yyyy-MM-dd");
}

export function todayLocal(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

/** Midnight at the start of a local date, as a UTC instant. */
export function startOfLocalDay(date: LocalDate): Date {
  const parsed = parseISO(date);
  const local = new TZDate(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    HOUSEHOLD_TZ,
  );
  return new Date(startOfDay(local).getTime());
}

export function formatLocalDate(date: LocalDate, pattern: string): string {
  return format(parseISO(date), pattern, { locale: enGB });
}

/** ISO weekday for a local date: Monday = 1 … Sunday = 7. */
export function isoWeekday(date: LocalDate): number {
  const day = parseISO(date).getDay();
  return day === 0 ? 7 : day;
}
