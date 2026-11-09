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
import type { PrayerRequestStatus } from './entities/prayer-request.entity.js';
import { PrayerRequest } from './entities/prayer-request.entity.js';

interface PrayerRequestRow extends HandlerRow {
  id: string;
  name: string | null;
  contact: string | null;
  wants_follow_up: boolean;
  content: string;
  consent_at: Date;
  status: PrayerRequestStatus;
  admin_note: string | null;
  handled_at: Date | null;
  created_at: Date;
}

export interface AdminPrayerRequest {
  id: string;
  name: string | null;
  contact: string | null;
  wantsFollowUp: boolean;
  content: string;
  consentAt: Date;
  status: PrayerRequestStatus;
  adminNote: string | null;
  handledBy: HandlerSummary | null;
  handledAt: Date | null;
  createdAt: Date;
}

const SELECT_WITH_HANDLER = `SELECT p.*, u.id AS handler_id, u.name AS handler_name
  FROM prayer_requests p LEFT JOIN users u ON u.id = p.handled_by`;

function toItem(row: PrayerRequestRow): AdminPrayerRequest {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    wantsFollowUp: row.wants_follow_up,
    content: row.content,
    consentAt: row.consent_at,
    status: row.status,
    adminNote: row.admin_note,
    handledBy: mapHandler(row),
    handledAt: row.handled_at,
    createdAt: row.created_at,
  };
}

@Injectable()
export class AdminPrayerRequestsService {
  constructor(private readonly dataSource: DataSource) {}

  async findAll(status?: PrayerRequestStatus): Promise<AdminPrayerRequest[]> {
    const rows: PrayerRequestRow[] = await this.dataSource.query(
      `${SELECT_WITH_HANDLER}
       WHERE $1::prayer_request_status IS NULL OR p.status = $1::prayer_request_status
       ORDER BY p.created_at DESC, p.id`,
      [status ?? null],
    );
    return rows.map(toItem);
  }

  // One statement: UPDATE ... RETURNING, then the handler's name joined in.
  async update(
    actorId: string,
    id: string,
    dto: { status?: unknown; adminNote?: unknown },
  ): Promise<AdminPrayerRequest> {
    const patch = normalizePatch(dto);
    const { sql, params } = buildUpdateStatement(
      SUBMISSION_TABLES.prayerRequests,
      patch,
      actorId,
      id,
    );
    const rows: PrayerRequestRow[] = await this.dataSource.query(
      `WITH p AS (${sql})
       SELECT p.*, u.id AS handler_id, u.name AS handler_name
       FROM p LEFT JOIN users u ON u.id = p.handled_by`,
      params,
    );
    if (rows.length === 0) throw new NotFoundException('Prayer request not found');
    return toItem(rows[0]);
  }

  // Hard delete: DELETE ... RETURNING, 404 when nothing matched
  async remove(id: string): Promise<void> {
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(PrayerRequest)
      .where('id = :id', { id })
      .returning('id')
      .execute();
    if ((result.raw as unknown[]).length === 0) {
      throw new NotFoundException('Prayer request not found');
    }
  }
}
