import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User, UserRole } from './entities/user.entity.js';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  private readonly defaultPassword: string;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
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
        email: dto.email,
        role: dto.role ?? UserRole.MEMBER,
        passwordHash: await bcrypt.hash(this.defaultPassword, 10),
        mustChangePassword: true,
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
    try {
      const hasChanges = Object.values(dto).some((v) => v !== undefined);
      if (hasChanges) await this.users.update(id, dto);
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
      mustChangePassword: true,
    });
    if (!result.affected) throw new NotFoundException();
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
