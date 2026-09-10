import Link from "next/link";
import { AreaChip } from "@/components/area-chip";
import { EmptyState } from "@/components/empty-state";
import { VoidDialog } from "@/components/history/void-dialog";
import type { CompletionRow } from "@/lib/completions/queries";
import { formatInstant } from "@/lib/dates";
import { firstName } from "@/lib/members";

export function HistoryList({
  rows,
  showTask = true,
  emptyText = "Nothing here yet.",
}: {
  rows: CompletionRow[];
  currentUserId: string;
  showTask?: boolean;
  emptyText?: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyText} />;

  return (
    <ul className="divide-y rounded-xl border">
      {rows.map((row) => {
        const voided = row.voidedAt !== null;
        return (
          <li
            key={row.id}
            className={`flex items-start gap-3 px-4 py-3 ${voided ? "opacity-60" : ""}`}
          >
            <div className="min-w-0 flex-1 space-y-1">
              {showTask ? (
                <p className="font-medium leading-tight">
                  <Link
                    href={`/tasks/${row.task.id}`}
                    className={`hover:underline ${voided ? "line-through" : ""}`}
                  >
                    {row.task.name}
                  </Link>
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
                <span>{formatInstant(row.completedAt)}</span>
                <span aria-hidden="true">·</span>
                <span>{firstName(row.completedBy.name)}</span>
                {row.actualMinutes ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {row.actualMinutes} min
                      {row.actualMinutes !== row.task.estimatedMinutes
                        ? ` (est. ${row.task.estimatedMinutes})`
                        : ""}
                    </span>
                  </>
                ) : null}
                {showTask ? <AreaChip area={row.task.area} /> : null}
                {row.source === "PICK" ? <span>· picked</span> : null}
              </div>
              {row.note ? <p className="text-sm">{row.note}</p> : null}
              {voided ? (
                <p className="text-sm italic">
                  Removed
                  {row.voidedBy ? ` by ${firstName(row.voidedBy.name)}` : ""}
                  {row.voidReason ? `: ${row.voidReason}` : ""}
                </p>
              ) : null}
            </div>
            {!voided ? (
              <VoidDialog completionId={row.id} taskName={row.task.name} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
