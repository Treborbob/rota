import { Flame } from "lucide-react";
import { notFound } from "next/navigation";
import { AreaChip } from "@/components/area-chip";
import { HistoryList } from "@/components/history/history-list";
import { PageHeader } from "@/components/page-header";
import { DueBadge } from "@/components/tasks/due-badge";
import { TaskActions } from "@/components/tasks/task-actions";
import { WEEKDAY_LABELS } from "@/lib/capacity";
import { listCompletions } from "@/lib/completions/queries";
import { formatInstant } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { getTask } from "@/lib/tasks/queries";

const PRIORITY_LABELS = {
  LOW: "Low priority",
  NORMAL: "Normal priority",
  HIGH: "High priority",
  ESSENTIAL: "Essential",
} as const;

export default async function TaskPage({
  params,
}: PageProps<"/tasks/[taskId]">) {
  const user = await requireUser();
  const { taskId } = await params;
  const [task, completions] = await Promise.all([
    getTask(taskId),
    listCompletions({ taskId, includeVoided: true, limit: 50 }),
  ]);
  if (!task) notFound();

  const facts: Array<[string, string]> = [
    ["Cadence", task.cadenceLabel],
    ["Estimate", task.minutesLabel],
    ["Who", task.assignmentLabel],
    ["Priority", PRIORITY_LABELS[task.priority]],
    [
      "Last done",
      task.lastCompletedAt
        ? formatInstant(task.lastCompletedAt, "EEE d MMM yyyy")
        : "Never",
    ],
    ["Next", task.nextDueLabel],
  ];
  if (task.allowedWeekdays.length > 0) {
    facts.push([
      "Allowed days",
      task.allowedWeekdays
        .map((d) => WEEKDAY_LABELS[d - 1].slice(0, 3))
        .join(", "),
    ]);
  }
  if (task.preferredWeekday) {
    facts.push(["Preferred day", WEEKDAY_LABELS[task.preferredWeekday - 1]]);
  }
  if (task.recurrence?.anchor === "SCHEDULE") {
    facts.push(["Anchor", "Fixed calendar cadence"]);
  }

  return (
    <>
      <PageHeader
        title={task.name}
        description={task.archived ? "Archived" : undefined}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <AreaChip area={task.area} />
        <DueBadge state={task.dueState} label={task.dueLabel} />
        {task.unpleasant ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
            <Flame className="size-3" aria-hidden="true" />
            Unpleasant
          </span>
        ) : null}
      </div>

      <div className="mb-8">
        <TaskActions task={task} />
      </div>

      <dl className="mb-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border p-4 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {task.notes ? (
        <section className="mb-8">
          <h3 className="mb-2 font-medium">Notes</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {task.notes}
          </p>
        </section>
      ) : null}

      <section>
        <h3 className="mb-3 font-medium">History</h3>
        <HistoryList
          rows={completions}
          currentUserId={user.id}
          showTask={false}
          emptyText="Not done yet."
        />
      </section>
    </>
  );
}
