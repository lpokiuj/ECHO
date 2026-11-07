import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { normalizeEmail } from '../users/normalize-email.js';

// Limits login attempts per IP and email. The email is part of the key so that
// clients behind one shared IP (or a proxy that hides the real one) do not
// lock each other out.
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const email = req.body?.email;
    const who = typeof email === 'string' ? normalizeEmail(email) : '';
    return Promise.resolve(`${req.ip}:${who}`);
  }
}
