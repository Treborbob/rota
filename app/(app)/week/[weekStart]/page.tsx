import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { WeekView } from "@/components/plan/week-view";
import { isLocalDate, startOfWeekLocal } from "@/lib/dates";
import { currentWeekStart, getPlanView } from "@/lib/planning/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Week" };

export default async function WeekByStartPage({
  params,
}: PageProps<"/week/[weekStart]">) {
  await requireUser();
  const { weekStart } = await params;
  if (!isLocalDate(weekStart)) notFound();
  const monday = startOfWeekLocal(weekStart);
  if (monday !== weekStart) redirect(`/week/${monday}`);
  if (monday === currentWeekStart()) redirect("/week");

  const plan = await getPlanView(monday);
  if (!plan) {
    return (
      <>
        <PageHeader title="Week" description={monday} />
        <EmptyState
          title="No plan for this week"
          description="Past weeks without a plan stay empty."
        />
      </>
    );
  }
  return <WeekView plan={plan} />;
}
