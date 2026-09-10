"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { AreaChip } from "@/components/area-chip";
import { FormField } from "@/components/form-field";
import { PendingButton } from "@/components/pending-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/components/use-action-toast";
import type { ActionState } from "@/lib/action-state";
import {
  archiveArea,
  createArea,
  moveArea,
  renameArea,
  restoreArea,
} from "@/lib/areas/actions";

export type AreaRow = {
  id: string;
  name: string;
  icon: string | null;
  colour: string | null;
  active: boolean;
  taskCount: number;
  dueCount: number;
  overdueCount: number;
};

export function AreaManager({ areas }: { areas: AreaRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [createState, createAction] = useActionState(createArea, null);
  const onCreated = useCallback(() => {
    formRef.current?.reset();
    router.refresh();
  }, [router]);
  useActionToast(createState, onCreated);

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

  const active = areas.filter((a) => a.active);
  const archived = areas.filter((a) => !a.active);

  return (
    <div className="space-y-8">
      <form
        ref={formRef}
        action={createAction}
        className="flex items-start gap-2"
      >
        <div className="flex-1">
          <Input
            name="name"
            placeholder="New area, e.g. Garage"
            aria-label="New area name"
            required
            maxLength={60}
            aria-invalid={Boolean(createState?.fieldErrors?.name)}
          />
        </div>
        <PendingButton variant="outline" pendingLabel="Adding…">
          <Plus />
          Add
        </PendingButton>
      </form>

      <ul className="divide-y rounded-xl border">
        {active.map((area, i) => (
          <li key={area.id} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <Link
                href={`/tasks?area=${area.id}`}
                className="block hover:underline"
              >
                <AreaChip area={area} />
              </Link>
              <p className="mt-1 text-muted-foreground text-xs">
                {area.taskCount} task{area.taskCount === 1 ? "" : "s"}
                {area.dueCount ? ` · ${area.dueCount} due` : ""}
                {area.overdueCount ? ` · ${area.overdueCount} overdue` : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${area.name} up`}
              disabled={pending || i === 0}
              onClick={() => run(() => moveArea(area.id, "up"))}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${area.name} down`}
              disabled={pending || i === active.length - 1}
              onClick={() => run(() => moveArea(area.id, "down"))}
            >
              <ArrowDown />
            </Button>
            <RenameDialog areaId={area.id} name={area.name} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Archive ${area.name}`}
              disabled={pending}
              onClick={() => run(() => archiveArea(area.id))}
            >
              <Archive />
            </Button>
          </li>
        ))}
      </ul>

      {archived.length > 0 ? (
        <section>
          <h3 className="mb-2 font-medium text-sm">Archived</h3>
          <ul className="divide-y rounded-xl border">
            {archived.map((area) => (
              <li
                key={area.id}
                className="flex items-center gap-2 px-3 py-2 opacity-70"
              >
                <div className="flex-1">
                  <AreaChip area={area} />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => restoreArea(area.id))}
                >
                  <ArchiveRestore />
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function RenameDialog({ areaId, name }: { areaId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const action = renameArea.bind(null, areaId);
  const [state, formAction] = useActionState(action, null);
  const onSuccess = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);
  useActionToast(state, onSuccess);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Rename ${name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Rename area</DialogTitle>
          </DialogHeader>
          <FormField
            id={`rename-${areaId}`}
            label="Name"
            error={state?.fieldErrors?.name}
          >
            <Input
              id={`rename-${areaId}`}
              name="name"
              defaultValue={name}
              required
              maxLength={60}
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
            <PendingButton pendingLabel="Saving…">Save</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
