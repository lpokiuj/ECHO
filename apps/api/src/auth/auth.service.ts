import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { TeamMember } from '../teams/entities/team-member.entity.js';
import { User } from '../users/entities/user.entity.js';

// Compared against when the email is unknown, so timing does not reveal it
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(TeamMember)
    private readonly members: Repository<TeamMember>,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.isActive) throw new UnauthorizedException();
    return { accessToken: await this.jwtService.signAsync({ sub: user.id }) };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :userId', { userId })
      .getOneOrFail();
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException();
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must differ from the current password',
      );
    }
    await this.users.update(userId, {
      passwordHash: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
    });
  }

  async getProfile(user: User) {
    const memberships = await this.members.find({
      where: { userId: user.id },
      relations: { team: true },
      order: { team: { name: 'ASC' } },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      memberships: memberships.map((m) => ({
        teamId: m.teamId,
        teamName: m.team.name,
        isLeader: m.isLeader,
      })),
    };
  }
}
