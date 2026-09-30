import { describe, expect, it } from "vitest";
import { addDaysLocal } from "@/lib/dates";
import {
  type AwayDay,
  type CarryItem,
  carryOver,
  pushTarget,
} from "@/lib/domain/carry-over";

const WEEK = "2026-09-14"; // Monday
const DAYS = Array.from({ length: 14 }, (_, i) => addDaysLocal(WEEK, i));
const [MON, TUE, WED, THU, FRI, SAT, SUN, NEXT_MON, NEXT_TUE] = DAYS;
const DUE = "2026-09-10";

function item(
  id: string,
  userId: string,
  date: string,
  extra: Partial<CarryItem> = {},
): CarryItem {
  return {
    id,
    userId,
    date,
    carried: false,
    dueOnSnapshot: DUE,
    task: {
      nextDueOn: DUE,
      archived: false,
      paused: false,
      deferredUntil: null,
    },
    ...extra,
  };
}

function away(userId: string, ...dates: string[]): AwayDay[] {
  return dates.map((date) => ({ userId, date }));
}

describe("carryOver", () => {
  const cases: {
    name: string;
    today: string;
    items: CarryItem[];
    away?: AwayDay[];
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
      name: "two days missed stack onto today",
      today: WED,
      items: [item("a", "rob", MON), item("b", "rob", TUE)],
      expected: [
        { id: "a", date: WED },
        { id: "b", date: WED },
      ],
    },
    {
      name: "Thursday's leftovers land on Friday, time budgeted or not",
      today: FRI,
      items: [item("a", "rob", THU)],
      expected: [{ id: "a", date: FRI }],
    },
    {
      name: "Sunday's leftovers cross into next week",
      today: NEXT_MON,
      items: [item("a", "rob", SUN)],
      expected: [{ id: "a", date: NEXT_MON }],
    },
    {
      name: "a week unopened still lands on today",
      today: NEXT_TUE,
      items: [item("a", "rob", WED)],
      expected: [{ id: "a", date: NEXT_TUE }],
    },
    {
      name: "skips days the owner is marked away",
      today: TUE,
      items: [item("a", "rob", MON)],
      away: away("rob", TUE, WED),
      expected: [{ id: "a", date: THU }],
    },
    {
      name: "stays with its owner when the other person is free",
      today: TUE,
      items: [item("a", "rob", MON), item("b", "hannah", MON)],
      away: away("rob", TUE),
      expected: [
        { id: "a", date: WED },
        { id: "b", date: TUE },
      ],
    },
    {
      name: "a holiday over the weekend carries it past the week boundary",
      today: FRI,
      items: [item("a", "rob", THU)],
      away: away("rob", FRI, SAT, SUN, NEXT_MON),
      expected: [{ id: "a", date: NEXT_TUE }],
    },
    {
      name: "a carried item on a day since marked away moves off it",
      today: TUE,
      items: [item("a", "rob", THU, { carried: true })],
      away: away("rob", THU, FRI),
      expected: [{ id: "a", date: SAT }],
    },
    {
      name: "a planned item on an away day is the planner's to move",
      today: TUE,
      items: [item("a", "rob", THU)],
      away: away("rob", THU),
      expected: [],
    },
    {
      name: "a carried item on a free day stays put",
      today: TUE,
      items: [item("a", "rob", THU, { carried: true })],
      expected: [],
    },
    {
      name: "done or skipped since (due date moved on) is dropped",
      today: TUE,
      items: [
        item("a", "rob", MON, {
          task: {
            nextDueOn: "2026-09-21",
            archived: false,
            paused: false,
            deferredUntil: null,
          },
        }),
      ],
      expected: [{ id: "a", date: null }],
    },
    {
      name: "paused, archived or deferred past today is dropped",
      today: TUE,
      items: [
        item("a", "rob", MON, {
          task: {
            nextDueOn: DUE,
            archived: false,
            paused: true,
            deferredUntil: null,
          },
        }),
        item("b", "rob", MON, {
          task: {
            nextDueOn: DUE,
            archived: true,
            paused: false,
            deferredUntil: null,
          },
        }),
        item("c", "rob", MON, {
          task: {
            nextDueOn: DUE,
            archived: false,
            paused: false,
            deferredUntil: WED,
          },
        }),
      ],
      expected: [
        { id: "a", date: null },
        { id: "b", date: null },
        { id: "c", date: null },
      ],
    },
    {
      name: "a deferral that has run out doesn't stop it",
      today: TUE,
      items: [
        item("a", "rob", MON, {
          task: {
            nextDueOn: DUE,
            archived: false,
            paused: false,
            deferredUntil: TUE,
          },
        }),
      ],
      expected: [{ id: "a", date: TUE }],
    },
    {
      name: "an undated one-off added by hand is still owed",
      today: TUE,
      items: [
        item("a", "rob", MON, {
          dueOnSnapshot: null,
          task: {
            nextDueOn: null,
            archived: false,
            paused: false,
            deferredUntil: null,
          },
        }),
      ],
      expected: [{ id: "a", date: TUE }],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(
        carryOver(c.items, { today: c.today, away: c.away ?? [] }),
      ).toEqual(c.expected);
    });
  }
});

describe("pushTarget", () => {
  const cases: {
    name: string;
    today: string;
    away?: AwayDay[];
    expected: string;
  }[] = [
    { name: "pushes to tomorrow", today: MON, expected: TUE },
    {
      name: "Thursday pushes to Friday, time budgeted or not",
      today: THU,
      expected: FRI,
    },
    { name: "Sunday pushes to next Monday", today: SUN, expected: NEXT_MON },
    {
      name: "skips days the owner is marked away",
      today: WED,
      away: away("rob", THU, FRI),
      expected: SAT,
    },
    {
      name: "someone else being away doesn't matter",
      today: WED,
      away: away("hannah", THU),
      expected: THU,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(pushTarget("rob", c.today, c.away ?? [])).toBe(c.expected);
    });
  }
});
