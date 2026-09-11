/**
 * Sample tasks for exercising the planner locally. Idempotent by name.
 * Needs at least one signed-in user (two is better); fixed jobs are assigned
 * to the first two members by sign-up order.
 *
 *   pnpm db:seed:dev
 */
import { addDaysLocal, toDbDate, todayLocal } from "../lib/dates";
import { db } from "../lib/db";
import type { Prisma } from "../lib/generated/prisma/client";

async function main() {
  const areas = Object.fromEntries(
    (await db.area.findMany()).map((a) => [a.name, a.id]),
  );
  const members = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  if (members.length === 0) {
    console.error(
      "Sign in at least once first so there is a member to assign to.",
    );
    process.exitCode = 1;
    return;
  }
  const first = members[0].id;
  const second = members[1]?.id ?? first;
  const today = todayLocal();
  const on = (days: number) => toDbDate(addDaysLocal(today, days));

  const tasks: Prisma.TaskUncheckedCreateInput[] = [
    {
      name: "Clean the kitchen floor",
      areaId: areas.Kitchen,
      estimatedMinutes: 20,
      recurrenceValue: 1,
      recurrenceUnit: "WEEK",
      nextDueOn: on(0),
    },
    {
      name: "Laundry",
      areaId: areas["Utility & Appliances"],
      estimatedMinutes: 25,
      recurrenceValue: 1,
      recurrenceUnit: "WEEK",
      assignmentMode: "FIXED",
      fixedAssigneeId: second,
      nextDueOn: on(1),
    },
    {
      name: "Vacuum downstairs",
      areaId: areas["Whole House"],
      estimatedMinutes: 30,
      recurrenceValue: 1,
      recurrenceUnit: "WEEK",
      assignmentMode: "FIXED",
      fixedAssigneeId: first,
      nextDueOn: on(2),
    },
    {
      name: "Litter tray",
      areaId: areas.Bathrooms,
      estimatedMinutes: 10,
      recurrenceValue: 2,
      recurrenceUnit: "DAY",
      assignmentMode: "FIXED",
      fixedAssigneeId: second,
      unpleasant: true,
      nextDueOn: on(0),
    },
    {
      name: "Clean the appliances",
      areaId: areas.Kitchen,
      estimatedMinutes: 30,
      recurrenceValue: 4,
      recurrenceUnit: "WEEK",
      assignmentMode: "FIXED",
      fixedAssigneeId: first,
      nextDueOn: on(-5),
    },
    {
      name: "Bins out",
      areaId: areas.Outside,
      estimatedMinutes: 5,
      recurrenceValue: 1,
      recurrenceUnit: "WEEK",
      assignmentMode: "ALTERNATE",
      preferredWeekday: 3,
      nextDueOn: on(3),
    },
    {
      name: "Dust the lounge",
      areaId: areas.Lounge,
      estimatedMinutes: 15,
      recurrenceValue: 1,
      recurrenceUnit: "WEEK",
      nextDueOn: on(3),
    },
    {
      name: "Descale the kettle",
      areaId: areas.Kitchen,
      estimatedMinutes: 10,
      recurrenceValue: 1,
      recurrenceUnit: "MONTH",
      nextDueOn: on(10),
    },
    {
      name: "Clean the oven",
      areaId: areas.Kitchen,
      estimatedMinutes: 60,
      recurrenceValue: 3,
      recurrenceUnit: "MONTH",
      priority: "HIGH",
      unpleasant: true,
      nextDueOn: on(-9),
    },
    {
      name: "Wash the car",
      areaId: areas.Outside,
      estimatedMinutes: 45,
      recurrenceValue: 1,
      recurrenceUnit: "MONTH",
      allowedWeekdays: [6, 7],
      nextDueOn: on(2),
    },
    {
      name: "Change the bed",
      areaId: areas["Main Bedroom"],
      estimatedMinutes: 15,
      recurrenceValue: 2,
      recurrenceUnit: "WEEK",
      assignmentMode: "ALTERNATE",
      nextDueOn: on(6),
    },
  ];

  let created = 0;
  for (const t of tasks) {
    if (!t.areaId) continue; // area missing: run `pnpm db:seed` first
    const exists = await db.task.findFirst({ where: { name: t.name } });
    if (exists) continue;
    await db.task.create({ data: { taskType: "RECURRING", ...t } });
    created += 1;
  }
  console.log(
    `Sample tasks: ${created} created, ${tasks.length - created} already present`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
