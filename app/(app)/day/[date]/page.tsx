import { notFound, redirect } from "next/navigation";
import { DayView } from "@/components/plan/day-view";
import { formatLocalDate, isLocalDate, todayLocal } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/day/[date]">) {
  const { date } = await params;
  return {
    title: isLocalDate(date) ? formatLocalDate(date, "EEEE d MMMM") : "Day",
  };
}

export default async function DayPage({ params }: PageProps<"/day/[date]">) {
  const user = await requireUser();
  const { date } = await params;
  if (!isLocalDate(date)) notFound();
  if (date === todayLocal()) redirect("/");
  return <DayView date={date} userId={user.id} />;
}
