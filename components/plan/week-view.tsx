import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { CapacityChip } from "@/components/plan/capacity-chip";
import { type DayOption, PlanItemCard } from "@/components/plan/plan-item-card";
import {
  AddToWeekDialog,
  RegenerateButton,
} from "@/components/plan/week-controls";
import { Button } from "@/components/ui/button";
import { formatLocalDate, fromDbDate, todayLocal } from "@/lib/dates";
import { classifyDueState, describeDueState } from "@/lib/domain/due-state";
import {
  UNSCHEDULED_MESSAGES,
  type UnscheduledCode,
} from "@/lib/domain/planner";
import { listAddableTasks, type PlanView } from "@/lib/planning/queries";
import { getDueSoonDaysDefault } from "@/lib/tasks/queries";
import { formatMinutes } from "@/lib/tasks/view";
import { cn } from "@/lib/utils";

export async function WeekView({ plan }: { plan: PlanView }) {
  const today = todayLocal();
  const [addable, dueSoonDaysDefault] = await Promise.all([
    listAddableTasks(plan.weekStart),
    getDueSoonDaysDefault(),
  ]);
  const addableViews = addable.map((t) => ({
    id: t.id,
    name: t.name,
    estimatedMinutes: t.estimatedMinutes,
    dueLabel: describeDueState(
      classifyDueState({
        nextDueOn: fromDbDate(t.nextDueOn),
        dueSoonDays: dueSoonDaysDefault,
        paused: false,
        deferredUntil: null,
        today,
      }),
    ),
  }));

  // Show days that have any budget or anything on them; hide dead weekend
  // days, and past days that ended up empty, so today sits near the top.
  const visibleDays = plan.days.filter((d) => {
    const hasItems = d.members.some((m) => m.items.length > 0);
    if (d.isPast) return hasItems;
    return d.capacity > 0 || hasItems;
  });
  const dayOptions: DayOption[] = plan.days
    .filter((d) => !d.isPast)
    .map((d) => ({ date: d.date, label: d.label }));

  const title = `${formatLocalDate(plan.weekStart, "d MMM")} – ${formatLocalDate(plan.weekEnd, "d MMM")}`;
  const doneMinutes = plan.done.reduce((s, i) => s + i.minutes, 0);

  return (
    <>
      <PageHeader
        title={plan.isCurrentWeek ? "This week" : "Week"}
        description={title}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link
                href={`/week/${plan.previousWeekStart}`}
                aria-label="Previous week"
              >
                <ChevronLeft />
              </Link>
            </Button>
            {!plan.isCurrentWeek ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/week">This week</Link>
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/week/${plan.nextWeekStart}`} aria-label="Next week">
                <ChevronRight />
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <RegenerateButton weekStart={plan.weekStart} />
        <AddToWeekDialog weekStart={plan.weekStart} tasks={addableViews} />
      </div>

      <div className="mb-6 flex items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-rota-orange-soft to-rota-teal-soft px-5 py-4">
        <div className="min-w-0">
          <p className="font-semibold text-xl tabular-nums tracking-tight">
            {formatMinutes(plan.totalPlanned)} planned
          </p>
          <p className="text-muted-foreground text-sm">
            {formatMinutes(doneMinutes)} done ·{" "}
            {formatMinutes(plan.totalCapacity)} available
          </p>
        </div>
        <div
          className="h-2 w-40 shrink-0 overflow-hidden rounded-full bg-background/50"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={plan.totalPlanned}
          aria-valuenow={doneMinutes}
          aria-label="Minutes done this week"
        >
          <div
            className="h-full rounded-full bg-rota-orange"
            style={{
              width: `${plan.totalPlanned ? Math.min(100, (doneMinutes / plan.totalPlanned) * 100) : 0}%`,
            }}
          />
        </div>
      </div>

      {visibleDays.length === 0 ? (
        <EmptyState
          title="No evenings with any time this week"
          description="Set some minutes in Settings, or tap a day to add time."
        />
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]">
          {visibleDays.map((day) => (
            <section
              key={day.date}
              aria-labelledby={`day-${day.date}`}
              className={cn(
                "rounded-2xl border bg-card/40 p-3",
                day.isToday && "border-rota-orange ring-1 ring-rota-orange",
                day.isPast && "opacity-70",
              )}
            >
              <h3
                id={`day-${day.date}`}
                className="mb-2 flex items-baseline justify-between"
              >
                <span className="font-medium">
                  {day.shortLabel}
                  {day.isToday ? (
                    <span className="ml-2 text-muted-foreground text-xs">
                      Today
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-muted-foreground text-xs">
                  {day.planned}/{day.capacity} min
                </span>
              </h3>
              <div className="mb-2 space-y-0.5">
                {day.members.map((m) => (
                  <CapacityChip
                    key={m.userId}
                    member={m}
                    date={day.date}
                    dateLabel={day.label}
                  />
                ))}
              </div>
              {day.members.every((m) => m.items.length === 0) ? (
                <p className="px-1.5 py-2 text-muted-foreground text-xs">
                  Nothing planned.
                </p>
              ) : (
                <ul className="space-y-2">
                  {day.members.flatMap((m) =>
                    m.items.map((item) => (
                      <PlanItemCard
                        key={item.id}
                        item={item}
                        days={dayOptions}
                        members={plan.members}
                      />
                    )),
                  )}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {plan.overflow.length > 0 ? (
        <section className="mt-8">
          <h3 className="mb-1 font-medium">Couldn't fit this week</h3>
          <p className="mb-3 text-muted-foreground text-sm">
            Still due. Move one by hand, free up an evening, or leave it for
            next week.
          </p>
          <ul className="space-y-2">
            {plan.overflow.map((item) => (
              <PlanItemCard
                key={item.id}
                item={item}
                days={dayOptions}
                members={plan.members}
                reason={
                  UNSCHEDULED_MESSAGES[item.code as UnscheduledCode] ??
                  item.codeLabel
                }
              />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
