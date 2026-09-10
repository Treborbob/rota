import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <EmptyState
      title="That's not here"
      description="It may have been deleted, or the link is wrong."
      action={
        <Button variant="outline" asChild>
          <Link href="/">Back to Tonight</Link>
        </Button>
      }
    />
  );
}
