import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.js';
import {
  PUBLIC_POST_LIMIT,
  PUBLIC_POST_WINDOW_MS,
} from '../public/submission.js';
import { CreateVolunteerApplicationDto } from './dto/create-volunteer-application.dto.js';
import { VolunteerApplicationsService } from './volunteer-applications.service.js';

@Controller('public/volunteer-applications')
export class PublicVolunteerApplicationsController {
  constructor(private readonly applications: VolunteerApplicationsService) {}

  // Rate limited per IP for this endpoint only (no global throttle guard)
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: PUBLIC_POST_LIMIT, ttl: PUBLIC_POST_WINDOW_MS },
  })
  @Post()
  create(@Body() dto: CreateVolunteerApplicationDto) {
    return this.applications.create(dto);
  }
}
