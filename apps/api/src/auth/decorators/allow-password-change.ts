import { SetMetadata } from '@nestjs/common';

// Routes that stay reachable while must_change_password is true (domain rule 12)
export const ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChange';
export const AllowPasswordChange = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
