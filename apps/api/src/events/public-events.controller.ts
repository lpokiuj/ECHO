import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.js';
import { EventsService } from './events.service.js';

@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly events: EventsService) {}

  // Upcoming events only, soonest first; id, title, startsAt, location, description
  @Public()
  @Get()
  list() {
    return this.events.findUpcoming();
  }
}
