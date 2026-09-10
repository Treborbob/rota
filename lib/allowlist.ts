/**
 * The whole access-control model: a comma-separated list of Google email
 * addresses in ROTA_ALLOWED_EMAILS. Nobody else can sign in.
 */

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAllowedEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map(normaliseEmail)
      .filter((e) => e.length > 0),
  );
}

export function isAllowedEmail(
  email: string | null | undefined,
  raw: string | undefined = process.env.ROTA_ALLOWED_EMAILS,
): boolean {
  if (!email) return false;
  return parseAllowedEmails(raw).has(normaliseEmail(email));
}
