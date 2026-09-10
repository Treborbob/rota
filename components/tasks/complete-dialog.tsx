"use client";

import { Check } from "lucide-react";
import { useCallback, useState } from "react";
import { FormField } from "@/components/form-field";
import { PendingButton } from "@/components/pending-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToastAction } from "@/components/use-action-toast";
import { todayLocal } from "@/lib/dates";
import { completeTask } from "@/lib/tasks/actions";

/**
 * "Done" with an optional note, actual minutes and a back-dated day.
 * Used from the catalogue, the detail page and Pick.
 */
export function CompleteDialog({
  taskId,
  taskName,
  estimatedMinutes,
  source = "MANUAL",
  size = "default",
  variant = "default",
}: {
  taskId: string;
  taskName: string;
  estimatedMinutes: number;
  source?: "MANUAL" | "PICK";
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const onSuccess = useCallback(() => setOpen(false), []);
  const [state, formAction] = useToastAction(completeTask, onSuccess);
  const errors = state?.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          <Check />
          Done
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="source" value={source} />
          <DialogHeader>
            <DialogTitle>Mark as done</DialogTitle>
            <DialogDescription>{taskName}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="completedOn" label="When" error={errors.completedOn}>
              <Input
                id="completedOn"
                name="completedOn"
                type="date"
                defaultValue={todayLocal()}
                max={todayLocal()}
              />
            </FormField>
            <FormField
              id="actualMinutes"
              label="How long it took"
              hint={`Estimated ${estimatedMinutes} min`}
              error={errors.actualMinutes}
            >
              <Input
                id="actualMinutes"
                name="actualMinutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                placeholder={String(estimatedMinutes)}
              />
            </FormField>
          </div>
          <FormField id="note" label="Note" error={errors.note}>
            <Textarea id="note" name="note" rows={2} placeholder="Optional" />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <PendingButton pendingLabel="Saving…">
              <Check />
              Done
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
