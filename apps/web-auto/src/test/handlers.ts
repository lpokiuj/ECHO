import { HttpResponse, http } from 'msw'

// Bodies copied from ../api/docs/api/ (README.md and auth.md).
export const LOGIN_OK = { accessToken: '<accessToken>' }

export const ME_EXAMPLE = {
  id: 'd50ed778-821b-47f1-8992-475f525b4097',
  name: 'Docs Example Lead A',
  email: 'docs-example-lead-a@echo.local',
  role: 'MEMBER',
  mustChangePassword: false,
  memberships: [
    {
      teamId: 'd582b5a4-4814-4e8b-9f2a-f21c8a956e35',
      teamName: 'docs-example-team-a',
      isLeader: true,
    },
  ],
}

// Same shape as ME_EXAMPLE (auth.md); only role, mustChangePassword and memberships vary.
const NO_TEAMS: typeof ME_EXAMPLE.memberships = []
export const ME_BY_ROLE = {
  member: {
    ...ME_EXAMPLE,
    memberships: [{ ...ME_EXAMPLE.memberships[0]!, isLeader: false }],
  },
  leader: ME_EXAMPLE,
  pembina: { ...ME_EXAMPLE, role: 'PEMBINA', memberships: NO_TEAMS },
  admin: { ...ME_EXAMPLE, role: 'ADMIN', memberships: NO_TEAMS },
  mustChange: { ...ME_EXAMPLE, mustChangePassword: true },
}

export const ERROR_BODIES = {
  validationArray: {
    message: ['email must be an email', 'password must be longer than or equal to 1 characters'],
    error: 'Bad Request',
    statusCode: 400,
  },
  validationString: {
    message: 'endsAt must be after startsAt',
    error: 'Bad Request',
    statusCode: 400,
  },
  unauthorized: { message: 'Unauthorized', statusCode: 401 },
  forbidden: { message: 'Forbidden', statusCode: 403 },
  passwordChangeRequired: {
    statusCode: 403,
    error: 'Forbidden',
    code: 'PASSWORD_CHANGE_REQUIRED',
    message: 'You must change your password first',
  },
  notFound: { message: 'Service not found', error: 'Not Found', statusCode: 404 },
  conflict: { message: 'Email already in use', error: 'Conflict', statusCode: 409 },
  serviceStarted: {
    message: 'Service already started',
    error: 'Conflict',
    code: 'SERVICE_ALREADY_STARTED',
    statusCode: 409,
  },
}

export const respond = (status: number, body: unknown, headers?: Record<string, string>) =>
  HttpResponse.json(body as Record<string, unknown>, { status, headers })

export const handlers = {
  me: (headers?: Record<string, string>, body: typeof ME_EXAMPLE = ME_EXAMPLE) =>
    http.get('*/api/me', () => HttpResponse.json(body, { headers })),
}

// Bodies copied verbatim from ../api/docs/api/schedule.md.
export const SERVICES_EXAMPLE = [
  {
    id: 'e9ae933a-fe76-4f62-95a4-d3b4db8f27ae',
    title: 'Sunday Service',
    startsAt: '2026-11-01T03:00:00.000Z',
    endsAt: '2026-11-01T05:00:00.000Z',
    assignments: [
      {
        userId: 'aafeafcb-ef7f-4b60-bbcf-70d762f8ff28',
        name: 'Enji',
        teamId: '681e9003-157a-4f26-9b69-a39af059d88b',
        teamName: 'Worship',
      },
    ],
  },
  {
    id: '00adcf97-63e1-4dc6-a319-46fe3f93e922',
    title: 'KEEP 1',
    startsAt: '2026-11-20T15:26:31.938Z',
    endsAt: '2026-11-20T17:50:31.938Z',
    assignments: [
      {
        userId: '8bbc624a-3766-40b0-a32c-321f33524dc4',
        name: 'Agner',
        teamId: '77256f56-93fc-46e9-b360-ca69f8b3263a',
        teamName: 'Sound',
      },
      {
        userId: 'db93ae8c-9da7-4be1-bcc8-2c72c12033da',
        name: 'Giana',
        teamId: '681e9003-157a-4f26-9b69-a39af059d88b',
        teamName: 'Worship',
      },
    ],
  },
]

export const MY_SCHEDULE_EXAMPLE = [
  {
    serviceId: '00adcf97-63e1-4dc6-a319-46fe3f93e922',
    title: 'KEEP 1',
    startsAt: '2026-11-20T15:26:31.938Z',
    endsAt: '2026-11-20T17:50:31.938Z',
    teamId: '77256f56-93fc-46e9-b360-ca69f8b3263a',
    teamName: 'Sound',
  },
]

export const INCLUDE_PAST_BAD = {
  message: ['includePast must be true or false'],
  error: 'Bad Request',
  statusCode: 400,
}
