import { z } from "zod";
import { isLocalDate } from "@/lib/dates";

export const localDateSchema = z
  .string()
  .refine(isLocalDate, "Enter a date")
  .refine((d) => !Number.isNaN(Date.parse(d)), "Enter a valid date");

const optionalText = z
  .string()
  .trim()
  .max(2000, "Keep it under 2000 characters")
  .transform((s) => (s.length ? s : null));

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "ESSENTIAL"] as const;
export const TASK_TYPES = ["RECURRING", "ONE_OFF"] as const;
export const ASSIGNMENT_MODES = ["FIXED", "ALTERNATE", "BALANCED"] as const;
export const RECURRENCE_UNITS = ["DAY", "WEEK", "MONTH", "YEAR"] as const;
export const RECURRENCE_ANCHORS = ["COMPLETION", "SCHEDULE"] as const;

const weekday = z.coerce.number().int().min(1).max(7);

export const taskInputSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name").max(120),
    areaId: z.string().min(1, "Pick an area"),
    estimatedMinutes: z.coerce
      .number({ error: "How many minutes?" })
      .int()
      .min(1, "At least a minute")
      .max(180, "Split anything over 3 hours into smaller jobs"),
    taskType: z.enum(TASK_TYPES),
    recurrenceValue: z.coerce.number().int().min(1).max(365).optional(),
    recurrenceUnit: z.enum(RECURRENCE_UNITS).optional(),
    recurrenceAnchor: z.enum(RECURRENCE_ANCHORS).default("COMPLETION"),
    assignmentMode: z.enum(ASSIGNMENT_MODES).default("BALANCED"),
    fixedAssigneeId: z
      .string()
      .transform((s) => (s.length ? s : null))
      .nullable()
      .default(null),
    /** Exactly one of these sets the first due date for a recurring task. */
    startMode: z.enum(["LAST_DONE", "FIRST_DUE", "NONE"]).default("FIRST_DUE"),
    startDate: z
      .string()
      .transform((s) => (s.length ? s : null))
      .nullable()
      .default(null),
    priority: z.enum(PRIORITIES).default("NORMAL"),
    unpleasant: z.coerce.boolean().default(false),
    dueSoonDays: z
      .union([z.literal(""), z.coerce.number().int().min(0).max(90)])
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .default(null),
    preferredWeekday: z
      .union([z.literal(""), weekday])
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .default(null),
    allowedWeekdays: z.array(weekday).default([]),
    notes: optionalText.default(null),
  })
  .superRefine((data, ctx) => {
    if (data.taskType === "RECURRING") {
      if (!data.recurrenceValue || !data.recurrenceUnit) {
        ctx.addIssue({
          code: "custom",
          path: ["recurrenceValue"],
          message: "How often does this need doing?",
        });
      }
      if (data.startMode === "NONE") {
        ctx.addIssue({
          code: "custom",
          path: ["startDate"],
          message: "Say when it was last done, or when it's first due",
        });
      }
    }
    if (data.startMode !== "NONE") {
      if (!data.startDate || !isLocalDate(data.startDate)) {
        ctx.addIssue({
          code: "custom",
          path: ["startDate"],
          message: "Enter a date",
        });
      }
    }
    if (data.assignmentMode === "FIXED" && !data.fixedAssigneeId) {
      ctx.addIssue({
        code: "custom",
        path: ["fixedAssigneeId"],
        message: "Who always does this?",
      });
    }
    if (
      data.preferredWeekday !== null &&
      data.allowedWeekdays.length > 0 &&
      !data.allowedWeekdays.includes(data.preferredWeekday)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["preferredWeekday"],
        message: "The preferred day must be one of the allowed days",
      });
    }
  });

export type TaskInput = z.infer<typeof taskInputSchema>;

export const completeTaskSchema = z.object({
  taskId: z.string().min(1),
  completedOn: localDateSchema.optional(),
  actualMinutes: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(600)])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null),
  note: optionalText.default(null),
});

export const deferTaskSchema = z.object({
  taskId: z.string().min(1),
  until: localDateSchema,
});

export const voidCompletionSchema = z.object({
  completionId: z.string().min(1),
  reason: z.string().trim().min(1, "Say why").max(500),
});

/** Turn a FormData into a plain object zod can parse; repeated keys become arrays. */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$")) continue; // Next internals
    const v = typeof value === "string" ? value : "";
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      const list = Array.isArray(out[k]) ? (out[k] as unknown[]) : [];
      list.push(v);
      out[k] = list;
    } else if (key in out) {
      const existing = out[key];
      out[key] = Array.isArray(existing) ? [...existing, v] : [existing, v];
    } else {
      out[key] = v;
    }
  }
  return out;
}
