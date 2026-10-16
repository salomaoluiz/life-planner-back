import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: `postgresql://${encodeURIComponent(env('DB_USER'))}:${encodeURIComponent(env('DB_PASSWORD'))}@${env('DB_HOST')}:${env('DB_PORT')}/${env('DB_NAME')}`,
  },
});
