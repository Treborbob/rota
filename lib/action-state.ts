import type { ZodError } from "zod";

/** Result shape shared by every form-driven server action. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): ActionState {
  return { ok: false, message, fieldErrors };
}

export function success(message?: string): ActionState {
  return { ok: true, message };
}
