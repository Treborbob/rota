import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { WeekNav } from "@/components/plan/week-nav";
import { WeekView } from "@/components/plan/week-view";
import {
  addDaysLocal,
  formatLocalDate,
  isLocalDate,
  startOfWeekLocal,
} from "@/lib/dates";
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
    const title = `${formatLocalDate(monday, "d MMM")} – ${formatLocalDate(addDaysLocal(monday, 6), "d MMM")}`;
    return (
      <>
        <PageHeader
          title="Week"
          description={title}
          actions={
            <WeekNav
              previousWeekStart={addDaysLocal(monday, -7)}
              nextWeekStart={addDaysLocal(monday, 7)}
              isCurrentWeek={false}
            />
          }
        />
        <EmptyState
          title="No plan for this week"
          description="Weeks that were never opened stay empty."
        />
      </>
    );
  }
  return <WeekView plan={plan} />;
}
