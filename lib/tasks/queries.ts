import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { compareTaskViews, type TaskView, toTaskView } from "@/lib/tasks/view";

const TASK_INCLUDE = {
  area: { select: { id: true, name: true, icon: true, colour: true } },
  fixedAssignee: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

export async function getDueSoonDaysDefault(): Promise<number> {
  const household = await db.household.findFirst({
    select: { dueSoonDaysDefault: true },
  });
  return household?.dueSoonDaysDefault ?? 7;
}

export type TaskListFilters = {
  q?: string;
  areaId?: string;
  assigneeId?: string;
  type?: "RECURRING" | "ONE_OFF";
  status?: "active" | "paused" | "archived";
  due?: "overdue" | "due" | "soon";
};

export async function listTasks(
  filters: TaskListFilters = {},
): Promise<TaskView[]> {
  const where: Prisma.TaskWhereInput = {};

  switch (filters.status ?? "active") {
    case "active":
      where.archivedAt = null;
      where.pausedAt = null;
      break;
    case "paused":
      where.archivedAt = null;
      where.pausedAt = { not: null };
      break;
    case "archived":
      where.archivedAt = { not: null };
      break;
  }
  if (filters.q) where.name = { contains: filters.q, mode: "insensitive" };
  if (filters.areaId) where.areaId = filters.areaId;
  if (filters.assigneeId) where.fixedAssigneeId = filters.assigneeId;
  if (filters.type) where.taskType = filters.type;

  const [tasks, dueSoonDaysDefault] = await Promise.all([
    db.task.findMany({ where, include: TASK_INCLUDE }),
    getDueSoonDaysDefault(),
  ]);

  let views = tasks.map((t) => toTaskView(t, { dueSoonDaysDefault }));
  if (filters.due) {
    const kinds = {
      overdue: ["OVERDUE"],
      due: ["OVERDUE", "DUE"],
      soon: ["OVERDUE", "DUE", "DUE_SOON"],
    }[filters.due];
    views = views.filter((v) => kinds.includes(v.dueState.kind));
  }
  return views.sort(compareTaskViews);
}

export async function getTask(taskId: string): Promise<TaskView | null> {
  const [task, dueSoonDaysDefault] = await Promise.all([
    db.task.findUnique({ where: { id: taskId }, include: TASK_INCLUDE }),
    getDueSoonDaysDefault(),
  ]);
  return task ? toTaskView(task, { dueSoonDaysDefault }) : null;
}

export async function listAreas(includeInactive = false) {
  return db.area.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { sortOrder: "asc" },
  });
}
