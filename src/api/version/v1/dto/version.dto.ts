import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AppEnvironment, ChangelogSectionType } from '@version/domain/entity/VersionInfo';

const ReleaseApiSchema = z.object({
  publishedAt: z.string(),
  sections: z.array(z.object({ items: z.array(z.string()), type: z.enum(ChangelogSectionType) })),
  url: z.string(),
  version: z.string(),
});

export const VersionOutputSchema = z.object({
  api: z.object({
    builtAt: z.string().nullable(),
    current: z.string(),
    latest: z.string().nullable(),
    latestUrl: z.string().nullable(),
    releasedAt: z.string().nullable(),
    releases: z.array(ReleaseApiSchema),
    startedAt: z.string(),
    updateAvailable: z.boolean(),
  }),
  app: z.object({
    latest: z.string().nullable(),
    latestUrl: z.string().nullable(),
    releases: z.array(ReleaseApiSchema),
  }),
  checkedAt: z.string().nullable(),
  environment: z.enum(AppEnvironment),
});

export const VersionQuerySchema = z.object({ refresh: z.enum(['true', 'false']).optional() });

export class VersionOutput extends createZodDto(VersionOutputSchema) {}
