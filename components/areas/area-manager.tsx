"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AreaChip, AreaIcon } from "@/components/area-chip";
import { FormField } from "@/components/form-field";
import { PendingButton } from "@/components/pending-button";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useToastAction } from "@/components/use-action-toast";
import type { ActionState } from "@/lib/action-state";
import { AREA_ICONS } from "@/lib/area-icons";
import { AREA_COLOUR_KEYS, areaColourClass } from "@/lib/area-style";
import {
  archiveArea,
  createArea,
  deleteArea,
  reorderAreas,
  restoreArea,
  updateArea,
} from "@/lib/areas/actions";
import { cn } from "@/lib/utils";

export type AreaRow = {
  id: string;
  name: string;
  icon: string | null;
  colour: string | null;
  active: boolean;
  everUsed: boolean;
  taskCount: number;
  dueCount: number;
  overdueCount: number;
};

export function AreaManager({ areas }: { areas: AreaRow[] }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const onCreated = useCallback(() => formRef.current?.reset(), []);
  const [createState, createAction] = useToastAction(createArea, onCreated);

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result?.ok) {
        if (result.message) toast.success(result.message);
      } else if (result?.message) {
        toast.error(result.message);
      }
    });
  }

  const active = areas.filter((a) => a.active);
  const archived = areas.filter((a) => !a.active);

  // Optimistic order while a reorder is in flight; null means "as the server says".
  const [order, setOrder] = useState<string[] | null>(null);
  const serverIds = active.map((a) => a.id);
  const ids = order ?? serverIds;
  const byId = new Map(active.map((a) => [a.id, a]));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd({ active: dragged, over }: DragEndEvent) {
    if (!over || dragged.id === over.id) return;
    const from = ids.indexOf(String(dragged.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    setOrder(next);
    startTransition(async () => {
      const result = await reorderAreas(next);
      if (result?.ok) {
        setOrder(null);
      } else {
        setOrder(null);
        toast.error(result?.message ?? "Couldn't save that order.");
      }
    });
  }

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

      <DndContext
        id="areas-sortable"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="divide-y rounded-xl border">
            {ids.map((id) => {
              const area = byId.get(id);
              if (!area) return null;
              return (
                <SortableAreaRow key={id} area={area}>
                  <EditAreaDialog area={area} />
                  {area.everUsed ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Archive ${area.name}`}
                      disabled={pending}
                      onClick={() => run(() => archiveArea(area.id))}
                    >
                      <Archive />
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${area.name}`}
                          disabled={pending}
                        >
                          <Trash2 />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete {area.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            It has never had a task, so there is no history to
                            keep. This can't be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep it</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => run(() => deleteArea(area.id))}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </SortableAreaRow>
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="-mt-6 text-muted-foreground text-xs">
        Drag a row to reorder. On a phone, press and hold first.
      </p>

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

/**
 * A row you can drag by its handle or its text; the action buttons on the
 * right stay clickable. Keyboard: focus the handle, space, arrows, space.
 */
function SortableAreaRow({
  area,
  children,
}: {
  area: AreaRow;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: area.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 bg-background px-2 py-2",
        isDragging && "relative z-10 rounded-lg shadow-lg ring-1 ring-border",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${area.name}`}
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1 cursor-grab select-none" {...listeners}>
        <Link
          href={`/tasks?area=${area.id}`}
          className="inline-block hover:underline"
        >
          <AreaChip area={area} />
        </Link>
        <p className="mt-1 text-muted-foreground text-xs">
          {area.taskCount} task{area.taskCount === 1 ? "" : "s"}
          {area.dueCount ? ` · ${area.dueCount} due` : ""}
          {area.overdueCount ? ` · ${area.overdueCount} overdue` : ""}
        </p>
      </div>
      {children}
    </li>
  );
}

function EditAreaDialog({ area }: { area: AreaRow }) {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState(area.icon ?? "tag");
  const [colour, setColour] = useState(area.colour ?? "");
  const action = useCallback(
    (prev: ActionState, fd: FormData) => updateArea(area.id, prev, fd),
    [area.id],
  );
  const onSuccess = useCallback(() => setOpen(false), []);
  const [state, formAction] = useToastAction(action, onSuccess);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${area.name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Edit area</DialogTitle>
          </DialogHeader>
          <FormField
            id={`area-name-${area.id}`}
            label="Name"
            error={state?.fieldErrors?.name}
          >
            <Input
              id={`area-name-${area.id}`}
              name="name"
              defaultValue={area.name}
              required
              maxLength={60}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={`area-icon-${area.id}`} label="Icon">
              <NativeSelect
                id={`area-icon-${area.id}`}
                name="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
              >
                {AREA_ICONS.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id={`area-colour-${area.id}`} label="Colour">
              <NativeSelect
                id={`area-colour-${area.id}`}
                name="colour"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
              >
                <option value="">None</option>
                {AREA_COLOUR_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <p className="text-muted-foreground text-sm">
            Preview:{" "}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-xs",
                areaColourClass(colour || null),
              )}
            >
              <AreaIcon icon={icon} className="size-3" />
              {area.name}
            </span>
          </p>
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
