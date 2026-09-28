import { DayView } from "@/components/plan/day-view";
import { todayLocal } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export default async function TonightPage() {
  const user = await requireUser();
  return <DayView date={todayLocal()} userId={user.id} />;
}
