import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { EnvService } from '@shared/infra/env/env.service';
import { buildCorsOptions } from '@shared/infra/http/cors';
import { setupSwagger } from '@shared/infra/http/swagger';

import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get(EnvService);
  const corsOptions = buildCorsOptions(env.corsOrigins);

  if (corsOptions) {
    app.enableCors(corsOptions);
  }

  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.setGlobalPrefix('api');
  setupSwagger(app, env.swaggerEnabled);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
