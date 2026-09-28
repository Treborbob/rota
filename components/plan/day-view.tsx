import { Sparkles } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { DayNav, DaySwipe } from "@/components/plan/day-nav";
import { PlanItemCard } from "@/components/plan/plan-item-card";
import { ProgressRing } from "@/components/plan/progress-ring";
import { Button } from "@/components/ui/button";
import {
  addDaysLocal,
  daysBetween,
  formatFriendlyDate,
  formatLocalDate,
  type LocalDate,
  startOfWeekLocal,
  todayLocal,
} from "@/lib/dates";
import { toneForMember } from "@/lib/member-style";
import { currentWeekStart, getPlanView } from "@/lib/planning/queries";
import { formatMinutes } from "@/lib/tasks/view";

const WORDS = [
  "Nothing",
  "One thing",
  "Two things",
  "Three things",
  "Four things",
  "Five things",
];

function things(n: number): string {
  return WORDS[n] ?? `${n} things`;
}

function subtitle(
  when: "past" | "today" | "future",
  mine: number,
  mineDone: number,
  anything: boolean,
): string {
  if (when === "past") {
    if (!anything) return "Nothing was planned.";
    if (mine === 0) return "Nothing was on your list.";
    return `${things(mineDone)} of yours done.`;
  }
  if (when === "future") {
    if (!anything) return "Nothing planned yet.";
    if (mine === 0) return "Nothing on your list.";
    if (mineDone >= mine) return "All yours are already done.";
    return `${things(mine - mineDone)} on your list.`;
  }
  if (!anything) return "Nothing planned. Enjoy it.";
  if (mine === 0) return "Nothing on your list tonight.";
  if (mineDone >= mine) return "All yours are done. Feet up.";
  return `${things(mine - mineDone)} left, then you're done.`;
}

/** "Tomorrow", "Yesterday", or the full date for anything further off. */
function eyebrow(date: LocalDate, today: LocalDate): string | null {
  const offset = daysBetween(today, date);
  if (offset === 0) return null;
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  return formatFriendlyDate(date, today);
}

/** One evening, per person. Tonight is this for today. */
export async function DayView({
  date,
  userId,
}: {
  date: LocalDate;
  userId: string;
}) {
  const today = todayLocal();
  const when = date < today ? "past" : date > today ? "future" : "today";
  const weekStart = startOfWeekLocal(date);
  // Current and future weeks are planned on first sight; the past never is.
  const plan = await getPlanView(weekStart);
  const day = plan?.days.find((d) => d.date === date);

  // Signed-in person first; it's their phone.
  const members = day
    ? [...day.members].sort((a, b) =>
        a.userId === userId ? -1 : b.userId === userId ? 1 : 0,
      )
    : [];
  const anything = members.some((m) => m.items.length > 0);
  const totalItems = members.reduce((s, m) => s + m.items.length, 0);
  const doneItems = members.reduce(
    (s, m) => s + m.items.filter((i) => i.state === "COMPLETED").length,
    0,
  );
  const me = members.find((m) => m.userId === userId);
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
  const onThatDay =
    when === "today" ? "tonight" : `on ${formatLocalDate(date, "EEEE")}`;
  const weekHref =
    weekStart === currentWeekStart(today) ? "/week" : `/week/${weekStart}`;

  const previous = addDaysLocal(date, -1);
  const next = addDaysLocal(date, 1);
  const hrefFor = (d: LocalDate) => (d === today ? "/" : `/day/${d}`);
  const label = eyebrow(date, today);

  return (
    <DaySwipe previousHref={hrefFor(previous)} nextHref={hrefFor(next)}>
      <div className="mb-6 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {label ? (
            <p className="font-medium text-muted-foreground text-sm">{label}</p>
          ) : null}
          <h2 className="font-semibold text-3xl tracking-tight">
            {formatLocalDate(date, "EEEE")} evening
          </h2>
          <p className="mt-1 text-muted-foreground">
            {subtitle(when, mine, mineDone, anything)}
          </p>
        </div>
        <DayNav
          previousHref={hrefFor(previous)}
          previousLabel={formatLocalDate(previous, "EEEE")}
          nextHref={hrefFor(next)}
          nextLabel={formatLocalDate(next, "EEEE")}
          isToday={when === "today"}
        />
      </div>

      {!anything ? (
        <EmptyState
          title={
            !plan
              ? "No plan for this week"
              : day && day.capacity === 0
                ? "No routine housework planned"
                : `Nothing planned for ${when === "today" ? "tonight" : "that evening"}`
          }
          description={
            when === "past"
              ? !plan
                ? "Weeks that were never opened stay empty."
                : undefined
              : day && day.capacity === 0
                ? "Evening off. If you feel like doing something anyway, Pick has ideas."
                : "Pick has ideas if you're restless."
          }
          action={
            when === "past" ? undefined : (
              <Button variant="outline" asChild>
                <Link href="/pick">
                  <Sparkles />
                  Pick something
                </Link>
              </Button>
            )
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
              <section key={m.userId} aria-labelledby={`evening-${m.userId}`}>
                <h3
                  id={`evening-${m.userId}`}
                  className="mb-3 flex items-center gap-3"
                >
                  <MemberAvatar name={m.name} tone={tone} />
                  <span className="font-medium text-lg">
                    {m.userId === userId ? "You" : m.name}
                  </span>
                  <span className="ml-auto tabular-nums text-muted-foreground text-sm">
                    {m.items.length === 0
                      ? `nothing ${onThatDay}`
                      : `${done}/${m.items.length} · ${formatMinutes(m.planned)}`}
                  </span>
                </h3>
                {m.carried > 0 ? (
                  <p className="mb-3 text-muted-foreground text-sm">
                    Includes {formatMinutes(m.carried)} carried over from
                    earlier in the week.
                  </p>
                ) : null}
                {m.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-4 py-3 text-muted-foreground text-sm">
                    Nothing {onThatDay}.
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

          {plan && when !== "past" && plan.shortfallMinutes > 0 ? (
            <p className="text-muted-foreground text-sm">
              About {formatMinutes(plan.shortfallMinutes)} more than the week
              has room for.{" "}
              <Link href={weekHref} className="underline">
                See the week
              </Link>
              .
            </p>
          ) : null}
        </div>
      )}
    </DaySwipe>
  );
}
