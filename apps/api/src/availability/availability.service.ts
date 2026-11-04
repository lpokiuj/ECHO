import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Service } from '../services/entities/service.entity.js';
import { lockAssignmentSlots } from './assignment-lock.js';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Service) private readonly services: Repository<Service>,
    private readonly dataSource: DataSource,
  ) {}

  async markUnavailable(serviceId: string, userId: string): Promise<void> {
    await this.loadUpcoming(serviceId);
    await this.dataSource.transaction(async (manager) => {
      await lockAssignmentSlots(manager, serviceId, [userId]);
      // One statement: the insert itself refuses an assigned user
      const inserted: { user_id: string }[] = await manager.query(
        `INSERT INTO service_unavailability (service_id, user_id)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM service_assignments WHERE service_id = $1 AND user_id = $2
         )
         ON CONFLICT (service_id, user_id) DO NOTHING
         RETURNING user_id`,
        [serviceId, userId],
      );
      if (inserted.length > 0) return;
      // Nothing inserted: either already unavailable (fine, idempotent) or
      // assigned. The lookup only explains a refused write.
      const assigned: unknown[] = await manager.query(
        `SELECT 1 FROM service_assignments WHERE service_id = $1 AND user_id = $2`,
        [serviceId, userId],
      );
      if (assigned.length > 0) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'ALREADY_ASSIGNED',
          message:
            'You are assigned to this service. Ask your team leader to unassign you first',
        });
      }
    });
  }

  async markAvailable(serviceId: string, userId: string): Promise<void> {
    await this.loadUpcoming(serviceId);
    await this.dataSource.query(
      `DELETE FROM service_unavailability WHERE service_id = $1 AND user_id = $2`,
      [serviceId, userId],
    );
  }

  // Ids of upcoming, non-deleted services the user marked unavailable
  async listMine(userId: string): Promise<string[]> {
    const rows: { service_id: string }[] = await this.dataSource.query(
      `SELECT su.service_id
       FROM service_unavailability su
       JOIN services s ON s.id = su.service_id
       WHERE su.user_id = $1 AND s.deleted_at IS NULL AND s.starts_at > now()
       ORDER BY s.starts_at, su.service_id`,
      [userId],
    );
    return rows.map((r) => r.service_id);
  }

  private async loadUpcoming(serviceId: string): Promise<Service> {
    const service = await this.services.findOneBy({ id: serviceId });
    if (!service) throw new NotFoundException('Service not found');
    if (service.startsAt.getTime() <= Date.now()) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SERVICE_ALREADY_STARTED',
        message: 'This service has already started',
      });
    }
    return service;
  }
}
