import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { EnvService } from '@shared/infra/env/env.service';
import { buildCorsOptions } from '@shared/infra/http/cors';
import { setupSwagger } from '@shared/infra/http/swagger';

import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = app.get(EnvService);
  const corsOptions = buildCorsOptions(env.corsOrigins);

  if (corsOptions) {
    app.enableCors(corsOptions);
  }

  // Spec 047: an import of 2,000 rows is about 1 MB of JSON (the default limit is 100 kb).
  app.useBodyParser('json', { limit: '1mb' });
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.setGlobalPrefix('api');
  setupSwagger(app, env.swaggerEnabled);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
