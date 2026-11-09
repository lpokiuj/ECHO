import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ThrottlerStorage,
  ThrottlerStorageService,
  type ThrottlerStorageRecord,
} from '@nestjs/throttler';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

// App whose throttler counters the test can reset (call storage.reset() in beforeEach)
export async function createAppWithResettableThrottle(): Promise<{
  app: INestApplication;
  storage: ResettableThrottlerStorage;
}> {
  const storage = new ResettableThrottlerStorage();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ThrottlerStorage)
    .useValue(storage)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, storage };
}

// Wraps the real in-memory throttler storage so a test can forget all counters
// between tests. The limits themselves (5 per 10 minutes) stay untouched.
export class ResettableThrottlerStorage implements ThrottlerStorage {
  private inner = new ThrottlerStorageService();

  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    return this.inner.increment(key, ttl, limit, blockDuration, throttlerName);
  }

  reset(): void {
    this.inner.onApplicationShutdown();
    this.inner = new ThrottlerStorageService();
  }
}
