import './instrument';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { configureApp } from '@shared/infra/http/configure-app';
import { captureException, flushMonitoring, registerFatalHandlers } from '@shared/infra/monitoring';

import { AppModule } from './modules/app.module';

registerFatalHandlers({
  exit: (code) => process.exit(code),
  log: (error) => new Logger('Process').error(error),
  target: process,
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  configureApp(app);

  await app.listen(process.env.PORT ?? 3000);
}

// A failure while booting (env, database) is sent before the process exits.
bootstrap().catch(async (error: unknown) => {
  captureException(error, { tags: { phase: 'bootstrap' } });
  await flushMonitoring();
  new Logger('Bootstrap').error(error);
  process.exit(1);
});
