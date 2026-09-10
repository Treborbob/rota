"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FormField } from "@/components/form-field";
import { PendingButton } from "@/components/pending-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToastAction } from "@/components/use-action-toast";
import type { ActionState } from "@/lib/action-state";
import { WEEKDAY_LABELS } from "@/lib/capacity";
import {
  formatFriendlyDate,
  isLocalDate,
  type LocalDate,
  todayLocal,
} from "@/lib/dates";
import {
  addInterval,
  describeCadence,
  type RecurrenceUnit,
} from "@/lib/domain/recurrence";
import type { Member } from "@/lib/members";
import type { TaskView } from "@/lib/tasks/view";
import {
  ASSIGNMENT_MODES,
  PRIORITIES,
  RECURRENCE_UNITS,
} from "@/lib/validation/task";

type Area = { id: string; name: string };

const PRIORITY_LABELS: Record<(typeof PRIORITIES)[number], string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  ESSENTIAL: "Essential",
};

const ASSIGNMENT_LABELS: Record<(typeof ASSIGNMENT_MODES)[number], string> = {
  BALANCED: "Whoever's free",
  ALTERNATE: "Take turns",
  FIXED: "Always the same person",
};

const UNIT_LABELS: Record<RecurrenceUnit, [string, string]> = {
  DAY: ["day", "days"],
  WEEK: ["week", "weeks"],
  MONTH: ["month", "months"],
  YEAR: ["year", "years"],
};

