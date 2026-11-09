const DEFAULT_PORTAL_URL = '/volunteer-portal/'

/** Where "Portal Relawan" points: VITE_PORTAL_URL, or the same-origin portal path by default. */
export function getPortalUrl(): string {
  const value = import.meta.env.VITE_PORTAL_URL?.trim()
  return value ? value : DEFAULT_PORTAL_URL
}
