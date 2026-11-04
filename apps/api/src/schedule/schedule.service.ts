import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ServiceAssignment } from '../assignments/entities/service-assignment.entity.js';
import { ServiceUnavailability } from '../availability/entities/service-unavailability.entity.js';
import { Service } from '../services/entities/service.entity.js';

export interface ScheduleAssignmentView {
  userId: string;
  name: string;
  teamId: string;
  teamName: string;
  notes: string;
  isAbsentTaker: boolean;
}

export interface ScheduleServiceView {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  unavailable: boolean;
  assignments: ScheduleAssignmentView[];
}

export interface MyScheduleItemView {
  serviceId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  teamId: string;
  teamName: string;
  notes: string;
  unavailable: boolean;
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(ServiceAssignment)
    private readonly assignments: Repository<ServiceAssignment>,
    @InjectRepository(ServiceUnavailability)
    private readonly unavailability: Repository<ServiceUnavailability>,
  ) {}

  // Open to every logged-in user: names only, never emails or account flags
  async listServices(
    userId: string,
    includePast: boolean,
  ): Promise<ScheduleServiceView[]> {
    const qb = this.services
      .createQueryBuilder('s')
      .orderBy('s.startsAt', 'ASC')
      .addOrderBy('s.title', 'ASC');
    if (!includePast) qb.where('s.endsAt > now()');
    const services = await qb.getMany();
    if (services.length === 0) return [];

    const rows = await this.assignments
      .createQueryBuilder('a')
      .innerJoin('a.user', 'u')
      .innerJoin('a.team', 't')
      .select('a.serviceId', 'serviceId')
      .addSelect('u.id', 'userId')
      .addSelect('u.name', 'name')
      .addSelect('t.id', 'teamId')
      .addSelect('t.name', 'teamName')
      .addSelect('a.notes', 'notes')
      .addSelect('a.isAbsentTaker', 'isAbsentTaker')
      .where('a.serviceId IN (:...ids)', { ids: services.map((s) => s.id) })
      .orderBy('t.name', 'ASC')
      .addOrderBy('u.name', 'ASC')
      .getRawMany<ScheduleAssignmentView & { serviceId: string }>();

    const byService = new Map<string, ScheduleAssignmentView[]>();
    for (const row of rows) {
      const { serviceId, ...rest } = row;
      const list = byService.get(serviceId) ?? [];
      list.push(rest);
      byService.set(serviceId, list);
    }

    const mine = await this.unavailability.findBy({
      userId,
      serviceId: In(services.map((s) => s.id)),
    });
    const mineIds = new Set(mine.map((m) => m.serviceId));

    return services.map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      unavailable: mineIds.has(s.id),
      assignments: byService.get(s.id) ?? [],
    }));
  }

  async listMine(
    userId: string,
    includePast: boolean,
  ): Promise<MyScheduleItemView[]> {
    const qb = this.assignments
      .createQueryBuilder('a')
      .innerJoin('a.service', 's') // soft-deleted services are filtered out
      .innerJoin('a.team', 't')
      .select('s.id', 'serviceId')
      .addSelect('s.title', 'title')
      .addSelect('s.startsAt', 'startsAt')
      .addSelect('s.endsAt', 'endsAt')
      .addSelect('t.id', 'teamId')
      .addSelect('t.name', 'teamName')
      .addSelect('a.notes', 'notes')
      .addSelect(
        `EXISTS (SELECT 1 FROM service_unavailability su
                 WHERE su.service_id = a.service_id AND su.user_id = a.user_id)`,
        'unavailable',
      )
      .where('a.userId = :userId', { userId })
      .orderBy('s.startsAt', 'ASC')
      .addOrderBy('s.title', 'ASC');
    if (!includePast) qb.andWhere('s.endsAt > now()');
    return qb.getRawMany<MyScheduleItemView>();
  }
}
