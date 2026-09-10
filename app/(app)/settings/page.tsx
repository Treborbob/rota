import { PageHeader } from "@/components/page-header";
import { WEEKDAY_LABELS } from "@/lib/capacity";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const user = await requireUser();
  const [household, capacities] = await Promise.all([
    db.household.findFirst(),
    db.weekdayCapacity.findMany({
      where: { userId: user.id },
      orderBy: { weekday: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader title="Settings" description={household?.name} />
      <section className="rounded-xl border">
        <h3 className="border-b px-4 py-3 font-medium">
          Your minutes per evening
        </h3>
        <ul className="divide-y">
          {capacities.map((c) => (
            <li
              key={c.id}
              className="flex min-h-12 items-center justify-between px-4"
            >
              <span>{WEEKDAY_LABELS[c.weekday - 1]}</span>
              <span className="tabular-nums text-muted-foreground">
                {c.minutes} min
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
