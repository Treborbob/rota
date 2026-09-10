"use client";

import { useActionState, useCallback } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";

type FormAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * useActionState with the result surfaced as a toast.
 *
 * The toast fires inside the action wrapper, before React commits the
 * refreshed server tree. An effect would be too late: when the action
 * revalidates, the component that owns the form may be gone by then.
 */
export function useToastAction(
  action: FormAction,
  onSuccess?: () => void,
): ReturnType<typeof useActionState<ActionState, FormData>> {
  const wrapped = useCallback<FormAction>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result?.ok) {
        if (result.message) toast.success(result.message);
        onSuccess?.();
      } else if (result?.message) {
        toast.error(result.message);
      }
      return result;
    },
    [action, onSuccess],
  );
  return useActionState(wrapped, null);
}
