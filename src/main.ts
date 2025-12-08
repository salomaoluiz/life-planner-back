import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder().setVersion('1.0').addBearerAuth().build();

  function documentFactory() {
    return SwaggerModule.createDocument(app, config);
  }

  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.setGlobalPrefix('api');
  SwaggerModule.setup('swagger', app, cleanupOpenApiDoc(documentFactory()), {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
