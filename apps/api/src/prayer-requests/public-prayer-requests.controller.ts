import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.js';
import {
  PUBLIC_POST_LIMIT,
  PUBLIC_POST_WINDOW_MS,
} from '../public/submission.js';
import { CreatePrayerRequestDto } from './dto/create-prayer-request.dto.js';
import { PrayerRequestsService } from './prayer-requests.service.js';

@Controller('public/prayer-requests')
export class PublicPrayerRequestsController {
  constructor(private readonly prayerRequests: PrayerRequestsService) {}

  // Rate limited per IP for this endpoint only (no global throttle guard)
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: PUBLIC_POST_LIMIT, ttl: PUBLIC_POST_WINDOW_MS },
  })
  @Post()
  create(@Body() dto: CreatePrayerRequestDto) {
    return this.prayerRequests.create(dto);
  }
}
