import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { cleanText } from '../public/submission.js';

export const ADMIN_NOTE_MAX_LENGTH = 1000;

// Trims strings; a blank string becomes null (clears the note). null and other
// types pass through, so the validators decide.
export const AdminNoteText = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value,
  );

// Fixed whitelists: table, enum and column names in SQL come only from here.
export const SUBMISSION_TABLES = {
  prayerRequests: { table: 'prayer_requests', statusEnum: 'prayer_request_status' },
  volunteerApplications: {
    table: 'volunteer_applications',
    statusEnum: 'volunteer_application_status',
  },
} as const;

export type SubmissionTable =
  (typeof SUBMISSION_TABLES)[keyof typeof SUBMISSION_TABLES];

export interface SubmissionPatch {
  status?: string;
  adminNote?: string | null;
}

export interface HandlerRow {
  handler_id: string | null;
  handler_name: string | null;
}

export interface HandlerSummary {
  id: string;
  name: string;
}

// The ValidationPipe may hand over the raw body, so normalize again here.
// An empty patch (no status and no adminNote) is a 400.
export function normalizePatch(dto: {
  status?: unknown;
  adminNote?: unknown;
}): SubmissionPatch {
  const patch: SubmissionPatch = {};
  if (dto.status !== undefined) patch.status = dto.status as string;
  if (dto.adminNote !== undefined) patch.adminNote = cleanText(dto.adminNote);
  if (patch.status === undefined && patch.adminNote === undefined) {
    throw new BadRequestException('Provide status or adminNote');
  }
  return patch;
}

// UPDATE ... RETURNING * as one statement (no check-then-update). Values are
// bound parameters; only fixed column names are written into the SQL.
export function buildUpdateStatement(
  target: SubmissionTable,
  patch: SubmissionPatch,
  actorId: string,
  id: string,
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const sets: string[] = [];
  if (patch.status !== undefined) {
    params.push(patch.status);
    sets.push(`status = $${params.length}::${target.statusEnum}`);
  }
  if (patch.adminNote !== undefined) {
    params.push(patch.adminNote);
    sets.push(`admin_note = $${params.length}`);
  }
  params.push(actorId);
  sets.push(`handled_by = $${params.length}::uuid`);
  sets.push('handled_at = now()');
  params.push(id);
  const sql = `UPDATE ${target.table} SET ${sets.join(', ')} WHERE id = $${params.length}::uuid RETURNING *`;
  return { sql, params };
}

export function mapHandler(row: HandlerRow): HandlerSummary | null {
  if (row.handler_id === null || row.handler_name === null) return null;
  return { id: row.handler_id, name: row.handler_name };
}
