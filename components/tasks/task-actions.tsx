"use client";

import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  Copy,
  Pause,
  Pencil,
  Play,
  SkipForward,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { PendingButton } from "@/components/pending-button";
import { CompleteDialog } from "@/components/tasks/complete-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import type { ActionState } from "@/lib/action-state";
import { addDaysLocal, todayLocal } from "@/lib/dates";
import {
  archiveTask,
  clearDeferral,
  deferTask,
  duplicateTask,
  pauseTask,
  restoreTask,
  resumeTask,
  skipOccurrence,
} from "@/lib/tasks/actions";
import type { TaskView } from "@/lib/tasks/view";

export function TaskActions({ task }: { task: TaskView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result?.ok) {
        if (result.message) toast.success(result.message);
        router.refresh();
      } else if (result?.message) {
        toast.error(result.message);
      }
    });
  }

  if (task.archived) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => restoreTask(task.id))}
        >
          <ArchiveRestore />
          Restore
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <CompleteDialog
        taskId={task.id}
        taskName={task.name}
        estimatedMinutes={task.estimatedMinutes}
      />

      {task.dueState.kind === "DEFERRED" ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => clearDeferral(task.id))}
        >
          <Undo2 />
          Undo defer
        </Button>
      ) : task.paused ? null : (
        <DeferDialog taskId={task.id} />
      )}

      {task.paused ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => resumeTask(task.id))}
        >
          <Play />
          Resume
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => pauseTask(task.id))}
        >
          <Pause />
          Pause
        </Button>
      )}

      {task.recurrence && task.nextDueOn && !task.paused ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={pending}>
              <SkipForward />
              Skip this time
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Skip this occurrence?</AlertDialogTitle>
              <AlertDialogDescription>
                The next due date moves on one cycle (
                {task.cadenceLabel.toLowerCase()}) and nothing is recorded as
                done. Use Defer instead if you just want it later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => run(() => skipOccurrence(task.id))}
              >
                Skip
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <Button variant="outline" asChild>
        <Link href={`/tasks/${task.id}/edit`}>
          <Pencil />
          Edit
        </Link>
      </Button>

      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => startTransition(() => duplicateTask(task.id))}
      >
        <Copy />
        Duplicate
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" disabled={pending}>
            <Archive />
            Archive
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this task?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves the list and any plan, but its history stays. You can
              restore it later from the archived filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(() => archiveTask(task.id))}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeferDialog({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(deferTask, null);
  const onSuccess = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);
  useActionToast(state, onSuccess);
  const tomorrow = addDaysLocal(todayLocal(), 1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarClock />
          Defer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="taskId" value={taskId} />
          <DialogHeader>
            <DialogTitle>Defer until</DialogTitle>
            <DialogDescription>
              Keeps it off the plan until then. The cycle isn't advanced.
            </DialogDescription>
          </DialogHeader>
          <FormField id="until" label="Date" error={state?.fieldErrors?.until}>
            <Input
              id="until"
              name="until"
              type="date"
              required
              min={tomorrow}
              defaultValue={addDaysLocal(todayLocal(), 7)}
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <PendingButton pendingLabel="Saving…">Defer</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