export function TaskForm({
  areas,
  members,
  initial,
  action,
  submitLabel,
  cancelHref,
}: {
  areas: Area[];
  members: Member[];
  initial?: TaskView;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useToastAction(action);
  const errors = state?.fieldErrors ?? {};

  const [taskType, setTaskType] = useState(initial?.taskType ?? "RECURRING");
  const [recurrenceValue, setRecurrenceValue] = useState(
    String(initial?.recurrence?.value ?? 1),
  );
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>(
    initial?.recurrence?.unit ?? "WEEK",
  );
  const [startMode, setStartMode] = useState<
    "LAST_DONE" | "FIRST_DUE" | "NONE"
  >(initial ? (initial.nextDueOn ? "FIRST_DUE" : "NONE") : "FIRST_DUE");
  const [startDate, setStartDate] = useState<string>(
    initial?.nextDueOn ?? todayLocal(),
  );
  const [assignmentMode, setAssignmentMode] = useState(
    initial?.assignmentMode ?? "BALANCED",
  );
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(
      initial &&
        (initial.priority !== "NORMAL" ||
          initial.unpleasant ||
          initial.dueSoonDays !== null ||
          initial.preferredWeekday !== null ||
          initial.allowedWeekdays.length > 0 ||
          initial.recurrence?.anchor === "SCHEDULE" ||
          initial.notes),
    ),
  );

  const preview = useMemo(() => {
    const value = Number(recurrenceValue);
    const hasRecurrence = taskType === "RECURRING" && value >= 1;
    const cadence = hasRecurrence
      ? describeCadence({ value, unit: recurrenceUnit })
      : "One-off";
    if (startMode === "NONE" || !isLocalDate(startDate)) {
      return hasRecurrence ? cadence : "One-off, whenever";
    }
    let due: LocalDate = startDate;
    if (startMode === "LAST_DONE") {
      if (!hasRecurrence) return "One-off";
      due = addInterval(startDate, { value, unit: recurrenceUnit });
    }
    return `${cadence}, next due ${formatFriendlyDate(due)}`;
  }, [taskType, recurrenceValue, recurrenceUnit, startMode, startDate]);

  const plural = Number(recurrenceValue) === 1 ? 0 : 1;

  return (
    <form action={formAction} className="space-y-8">
      <section className="space-y-5">
        <FormField id="name" label="Name" error={errors.name}>
          <Input
            id="name"
            name="name"
            required
            autoFocus={!initial}
            defaultValue={initial?.name ?? ""}
            placeholder="Vacuum the lounge"
            aria-invalid={Boolean(errors.name)}
          />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="areaId" label="Area" error={errors.areaId}>
            <NativeSelect
              id="areaId"
              name="areaId"
              required
              defaultValue={initial?.area.id ?? ""}
              aria-invalid={Boolean(errors.areaId)}
            >
              <option value="" disabled>
                Choose an area
              </option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField
            id="estimatedMinutes"
            label="Minutes"
            error={errors.estimatedMinutes}
          >
            <Input
              id="estimatedMinutes"
              name="estimatedMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={180}
              required
              defaultValue={initial?.estimatedMinutes ?? 15}
              aria-invalid={Boolean(errors.estimatedMinutes)}
            />
          </FormField>
        </div>

        <fieldset className="space-y-2">
          <legend className="font-medium text-sm">How often</legend>
          <div className="flex gap-2">
            <SegmentedOption
              name="taskType"
              value="RECURRING"
              checked={taskType === "RECURRING"}
              onChange={() => setTaskType("RECURRING")}
            >
              Recurring
            </SegmentedOption>
            <SegmentedOption
              name="taskType"
              value="ONE_OFF"
              checked={taskType === "ONE_OFF"}
              onChange={() => setTaskType("ONE_OFF")}
            >
              One-off
            </SegmentedOption>
          </div>
          {taskType === "RECURRING" ? (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm">Every</span>
              <Input
                name="recurrenceValue"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={recurrenceValue}
                onChange={(e) => setRecurrenceValue(e.target.value)}
                aria-label="Interval"
                aria-invalid={Boolean(errors.recurrenceValue)}
                className="w-20"
              />
              <NativeSelect
                name="recurrenceUnit"
                value={recurrenceUnit}
                onChange={(e) =>
                  setRecurrenceUnit(e.target.value as RecurrenceUnit)
                }
                aria-label="Unit"
                className="w-32"
              >
                {RECURRENCE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u][plural]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          {errors.recurrenceValue ? (
            <p role="alert" className="text-destructive text-sm">
              {errors.recurrenceValue}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-medium text-sm">
            {initial ? "Next due" : "Starting point"}
          </legend>
          <div className="flex flex-wrap gap-2">
            <SegmentedOption
              name="startMode"
              value="FIRST_DUE"
              checked={startMode === "FIRST_DUE"}
              onChange={() => setStartMode("FIRST_DUE")}
            >
              {initial ? "Due on" : "First due"}
            </SegmentedOption>
            {taskType === "RECURRING" ? (
              <SegmentedOption
                name="startMode"
                value="LAST_DONE"
                checked={startMode === "LAST_DONE"}
                onChange={() => setStartMode("LAST_DONE")}
              >
                Last done
              </SegmentedOption>
            ) : (
              <SegmentedOption
                name="startMode"
                value="NONE"
                checked={startMode === "NONE"}
                onChange={() => setStartMode("NONE")}
              >
                Whenever
              </SegmentedOption>
            )}
          </div>
          {startMode !== "NONE" ? (
            <Input
              name="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label={startMode === "LAST_DONE" ? "Last done on" : "Due on"}
              aria-invalid={Boolean(errors.startDate)}
              className="w-44"
            />
          ) : null}
          {errors.startDate ? (
            <p role="alert" className="text-destructive text-sm">
              {errors.startDate}
            </p>
          ) : null}
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {preview}
          </p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-medium text-sm">Who does it</legend>
          <div className="flex flex-wrap gap-2">
            {ASSIGNMENT_MODES.map((mode) => (
              <SegmentedOption
                key={mode}
                name="assignmentMode"
                value={mode}
                checked={assignmentMode === mode}
                onChange={() => setAssignmentMode(mode)}
              >
                {ASSIGNMENT_LABELS[mode]}
              </SegmentedOption>
            ))}
          </div>
          {assignmentMode === "FIXED" ? (
            <div className="pt-1">
              <NativeSelect
                name="fixedAssigneeId"
                defaultValue={initial?.fixedAssignee?.id ?? ""}
                aria-label="Always done by"
                aria-invalid={Boolean(errors.fixedAssigneeId)}
                className="w-56"
              >
                <option value="">Choose who</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
              {errors.fixedAssigneeId ? (
                <p role="alert" className="mt-1 text-destructive text-sm">
                  {errors.fixedAssigneeId}
                </p>
              ) : null}
            </div>
          ) : null}
        </fieldset>
      </section>

      <section className="rounded-xl border">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
          className="flex min-h-11 w-full items-center justify-between px-4 text-left font-medium text-sm"
        >
          More options
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div className={advancedOpen ? "space-y-5 border-t p-4" : "hidden"}>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="priority" label="Priority" error={errors.priority}>
              <NativeSelect
                id="priority"
                name="priority"
                defaultValue={initial?.priority ?? "NORMAL"}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              id="dueSoonDays"
              label="Show as due soon"
              hint="Days before it's due. Leave blank for the household default."
              error={errors.dueSoonDays}
            >
              <Input
                id="dueSoonDays"
                name="dueSoonDays"
                type="number"
                inputMode="numeric"
                min={0}
                max={90}
                defaultValue={initial?.dueSoonDays ?? ""}
              />
            </FormField>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="unpleasant">Unpleasant job</Label>
              <p className="text-muted-foreground text-sm">
                Kept off the "something nice" list and spread out between you.
              </p>
            </div>
            <Switch
              id="unpleasant"
              name="unpleasant"
              value="true"
              defaultChecked={initial?.unpleasant ?? false}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="font-medium text-sm">Allowed days</legend>
            <p className="text-muted-foreground text-sm">
              Leave all unticked for any day.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, i) => (
                <label
                  key={label}
                  className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-sm has-checked:border-primary has-checked:bg-accent"
                >
                  <input
                    type="checkbox"
                    name="allowedWeekdays[]"
                    value={i + 1}
                    defaultChecked={
                      initial?.allowedWeekdays.includes(i + 1) ?? false
                    }
                    className="accent-primary"
                  />
                  {label.slice(0, 3)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="preferredWeekday"
              label="Preferred day"
              error={errors.preferredWeekday}
            >
              <NativeSelect
                id="preferredWeekday"
                name="preferredWeekday"
                defaultValue={initial?.preferredWeekday ?? ""}
                aria-invalid={Boolean(errors.preferredWeekday)}
              >
                <option value="">No preference</option>
                {WEEKDAY_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {taskType === "RECURRING" ? (
              <FormField
                id="recurrenceAnchor"
                label="Count the gap from"
                error={errors.recurrenceAnchor}
              >
                <NativeSelect
                  id="recurrenceAnchor"
                  name="recurrenceAnchor"
                  defaultValue={initial?.recurrence?.anchor ?? "COMPLETION"}
                >
                  <option value="COMPLETION">When it was actually done</option>
                  <option value="SCHEDULE">A fixed calendar cadence</option>
                </NativeSelect>
              </FormField>
            ) : null}
          </div>

          <FormField id="notes" label="Notes" error={errors.notes}>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={initial?.notes ?? ""}
              placeholder="Where the descaler lives, which setting to use…"
            />
          </FormField>
        </div>
      </section>

      {state && !state.ok && state.message ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <PendingButton pendingLabel="Saving…">{submitLabel}</PendingButton>
        <Button variant="ghost" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

function SegmentedOption({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm has-checked:border-primary has-checked:bg-accent has-checked:font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50 md:min-h-9">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {children}
    </label>
  );
}
