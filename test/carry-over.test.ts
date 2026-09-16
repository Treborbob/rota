import { describe, expect, it } from "vitest";
import { addDaysLocal } from "@/lib/dates";
import { carryOver, type MissedItem } from "@/lib/domain/carry-over";
import type { PlannerBucket } from "@/lib/domain/planner";

const WEEK = "2026-09-14"; // Monday
const DAYS = Array.from({ length: 7 }, (_, i) => addDaysLocal(WEEK, i));
const [MON, TUE, WED, THU, FRI, SAT, SUN] = DAYS;

/** Rob 30/30/30/20/0/0/0, Hannah the same unless overridden. */
function buckets(
  overrides: Partial<Record<string, Partial<Record<string, number>>>> = {},
): PlannerBucket[] {
  const base = [30, 30, 30, 20, 0, 0, 0];
  const out: PlannerBucket[] = [];
  for (const userId of ["rob", "hannah"]) {
    DAYS.forEach((date, i) => {
      out.push({ userId, date, minutes: overrides[userId]?.[date] ?? base[i] });
    });
  }
  return out;
}

function item(id: string, userId: string, date: string): MissedItem {
  return { id, userId, date };
}

describe("carryOver", () => {
  const cases: {
    name: string;
    today: string;
    items: MissedItem[];
    buckets?: PlannerBucket[];
    expected: { id: string; date: string | null }[];
  }[] = [
    {
      name: "yesterday's leftovers land on today",
      today: TUE,
      items: [item("a", "rob", MON), item("b", "rob", MON)],
      expected: [
        { id: "a", date: TUE },
        { id: "b", date: TUE },
      ],
    },
    {
      name: "items dated today or later are not missed",
      today: TUE,
      items: [item("a", "rob", TUE), item("b", "rob", WED)],
      expected: [],
    },
    {
      name: "skips a day the owner is out and takes the next with any minutes",
      today: TUE,
      items: [item("a", "rob", MON)],
      buckets: buckets({ rob: { [TUE]: 0, [WED]: 0, [THU]: 5 } }),
      expected: [{ id: "a", date: THU }],
    },
    {
      name: "stays with its owner even when the other person is free today",
      today: TUE,
      items: [item("a", "rob", MON)],
      buckets: buckets({ rob: { [TUE]: 0 } }),
      expected: [{ id: "a", date: WED }],
    },
    {
      name: "two days missed stack onto the same evening",
      today: WED,
      items: [item("a", "rob", MON), item("b", "rob", TUE)],
      expected: [
        { id: "a", date: WED },
        { id: "b", date: WED },
      ],
    },
    {
      name: "no evening left this week gives null",
      today: FRI,
      items: [item("a", "rob", THU)],
      expected: [{ id: "a", date: null }],
    },
    {
      name: "a capacity override on a dead weekend day counts as an evening",
      today: FRI,
      items: [item("a", "rob", THU)],
      buckets: buckets({ rob: { [SAT]: 15 } }),
      expected: [{ id: "a", date: SAT }],
    },
    {
      name: "each owner is placed independently",
      today: TUE,
      items: [item("a", "rob", MON), item("b", "hannah", MON)],
      buckets: buckets({ hannah: { [TUE]: 0 } }),
      expected: [
        { id: "a", date: TUE },
        { id: "b", date: WED },
      ],
    },
    {
      name: "never lands on Sunday of the following week",
      today: SUN,
      items: [item("a", "rob", SAT)],
      buckets: buckets({ rob: { [addDaysLocal(SUN, 1)]: 30 } }),
      expected: [{ id: "a", date: null }],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(
        carryOver(c.items, {
          weekStart: WEEK,
          today: c.today,
          buckets: c.buckets ?? buckets(),
        }),
      ).toEqual(c.expected);
    });
  }
});
