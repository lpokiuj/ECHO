import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

// Shared by main.ts and the e2e tests so both run with the same behavior
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
}
