import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function buildCorsOptions(raw: string): CorsOptions | undefined {
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return undefined;
  }

  return {
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    origin: (origin, callback) => {
      callback(null, !origin || origins.includes(origin));
    },
  };
}
