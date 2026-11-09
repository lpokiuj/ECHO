import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  buildUpdateStatement,
  type HandlerRow,
  type HandlerSummary,
  mapHandler,
  normalizePatch,
  SUBMISSION_TABLES,
} from '../admin-submissions/admin-submission.js';
import { VolunteerApplication } from './entities/volunteer-application.entity.js';
import type { VolunteerApplicationStatus } from './entities/volunteer-application.entity.js';

interface VolunteerApplicationRow extends HandlerRow {
  id: string;
  full_name: string;
  whatsapp: string;
  email: string | null;
  availability: string | null;
  message: string | null;
  bidang: { id: string; name: string }[];
  consent_at: Date;
  status: VolunteerApplicationStatus;
  admin_note: string | null;
  handled_at: Date | null;
  created_at: Date;
}

export interface AdminVolunteerApplication {
  id: string;
  fullName: string;
  whatsapp: string;
  email: string | null;
  availability: string | null;
  message: string | null;
  bidang: { id: string; name: string }[];
  consentAt: Date;
  status: VolunteerApplicationStatus;
  adminNote: string | null;
  handledBy: HandlerSummary | null;
  handledAt: Date | null;
  createdAt: Date;
}

// `a` is the application CTE or table; bidang names come from teams, sorted by name
const SELECT_COLUMNS = `a.*, u.id AS handler_id, u.name AS handler_name,
  COALESCE((
    SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name, t.id)
    FROM volunteer_application_bidang b JOIN teams t ON t.id = b.bidang_id
    WHERE b.application_id = a.id
  ), '[]'::json) AS bidang`;

function toItem(row: VolunteerApplicationRow): AdminVolunteerApplication {
  return {
    id: row.id,
    fullName: row.full_name,
    whatsapp: row.whatsapp,
    email: row.email,
    availability: row.availability,
    message: row.message,
    bidang: row.bidang,
    consentAt: row.consent_at,
    status: row.status,
    adminNote: row.admin_note,
    handledBy: mapHandler(row),
    handledAt: row.handled_at,
    createdAt: row.created_at,
  };
}

@Injectable()
export class AdminVolunteerApplicationsService {
  constructor(private readonly dataSource: DataSource) {}

  async findAll(
    status?: VolunteerApplicationStatus,
  ): Promise<AdminVolunteerApplication[]> {
    const rows: VolunteerApplicationRow[] = await this.dataSource.query(
      `SELECT ${SELECT_COLUMNS}
       FROM volunteer_applications a LEFT JOIN users u ON u.id = a.handled_by
       WHERE $1::volunteer_application_status IS NULL
          OR a.status = $1::volunteer_application_status
       ORDER BY a.created_at DESC, a.id`,
      [status ?? null],
    );
    return rows.map(toItem);
  }

  // One statement: UPDATE ... RETURNING, then handler name and bidang joined in.
  async update(
    actorId: string,
    id: string,
    dto: { status?: unknown; adminNote?: unknown },
  ): Promise<AdminVolunteerApplication> {
    const patch = normalizePatch(dto);
    const { sql, params } = buildUpdateStatement(
      SUBMISSION_TABLES.volunteerApplications,
      patch,
      actorId,
      id,
    );
    const rows: VolunteerApplicationRow[] = await this.dataSource.query(
      `WITH a AS (${sql})
       SELECT ${SELECT_COLUMNS}
       FROM a LEFT JOIN users u ON u.id = a.handled_by`,
      params,
    );
    if (rows.length === 0) {
      throw new NotFoundException('Volunteer application not found');
    }
    return toItem(rows[0]);
  }

  // Hard delete: DELETE ... RETURNING, 404 when nothing matched. The bidang
  // interest rows go with it (FK ON DELETE CASCADE).
  async remove(id: string): Promise<void> {
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(VolunteerApplication)
      .where('id = :id', { id })
      .returning('id')
      .execute();
    if ((result.raw as unknown[]).length === 0) {
      throw new NotFoundException('Volunteer application not found');
    }
  }
}
