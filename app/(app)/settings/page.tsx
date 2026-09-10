import { PageHeader } from "@/components/page-header";
import { CapacityForm } from "@/components/settings/capacity-form";
import { HouseholdForm } from "@/components/settings/household-form";
import { db } from "@/lib/db";
import { firstName, listMembers } from "@/lib/members";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [household, members, capacities] = await Promise.all([
    db.household.findFirst(),
    listMembers(),
    db.weekdayCapacity.findMany(),
  ]);

  const minutesFor = (userId: string) =>
    [1, 2, 3, 4, 5, 6, 7].map(
      (d) =>
        capacities.find((c) => c.userId === userId && c.weekday === d)
          ?.minutes ?? 0,
    );

  // Your own row first.
  const ordered = [...members].sort((a, b) =>
    a.id === user.id ? -1 : b.id === user.id ? 1 : 0,
  );

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        {household ? (
          <HouseholdForm
            name={household.name}
            dueSoonDaysDefault={household.dueSoonDaysDefault}
          />
        ) : null}
        {ordered.map((m) => (
          <CapacityForm
            key={m.id}
            userId={m.id}
            name={m.id === user.id ? "Your" : `${firstName(m.name)}'s`}
            minutes={minutesFor(m.id)}
          />
        ))}
        <section className="rounded-xl border">
          <h3 className="border-b px-4 py-3 font-medium">Members</h3>
          <ul className="divide-y">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex min-h-12 items-center px-4 text-sm"
              >
                {m.name}
              </li>
            ))}
          </ul>
          <p className="border-t px-4 py-3 text-muted-foreground text-xs">
            Members are whoever is on the allowlist and has signed in.
          </p>
        </section>
      </div>
    </>
  );
}
