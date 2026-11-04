import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

const FOREIGN_KEY_VIOLATION = '23503';

// Deleting an assignment that a recorded absence points at violates the FK.
// Turn that into a clear 409 instead of a 500. Other errors pass through.
export function mapAttendanceFkError(err: unknown): unknown {
  if (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string }).code === FOREIGN_KEY_VIOLATION
  ) {
    return new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      code: 'HAS_ATTENDANCE_RECORDS',
      message:
        'An absence is recorded for this assignment, so it cannot be removed',
    });
  }
  return err;
}
