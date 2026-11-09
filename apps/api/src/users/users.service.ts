import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { TeamMember } from '../teams/entities/team-member.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User, UserRole } from './entities/user.entity.js';
import { normalizeEmail } from './normalize-email.js';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

// services.created_by, service_assignments.assigned_by, service_absences.recorded_by
const RECORD_OWNER_CONSTRAINTS = new Set([
  'FK_c896350eb4a5969991bccfb0759',
  'FK_61553c0ad11b34715acac09190d',
  'FK_b2148224ec3f5d42d809f721232',
]);

@Injectable()
export class UsersService {
  private readonly defaultPassword: string;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(TeamMember)
    private readonly teamMembers: Repository<TeamMember>,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.defaultPassword = config.getOrThrow<string>('DEFAULT_USER_PASSWORD');
    if (this.defaultPassword.length < 8) {
      throw new Error('DEFAULT_USER_PASSWORD must be at least 8 characters');
    }
  }

  async create(dto: CreateUserDto): Promise<User> {
    try {
      const { id } = await this.users.save({
        name: dto.name,
        email: normalizeEmail(dto.email),
        role: dto.role ?? UserRole.MEMBER,
        passwordHash: await bcrypt.hash(this.defaultPassword, 10),
        mustChangePassword: false,
        isActive: true,
      });
      // Reload: save() echoes the hash back, while a find honors select: false
      return await this.users.findOneByOrFail({ id });
    } catch (err) {
      throw this.mapError(err);
    }
  }

  findAll(): Promise<User[]> {
    return this.users.find({ order: { name: 'ASC' } });
  }

  async update(
    actor: User,
    id: string,
    dto: UpdateUserDto,
  ): Promise<User> {
    if (
      id === actor.id &&
      (dto.role !== undefined || dto.isActive !== undefined)
    ) {
      throw new BadRequestException(
        'You cannot change your own role or active status',
      );
    }
    if (
      dto.role === UserRole.PEMBINA &&
      (await this.teamMembers.existsBy({ userId: id, isLeader: true }))
    ) {
      throw new BadRequestException(
        'A team leader cannot be PEMBINA. Remove the leader flag first',
      );
    }
    try {
      const hasChanges = Object.values(dto).some((v) => v !== undefined);
      if (hasChanges) {
        const { email, ...rest } = dto;
        await this.users.update(id, {
          ...rest,
          ...(email !== undefined && { email: normalizeEmail(email) }),
        });
      }
    } catch (err) {
      throw this.mapError(err);
    }
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException();
    return user;
  }

  async resetPassword(id: string): Promise<void> {
    const result = await this.users.update(id, {
      passwordHash: await bcrypt.hash(this.defaultPassword, 10),
      mustChangePassword: false,
    });
    if (!result.affected) throw new NotFoundException();
  }

  // Hard delete. The database cascades memberships, assignments, unavailability
  // and the user's absences. Rows the user created, assigned or recorded block it.
  async remove(actor: User, id: string): Promise<void> {
    if (id === actor.id) {
      throw new BadRequestException('You cannot delete yourself');
    }
    try {
      await this.dataSource.transaction(async (manager) => {
        // Row lock on every ADMIN: two concurrent deletes of admins queue up,
        // so each one sees the other's result when it counts the admins.
        const admins: { id: string }[] = await manager.query(
          `SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id FOR UPDATE`,
        );
        const target = await manager.findOneBy(User, { id });
        if (!target) throw new NotFoundException('User not found');
        if (target.role === UserRole.ADMIN && admins.length <= 1) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            code: 'LAST_ADMIN',
            message: 'The last ADMIN cannot be deleted',
          });
        }
        await manager.delete(User, { id });
      });
    } catch (err) {
      throw this.mapDeleteError(err);
    }
  }

  private mapDeleteError(err: unknown): unknown {
    if (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string }).code === FOREIGN_KEY_VIOLATION &&
      RECORD_OWNER_CONSTRAINTS.has(
        (err.driverError as { constraint?: string }).constraint ?? '',
      )
    ) {
      return new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'USER_HAS_CREATED_RECORDS',
        message:
          'This user created services, assigned people, or recorded absences, so they cannot be deleted',
      });
    }
    return err;
  }

  private mapError(err: unknown): unknown {
    if (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return new ConflictException('Email already in use');
    }
    return err;
  }
}
