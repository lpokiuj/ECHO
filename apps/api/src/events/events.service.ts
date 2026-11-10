import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { Event } from './entities/event.entity.js';

export interface AdminEventView {
  id: string;
  title: string;
  startsAt: Date;
  location: string;
  description: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicEventView {
  id: string;
  title: string;
  startsAt: Date;
  location: string;
  description: string;
}

const toAdminView = (e: Event): AdminEventView => ({
  id: e.id,
  title: e.title,
  startsAt: e.startsAt,
  location: e.location,
  description: e.description,
  createdBy: e.createdBy,
  createdAt: e.createdAt,
  updatedAt: e.updatedAt,
});

// Mapped explicitly so no future column can leak onto the public route
const toPublicView = (e: Event): PublicEventView => ({
  id: e.id,
  title: e.title,
  startsAt: e.startsAt,
  location: e.location,
  description: e.description,
});

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
  ) {}

  // All events, newest start first
  async findAll(): Promise<AdminEventView[]> {
    const rows = await this.events.find({
      order: { startsAt: 'DESC', id: 'ASC' },
    });
    return rows.map(toAdminView);
  }

  // Upcoming only, soonest first
  async findUpcoming(): Promise<PublicEventView[]> {
    const rows = await this.events.find({
      where: { startsAt: MoreThanOrEqual(new Date()) },
      order: { startsAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toPublicView);
  }

  async create(dto: CreateEventDto, userId: string): Promise<AdminEventView> {
    const saved = await this.events.save({
      title: dto.title.trim(),
      startsAt: new Date(dto.startsAt),
      location: dto.location.trim(),
      description: dto.description.trim(),
      createdBy: userId,
    });
    return toAdminView(await this.events.findOneByOrFail({ id: saved.id }));
  }

  async update(id: string, dto: UpdateEventDto): Promise<AdminEventView> {
    const changes: Partial<Event> = {};
    if (dto.title !== undefined) changes.title = dto.title.trim();
    if (dto.startsAt !== undefined) changes.startsAt = new Date(dto.startsAt);
    if (dto.location !== undefined) changes.location = dto.location.trim();
    if (dto.description !== undefined) {
      changes.description = dto.description.trim();
    }
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }
    const result = await this.events.update({ id }, changes);
    if (!result.affected) throw new NotFoundException('Event not found');
    return toAdminView(await this.events.findOneByOrFail({ id }));
  }

  // Hard delete: the row is gone
  async remove(id: string): Promise<void> {
    const result = await this.events.delete({ id });
    if (!result.affected) throw new NotFoundException('Event not found');
  }
}
