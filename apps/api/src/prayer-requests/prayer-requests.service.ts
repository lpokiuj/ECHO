import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  cleanText,
  isHoneypotFilled,
  SUBMISSION_ACCEPTED,
} from '../public/submission.js';
import type { CreatePrayerRequestDto } from './dto/create-prayer-request.dto.js';
import { PrayerRequest } from './entities/prayer-request.entity.js';

@Injectable()
export class PrayerRequestsService {
  constructor(
    @InjectRepository(PrayerRequest)
    private readonly prayerRequests: Repository<PrayerRequest>,
  ) {}

  // Always answers { ok: true }. A filled honeypot is accepted but stores nothing.
  async create(dto: CreatePrayerRequestDto): Promise<typeof SUBMISSION_ACCEPTED> {
    if (isHoneypotFilled(dto.website)) return SUBMISSION_ACCEPTED;
    await this.prayerRequests.insert({
      name: cleanText(dto.name),
      contact: cleanText(dto.contact),
      wantsFollowUp: dto.wantsFollowUp === true,
      content: dto.content.trim(),
      consentAt: new Date(),
    });
    return SUBMISSION_ACCEPTED;
  }
}
