import {
  addDaysLocal,
  fromDbDate,
  isoWeekday,
  type LocalDate,
} from "@/lib/dates";
import { db } from "@/lib/db";
import type { PlannerBucket } from "@/lib/domain/planner";

export function weekDates(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i));
}

export type CapacityCell = {
  userId: string;
  date: LocalDate;
  minutes: number;
  /** The weekday default, before any override. */
  defaultMinutes: number;
  overridden: boolean;
  note: string | null;
};

/** Every member's minutes for every day of the week, overrides applied. */
export async function loadCapacityCells(
  weekStart: LocalDate,
  memberIds: string[],
): Promise<CapacityCell[]> {
  const dates = weekDates(weekStart);
  const [defaults, overrides] = await Promise.all([
    db.weekdayCapacity.findMany({ where: { userId: { in: memberIds } } }),
    db.capacityOverride.findMany({
      where: {
        userId: { in: memberIds },
        localDate: {
          gte: new Date(`${dates[0]}T00:00:00.000Z`),
          lte: new Date(`${dates[6]}T00:00:00.000Z`),
        },
      },
    }),
  ]);

  const byDefault = new Map(
    defaults.map((d) => [`${d.userId}:${d.weekday}`, d.minutes]),
  );
  const byOverride = new Map(
    overrides.map((o) => [`${o.userId}:${fromDbDate(o.localDate)}`, o]),
  );

  const cells: CapacityCell[] = [];
  for (const userId of memberIds) {
    for (const date of dates) {
      const defaultMinutes =
        byDefault.get(`${userId}:${isoWeekday(date)}`) ?? 0;
      const override = byOverride.get(`${userId}:${date}`);
      cells.push({
        userId,
        date,
        minutes: override ? override.minutes : defaultMinutes,
        defaultMinutes,
        overridden: Boolean(override),
        note: override?.note ?? null,
      });
    }
  }
  return cells;
}

export function toBuckets(cells: CapacityCell[]): PlannerBucket[] {
  return cells.map(({ userId, date, minutes }) => ({ userId, date, minutes }));
}
