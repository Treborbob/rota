import { Sparkles } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PlanItemCard } from "@/components/plan/plan-item-card";
import { Button } from "@/components/ui/button";
import { formatFriendlyDate, todayLocal } from "@/lib/dates";
import { currentWeekStart, getPlanView } from "@/lib/planning/queries";
import { requireUser } from "@/lib/session";

export default async function TonightPage() {
  const user = await requireUser();
  const today = todayLocal();
  const plan = await getPlanView(currentWeekStart(today), {
    generateIfMissing: true,
  });
  const day = plan?.days.find((d) => d.date === today);

  // Signed-in person first; it's their phone.
  const members = day
    ? [...day.members].sort((a, b) =>
        a.userId === user.id ? -1 : b.userId === user.id ? 1 : 0,
      )
    : [];
  const total = day?.planned ?? 0;
  const doneMinutes =
    day?.members.reduce(
      (s, m) =>
        s +
        m.items
          .filter((i) => i.state === "COMPLETED")
          .reduce((t, i) => t + i.minutes, 0),
      0,
    ) ?? 0;
  const anything = members.some((m) => m.items.length > 0);
  const dayOptions = plan
    ? plan.days
        .filter((d) => !d.isPast)
        .map((d) => ({ date: d.date, label: d.label }))
    : [];

  return (
    <>
      <PageHeader
        title="Tonight"
        description={
          anything
            ? `${formatFriendlyDate(today)} · ${doneMinutes} of ${total} min done`
            : formatFriendlyDate(today)
        }
      />

      {!anything ? (
        <EmptyState
          title={
            day && day.capacity === 0
              ? "No routine housework planned"
              : "Nothing planned for tonight"
          }
          description={
            day && day.capacity === 0
              ? "Evening off. If you feel like doing something anyway, Pick has ideas."
              : "Enjoy it. Pick has ideas if you're restless."
          }
          action={
            <Button variant="outline" asChild>
              <Link href="/pick">
                <Sparkles />
                Pick something
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {members.map((m) => (
            <section key={m.userId} aria-labelledby={`tonight-${m.userId}`}>
              <h3
                id={`tonight-${m.userId}`}
                className="mb-2 flex items-baseline justify-between"
              >
                <span className="font-medium">
                  {m.userId === user.id ? "You" : m.name}
                </span>
                <span className="tabular-nums text-muted-foreground text-sm">
                  {m.items.length === 0
                    ? "nothing tonight"
                    : `${m.items.filter((i) => i.state === "COMPLETED").length}/${m.items.length} done · ${m.planned} min`}
                </span>
              </h3>
              {m.items.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-3 text-muted-foreground text-sm">
                  Nothing tonight.
                </p>
              ) : (
                <ul className="space-y-2">
                  {m.items.map((item) => (
                    <PlanItemCard
                      key={item.id}
                      item={item}
                      days={dayOptions}
                      members={plan?.members ?? []}
                      compact
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
          {plan && plan.overflow.length > 0 ? (
            <p className="text-muted-foreground text-sm">
              {plan.overflow.length} task{plan.overflow.length === 1 ? "" : "s"}{" "}
              couldn't fit this week.{" "}
              <Link href="/week" className="underline">
                See the week
              </Link>
              .
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
