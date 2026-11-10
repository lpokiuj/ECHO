import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminEventsController } from './admin-events.controller.js';
import { Event } from './entities/event.entity.js';
import { EventsService } from './events.service.js';
import { PublicEventsController } from './public-events.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Event])],
  controllers: [PublicEventsController, AdminEventsController],
  providers: [EventsService],
})
export class EventsModule {}
