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
