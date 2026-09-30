"use client";

import { FormField } from "@/components/form-field";
import { PendingButton } from "@/components/pending-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useToastAction } from "@/components/use-action-toast";
import { setAway } from "@/lib/planning/actions";

export type AwayPeriod = { key: string; who: string; label: string };

export function AwayForm({
  members,
  today,
  periods,
}: {
  members: { id: string; name: string }[];
  today: string;
  periods: AwayPeriod[];
}) {
  const [state, formAction] = useToastAction(setAway);

  return (
    <form action={formAction} className="rounded-xl border">
      <h3 className="border-b px-4 py-3 font-medium">Away</h3>
      <div className="space-y-4 px-4 py-3">
        <p className="text-muted-foreground text-sm">
          Holidays and trips. Nothing is planned on those days, and anything
          carried over waits for the first day back.
        </p>
        <FormField id="away-who" label="Who" error={state?.fieldErrors?.who}>
          <NativeSelect id="away-who" name="who" defaultValue="all">
            <option value="all">Both of us</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="away-from"
            label="First day"
            error={state?.fieldErrors?.from}
          >
            <Input
              id="away-from"
              name="from"
              type="date"
              required
              min={today}
            />
          </FormField>
          <FormField
            id="away-to"
            label="Last day"
            error={state?.fieldErrors?.to}
          >
            <Input id="away-to" name="to" type="date" required min={today} />
          </FormField>
        </div>
        {periods.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {periods.map((p) => (
              <li key={p.key}>
                <span className="font-medium">{p.who}</span> away {p.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {/* Mark away first in the markup so Enter submits it, not the clear. */}
      <div className="flex flex-row-reverse flex-wrap items-center justify-start gap-2 border-t px-4 py-3">
        <PendingButton size="sm" pendingLabel="Saving…">
          Mark away
        </PendingButton>
        <PendingButton
          size="sm"
          variant="ghost"
          name="back"
          value="1"
          pendingLabel="Clearing…"
        >
          Not away after all
        </PendingButton>
      </div>
    </form>
  );
}
