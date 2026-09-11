---
name: new-server-action
description: Use when adding or changing a mutation — a server action that writes to the database from a form, button or dialog. Covers auth, validation, the ActionState contract, toasts, revalidation and re-planning, so new actions match the existing ones.
---

# New server action

Mutations are server actions in `lib/<feature>/actions.ts` under
`"use server"`. Route handlers exist only for auth. A `"use server"` file may
export async functions only; keep constants and schemas elsewhere.

## Shape

```ts
export async function doThing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();                       // 1. always
  const parsed = schema.safeParse(formDataToObject(formData));  // 2. zod, lib/validation
  if (!parsed.success) {
    return failure("Check the highlighted fields.", fieldErrorsFrom(parsed.error));
  }
  try {
    await db.$transaction((tx) => ...);                   // 3. atomic where it matters
  } catch (error) {
    return failure(userMessage(error, "Couldn't do that. Try again."));  // 4. never leak
  }
  await afterTaskChange(taskId);                          // 5. re-plan + revalidate
  return success("Done.");
}
```

Non-form actions take plain arguments, e.g. `pauseTask(taskId)`, and return
the same `ActionState`.

## Rules

1. `requireUser()` first. Never trust a user id from the client.
2. Validate with zod in `lib/validation/`; `formDataToObject` turns
   `name[]` fields into arrays.
3. Anything touching completion history goes through `recordCompletion` /
   `voidCompletion` in `lib/tasks/complete.ts`, inside `db.$transaction`.
4. Throw `DomainError` for messages a person may see; `userMessage()` hides
   everything else and logs it.
5. If the change affects what is due or who is free, call `afterTaskChange`
   (tasks) or `revalidatePlanPaths` + `generatePlan` (planning) so the plan
   stays consistent. Then `revalidatePath` every screen that shows it.
6. On the client, forms use `useToastAction(action, onSuccess)`; buttons use
   `useTransition` and toast on the result. Don't add a `useEffect` on the
   state to show a toast: the component may be unmounted by the refreshed
   tree before it runs.
7. Confirm destructive or semantically significant actions (skip, archive,
   void) with an `AlertDialog`.
8. Add a table-driven test if any pure logic was introduced; put that logic
   in `lib/domain/`, not in the action.
