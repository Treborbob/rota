import { addDaysLocal, type LocalDate, startOfLocalDay } from "@/lib/dates";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export type HistoryFilters = {
  taskId?: string;
  areaId?: string;
  memberId?: string;
  from?: LocalDate;
  to?: LocalDate;
  includeVoided?: boolean;
  limit?: number;
};

export async function listCompletions(filters: HistoryFilters = {}) {
  const where: Prisma.TaskCompletionWhereInput = {};
  if (filters.taskId) where.taskId = filters.taskId;
  if (filters.areaId) where.task = { areaId: filters.areaId };
  if (filters.memberId) where.completedById = filters.memberId;
  if (!filters.includeVoided) where.voidedAt = null;
  if (filters.from || filters.to) {
    where.completedAt = {
      ...(filters.from ? { gte: startOfLocalDay(filters.from) } : {}),
      ...(filters.to
        ? { lt: startOfLocalDay(addDaysLocal(filters.to, 1)) }
        : {}),
    };
  }
  return db.taskCompletion.findMany({
    where,
    orderBy: { completedAt: "desc" },
    take: filters.limit ?? 200,
    include: {
      task: {
        select: {
          id: true,
          name: true,
          estimatedMinutes: true,
          area: { select: { id: true, name: true, icon: true, colour: true } },
        },
      },
      completedBy: { select: { id: true, name: true } },
      voidedBy: { select: { id: true, name: true } },
    },
  });
}

export type CompletionRow = Awaited<ReturnType<typeof listCompletions>>[number];
