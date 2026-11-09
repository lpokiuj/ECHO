// Mirrors the backend rules in docs/api/public.md (POST /public/prayer-requests).
export const PRAYER_LIMITS = { content: 2000, name: 100, contact: 100 } as const
