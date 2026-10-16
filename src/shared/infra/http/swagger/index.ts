import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function setupSwagger(app: INestApplication, enabled: boolean): void {
  if (!enabled) {
    return;
  }

  const config = new DocumentBuilder()
    .setVersion('1.0')
    .addBearerAuth(
      {
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
        name: 'JWT',
        scheme: 'bearer',
        type: 'http',
      },
      'JWT',
    )
    .build();

  SwaggerModule.setup(
    'swagger',
    app,
    cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)),
    {
      swaggerOptions: {
        persistAuthorization: true,
      },
    },
  );
}
