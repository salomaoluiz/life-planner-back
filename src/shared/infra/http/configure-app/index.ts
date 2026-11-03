import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

import { QueryCounter } from '@shared/infra/db/QueryCounter';
import { EnvService } from '@shared/infra/env/env.service';
import { buildCompression } from '@shared/infra/http/compression';
import { buildCorsOptions } from '@shared/infra/http/cors';
import { setupSwagger } from '@shared/infra/http/swagger';

// Shared by main.ts and the perf runner so both serve the same routes.
export function configureApp(app: NestExpressApplication): void {
  const env = app.get(EnvService);
  const corsOptions = buildCorsOptions(env.corsOrigins);

  if (corsOptions) {
    app.enableCors(corsOptions);
  }

  // Spec 072: gzip/brotli for responses of 1 KB or more.
  app.use(buildCompression());

  // Spec 047: an import of 2,000 rows is about 1 MB of JSON (the default limit is 100 kb).
  app.useBodyParser('json', { limit: '1mb' });
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.setGlobalPrefix('api');
  setupSwagger(app, env.swaggerEnabled);

  // Perf runner only (spec 069): the compiled API runs in another process, so the pool pressure travels in a header.
  if (env.perfCountQueries) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.headers['x-perf-reset-pool'] === '1') QueryCounter.resetPool();
      const writeHead = res.writeHead.bind(res) as (...args: unknown[]) => Response;
      res.writeHead = ((...args: unknown[]) => {
        res.setHeader('x-perf-pool-max-waiting', String(QueryCounter.poolMaxWaiting()));

        return writeHead(...args);
      }) as typeof res.writeHead;
      next();
    });
  }
}
