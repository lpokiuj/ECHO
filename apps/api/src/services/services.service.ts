import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { Service } from './entities/service.entity.js';

const CHECK_VIOLATION = '23514';

export interface ServiceView {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  createdBy: string;
  createdAt: Date;
}

const toView = (s: Service): ServiceView => ({
  id: s.id,
  title: s.title,
  startsAt: s.startsAt,
  endsAt: s.endsAt,
  createdBy: s.createdBy,
  createdAt: s.createdAt,
});

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service) private readonly services: Repository<Service>,
  ) {}

  async create(dto: CreateServiceDto, userId: string): Promise<ServiceView> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.assertRange(startsAt, endsAt);
    this.assertFuture(startsAt);
    try {
      const saved = await this.services.save({
        title: dto.title.trim(),
        startsAt,
        endsAt,
        createdBy: userId,
      });
      return toView(await this.services.findOneByOrFail({ id: saved.id }));
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async update(id: string, dto: UpdateServiceDto): Promise<ServiceView> {
    if (
      dto.title === undefined &&
      dto.startsAt === undefined &&
      dto.endsAt === undefined
    ) {
      throw new BadRequestException('Provide at least one field to update');
    }
    const existing = await this.services.findOneBy({ id });
    if (!existing) throw new NotFoundException('Service not found');

    const startsAt =
      dto.startsAt !== undefined ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt =
      dto.endsAt !== undefined ? new Date(dto.endsAt) : existing.endsAt;
    this.assertRange(startsAt, endsAt);
    // Only a requested startsAt change must be in the future, so a started
    // service can still have its title or endsAt edited.
    if (dto.startsAt !== undefined) this.assertFuture(startsAt);

    const changes: Partial<Service> = {};
    if (dto.title !== undefined) changes.title = dto.title.trim();
    if (dto.startsAt !== undefined) changes.startsAt = startsAt;
    if (dto.endsAt !== undefined) changes.endsAt = endsAt;
    try {
      const result = await this.services.update({ id }, changes);
      if (!result.affected) throw new NotFoundException('Service not found');
    } catch (err) {
      throw this.mapError(err);
    }
    return toView(await this.services.findOneByOrFail({ id }));
  }

  async remove(id: string): Promise<void> {
    const result = await this.services.softDelete({ id });
    if (!result.affected) throw new NotFoundException('Service not found');
  }

  private assertRange(startsAt: Date, endsAt: Date): void {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private assertFuture(startsAt: Date): void {
    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('startsAt must be in the future');
    }
  }

  private mapError(err: unknown): unknown {
    if (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string }).code === CHECK_VIOLATION
    ) {
      return new BadRequestException('endsAt must be after startsAt');
    }
    return err;
  }
}
