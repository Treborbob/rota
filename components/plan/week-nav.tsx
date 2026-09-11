import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Previous / this week / next. Shown whether or not the week has a plan. */
export function WeekNav({
  previousWeekStart,
  nextWeekStart,
  isCurrentWeek,
}: {
  previousWeekStart: string;
  nextWeekStart: string;
  isCurrentWeek: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" asChild>
        <Link href={`/week/${previousWeekStart}`} aria-label="Previous week">
          <ChevronLeft />
        </Link>
      </Button>
      {!isCurrentWeek ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href="/week">This week</Link>
        </Button>
      ) : null}
      <Button variant="ghost" size="icon" asChild>
        <Link href={`/week/${nextWeekStart}`} aria-label="Next week">
          <ChevronRight />
        </Link>
      </Button>
    </div>
  );
}
