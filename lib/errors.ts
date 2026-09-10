/**
 * An error whose message is written for the person using the app and is safe
 * to show them. Anything else that escapes an action is logged and replaced
 * with a generic message.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function userMessage(error: unknown, fallback: string): string {
  if (error instanceof DomainError) return error.message;
  console.error(error);
  return fallback;
}
