import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { ALLOW_PASSWORD_CHANGE_KEY } from './decorators/allow-password-change.js';
import type { AuthenticatedRequest } from './decorators/current-user.js';
import { IS_PUBLIC_KEY } from './decorators/public.js';

export const ACCESS_TOKEN_HEADER = 'X-Access-Token';

// Default-deny: every route needs a valid token unless marked @Public().
// The user is loaded from the DB on every request, so role, deactivation and
// must_change_password changes apply immediately.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    let userId: string;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: unknown }>(
        token,
      );
      if (typeof payload.sub !== 'string') throw new Error('no subject');
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.users.findOneBy({ id: userId });
    if (!user?.isActive) throw new UnauthorizedException();
    request.user = user;

    // Sliding session: each authenticated response renews the idle window
    const fresh = await this.jwtService.signAsync({ sub: user.id });
    http.getResponse<Response>().setHeader(ACCESS_TOKEN_HEADER, fresh);

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_KEY,
      targets,
    );
    if (user.mustChangePassword && !allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your password first',
      });
    }
    return true;
  }
}
