// Mirrors the backend rules in docs/api/public.md (POST /public/volunteer-applications).
export const VOLUNTEER_LIMITS = {
  fullName: 100,
  whatsapp: 30,
  email: 255,
  availability: 500,
  message: 1000,
  bidangIds: 20,
} as const
