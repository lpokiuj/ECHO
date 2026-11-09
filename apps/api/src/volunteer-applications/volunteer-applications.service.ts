import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  cleanText,
  isHoneypotFilled,
  SUBMISSION_ACCEPTED,
} from '../public/submission.js';
import { normalizeEmail } from '../users/normalize-email.js';
import type { CreateVolunteerApplicationDto } from './dto/create-volunteer-application.dto.js';
import { VolunteerApplicationBidang } from './entities/volunteer-application-bidang.entity.js';
import { VolunteerApplication } from './entities/volunteer-application.entity.js';

const FOREIGN_KEY_VIOLATION = '23503';

@Injectable()
export class VolunteerApplicationsService {
  constructor(private readonly dataSource: DataSource) {}

  // Always answers { ok: true }. A filled honeypot is accepted but stores nothing.
  async create(
    dto: CreateVolunteerApplicationDto,
  ): Promise<typeof SUBMISSION_ACCEPTED> {
    if (isHoneypotFilled(dto.website)) return SUBMISSION_ACCEPTED;
    const email = cleanText(dto.email);
    const bidangIds = [...new Set(dto.bidangIds ?? [])];
    try {
      // One transaction: an unknown bidang id fails the FK and rolls back the
      // application too, so nothing is stored.
      await this.dataSource.transaction(async (manager) => {
        const { identifiers } = await manager.insert(VolunteerApplication, {
          fullName: dto.fullName.trim(),
          whatsapp: dto.whatsapp.trim(),
          email: email === null ? null : normalizeEmail(email),
          availability: cleanText(dto.availability),
          message: cleanText(dto.message),
          consentAt: new Date(),
        });
        const applicationId = identifiers[0].id as string;
        if (bidangIds.length > 0) {
          await manager.insert(
            VolunteerApplicationBidang,
            bidangIds.map((bidangId) => ({ applicationId, bidangId })),
          );
        }
      });
    } catch (err) {
      throw this.mapError(err);
    }
    return SUBMISSION_ACCEPTED;
  }

  private mapError(err: unknown): unknown {
    if (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string }).code === FOREIGN_KEY_VIOLATION
    ) {
      return new BadRequestException('One or more bidangIds do not exist');
    }
    return err;
  }
}
