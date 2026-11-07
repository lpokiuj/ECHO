// Emails are case-insensitive: store and look them up in lowercase
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
