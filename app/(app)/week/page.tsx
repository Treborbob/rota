import { WeekView } from "@/components/plan/week-view";
import { currentWeekStart, getPlanView } from "@/lib/planning/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Week" };

export default async function WeekPage() {
  await requireUser();
  const plan = await getPlanView(currentWeekStart(), {
    generateIfMissing: true,
  });
  if (!plan) return null;
  return <WeekView plan={plan} />;
}
