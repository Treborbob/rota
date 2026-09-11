import { Sparkles } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { PlanItemCard } from "@/components/plan/plan-item-card";
import { ProgressRing } from "@/components/plan/progress-ring";
import { Button } from "@/components/ui/button";
import { formatLocalDate, todayLocal } from "@/lib/dates";
import { toneForMember } from "@/lib/member-style";
import { currentWeekStart, getPlanView } from "@/lib/planning/queries";
import { requireUser } from "@/lib/session";
import { formatMinutes } from "@/lib/tasks/view";

const WORDS = [
  "Nothing",
  "One thing",
  "Two things",
  "Three things",
  "Four things",
  "Five things",
];

function subtitle(mine: number, mineDone: number, anything: boolean): string {
  if (!anything) return "Nothing planned. Enjoy it.";
  if (mine === 0) return "Nothing on your list tonight.";
  if (mineDone >= mine) return "All yours are done. Feet up.";
  const left = mine - mineDone;
  const words = WORDS[left] ?? `${left} things`;
  return `${words} left, then you're done.`;
}

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
  const anything = members.some((m) => m.items.length > 0);
  const totalItems = members.reduce((s, m) => s + m.items.length, 0);
  const doneItems = members.reduce(
    (s, m) => s + m.items.filter((i) => i.state === "COMPLETED").length,
    0,
  );
  const me = members.find((m) => m.userId === user.id);
  const mine = me?.items.length ?? 0;
  const mineDone = me?.items.filter((i) => i.state === "COMPLETED").length ?? 0;
  const dayOptions = plan
    ? plan.days
        .filter((d) => !d.isPast)
        .map((d) => ({ date: d.date, label: d.label }))
    : [];
  const perPerson = members.filter((m) => m.items.length > 0);
  const evenSplit =
    perPerson.length > 1 &&
    perPerson.every((m) => m.planned === perPerson[0].planned);

  return (
    <>
      <div className="mb-6">
        <h2 className="font-semibold text-3xl tracking-tight">
          {formatLocalDate(today, "EEEE")} evening
        </h2>
        <p className="mt-1 text-muted-foreground">
          {subtitle(mine, mineDone, anything)}
        </p>
      </div>

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
              : "Pick has ideas if you're restless."
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
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-rota-orange-soft to-rota-teal-soft px-5 py-4">
            <div>
              <p className="font-semibold text-2xl tabular-nums tracking-tight">
                {formatMinutes(day?.planned ?? 0)}
              </p>
              <p className="text-muted-foreground text-sm">
                {evenSplit
                  ? `${formatMinutes(perPerson[0].planned)} each`
                  : perPerson
                      .map((m) => `${m.name} ${formatMinutes(m.planned)}`)
                      .join(" · ")}
              </p>
            </div>
            <ProgressRing done={doneItems} total={totalItems} />
          </div>

          {members.map((m) => {
            const tone = toneForMember(plan?.members ?? [], m.userId);
            const done = m.items.filter((i) => i.state === "COMPLETED").length;
            return (
              <section key={m.userId} aria-labelledby={`tonight-${m.userId}`}>
                <h3
                  id={`tonight-${m.userId}`}
                  className="mb-3 flex items-center gap-3"
                >
                  <MemberAvatar name={m.name} tone={tone} />
                  <span className="font-medium text-lg">
                    {m.userId === user.id ? "You" : m.name}
                  </span>
                  <span className="ml-auto tabular-nums text-muted-foreground text-sm">
                    {m.items.length === 0
                      ? "nothing tonight"
                      : `${done}/${m.items.length} · ${formatMinutes(m.planned)}`}
                  </span>
                </h3>
                {m.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-4 py-3 text-muted-foreground text-sm">
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
            );
          })}

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
