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

// Bodies copied verbatim from ../api/docs/api/services.md.
export const SERVICE_CREATED = {
  id: 'f13c4b91-112d-44ae-8c63-4ed9400ad52f',
  title: 'docs-example Service 1',
  startsAt: '2026-12-06T02:00:00.000Z',
  endsAt: '2026-12-06T04:00:00.000Z',
  createdBy: '4febc500-191d-4f5e-9929-b4e7eea31995',
  createdAt: '2026-10-31T18:32:07.099Z',
}
export const SERVICE_PATCHED = {
  id: 'c570c017-5e63-41b7-8290-6d9da522b837',
  title: 'docs-example Service 2 (renamed)',
  startsAt: '2026-12-13T02:00:00.000Z',
  endsAt: '2026-12-13T04:00:00.000Z',
  createdBy: '3ba66b7e-9a5f-4a7f-be68-8b012feae3a7',
  createdAt: '2026-10-31T18:32:07.140Z',
}
export const SERVICE_ERROR_BODIES = {
  titleTooLong: {
    message: ['title must be shorter than or equal to 150 characters'],
    error: 'Bad Request',
    statusCode: 400,
  },
  noOffset: {
    message: ['startsAt must include a timezone offset (Z or +HH:MM)'],
    error: 'Bad Request',
    statusCode: 400,
  },
  endBeforeStart: {
    message: 'endsAt must be after startsAt',
    error: 'Bad Request',
    statusCode: 400,
  },
  startNotFuture: {
    message: 'startsAt must be in the future',
    error: 'Bad Request',
    statusCode: 400,
  },
  emptyPatch: {
    message: 'Provide at least one field to update',
    error: 'Bad Request',
    statusCode: 400,
  },
}

// Bodies copied verbatim from ../api/docs/api/assignments.md.
export const CANDIDATES_EXAMPLE = [
  { userId: 'aafeafcb-ef7f-4b60-bbcf-70d762f8ff28', name: 'Enji', assigned: true },
  { userId: 'db93ae8c-9da7-4be1-bcc8-2c72c12033da', name: 'Giana', assigned: false },
  { userId: 'f269b9ce-a215-46c8-a444-0aaced5232f9', name: 'Livana', assigned: false },
  { userId: '73fbd314-9793-4bf3-b217-4ab94b7be54f', name: 'Lukas', assigned: false },
]
export const ASSIGN_ALL_ASSIGNED = {
  assigned: ['be218193-9844-482b-b44d-575c49d2e16f', '85c483d5-d17f-495d-a088-78f652357e4d'],
  skipped: [],
}
export const ASSIGN_IDEMPOTENT = {
  assigned: [],
  skipped: [
    { userId: 'be218193-9844-482b-b44d-575c49d2e16f', reason: 'ALREADY_ASSIGNED_THIS_TEAM' },
  ],
}
export const ASSIGN_PARTIAL = {
  assigned: ['cdcac924-5fa6-45c0-9a0e-3b84845ca1e5'],
  skipped: [
    {
      userId: 'be218193-9844-482b-b44d-575c49d2e16f',
      reason: 'ALREADY_ASSIGNED_OTHER_TEAM',
      heldByTeam: { id: 'd582b5a4-4814-4e8b-9f2a-f21c8a956e35', name: 'docs-example-team-a' },
    },
  ],
}
export const INVALID_USERS_BODY = {
  statusCode: 400,
  error: 'Bad Request',
  code: 'INVALID_USERS',
  message: 'Some users are not active members of this team',
  invalidUserIds: ['85c483d5-d17f-495d-a088-78f652357e4d'],
}
export const ASSIGNMENT_NOT_FOUND = {
  message: 'Assignment not found',
  error: 'Not Found',
  statusCode: 404,
}
