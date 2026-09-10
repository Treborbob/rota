"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState } from "react";
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
import { useActionToast } from "@/components/use-action-toast";
import { voidCompletionAction } from "@/lib/completions/actions";

export function VoidDialog({
  completionId,
  taskName,
}: {
  completionId: string;
  taskName: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(voidCompletionAction, null);
  const onSuccess = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);
  useActionToast(state, onSuccess);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Remove this completion of ${taskName}`}
        >
          <Undo2 />
          Undo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="completionId" value={completionId} />
          <DialogHeader>
            <DialogTitle>Remove from history?</DialogTitle>
            <DialogDescription>
              {taskName} goes back to being due as it was before. The entry
              stays visible, marked as removed.
            </DialogDescription>
          </DialogHeader>
          <FormField id="reason" label="Why" error={state?.fieldErrors?.reason}>
            <Input
              id="reason"
              name="reason"
              required
              maxLength={500}
              placeholder="Tapped it by mistake"
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Keep it
            </Button>
            <PendingButton variant="destructive" pendingLabel="Removing…">
              Remove
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
