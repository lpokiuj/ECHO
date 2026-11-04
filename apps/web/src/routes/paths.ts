export const PATHS = {
  home: '/',
  login: '/login',
  changePassword: '/change-password',
  mySchedule: '/my-schedule',
  fullSchedule: '/schedule',
  services: '/services',
  assign: '/assign',
  attendance: '/attendance',
  users: '/users',
  teams: '/teams',
  team: (id: string) => `/teams/${encodeURIComponent(id)}`,
} as const
