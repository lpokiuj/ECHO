import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AllowPasswordChange } from './decorators/allow-password-change.js';
import { CurrentUser } from './decorators/current-user.js';
import { Public } from './decorators/public.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { User } from '../users/entities/user.entity.js';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @AllowPasswordChange()
  @Post('auth/change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @AllowPasswordChange()
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.auth.getProfile(user);
  }
}
