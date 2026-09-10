"use client";

import { FormField } from "@/components/form-field";
import { PendingButton } from "@/components/pending-button";
import { Input } from "@/components/ui/input";
import { useToastAction } from "@/components/use-action-toast";
import { updateHousehold } from "@/lib/settings/actions";

export function HouseholdForm({
  name,
  dueSoonDaysDefault,
}: {
  name: string;
  dueSoonDaysDefault: number;
}) {
  const [state, formAction] = useToastAction(updateHousehold);
  return (
    <form action={formAction} className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="hh-name"
          label="Household name"
          error={state?.fieldErrors?.name}
        >
          <Input
            id="hh-name"
            name="name"
            defaultValue={name}
            required
            maxLength={60}
          />
        </FormField>
        <FormField
          id="hh-due-soon"
          label="Show as due soon"
          hint="Days before a task is due."
          error={state?.fieldErrors?.dueSoonDaysDefault}
        >
          <Input
            id="hh-due-soon"
            name="dueSoonDaysDefault"
            type="number"
            inputMode="numeric"
            min={0}
            max={90}
            defaultValue={dueSoonDaysDefault}
          />
        </FormField>
      </div>
      <PendingButton size="sm" pendingLabel="Saving…">
        Save
      </PendingButton>
    </form>
  );
}
