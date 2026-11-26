import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { NOTIFICATION_LOCALES } from '@notification/domain/enum';

const LocaleSchema = z.enum(NOTIFICATION_LOCALES);
const TimeZoneSchema = z.string().min(1).max(64);
const NameSchema = z.string().trim().min(1).max(60);

export const DeviceIdParamSchema = z.object({ id: z.uuid() });
export const RegisterDeviceBodySchema = z.object({
  locale: LocaleSchema,
  name: NameSchema,
  platform: z.enum(['ANDROID', 'IOS', 'WEB']),
  provider: z.enum(['EXPO', 'WEB_PUSH']),
  timeZone: TimeZoneSchema,
  token: z.string().min(1).max(2048),
  webKeys: z
    .object({ auth: z.string().min(1).max(256), p256dh: z.string().min(1).max(256) })
    .optional(),
});
export const UpdateDeviceBodySchema = z
  .object({ enabled: z.boolean(), name: NameSchema })
  .partial()
  .strict();
export const SeenBodySchema = z.object({ locale: LocaleSchema, timeZone: TimeZoneSchema });
export const TestPushBodySchema = z.object({ deviceId: z.uuid().optional() });

// Never the token or the keys (section 7).
const DeviceApiSchema = z.object({
  current: z.boolean(),
  enabled: z.boolean(),
  id: z.string(),
  lastSeenAt: z.string(),
  name: z.string(),
  platform: z.enum(['ANDROID', 'IOS', 'WEB']),
  provider: z.enum(['EXPO', 'WEB_PUSH']),
});
export const DeviceListApiSchema = z.object({ items: z.array(DeviceApiSchema) });
export const DeviceOutputApiSchema = DeviceApiSchema;
export const DeviceCreatedApiSchema = z.object({ id: z.string() });
export const WebPushKeyApiSchema = z.object({ publicKey: z.string() });

export class DeviceCreatedOutput extends createZodDto(DeviceCreatedApiSchema) {}
export class DeviceListOutput extends createZodDto(DeviceListApiSchema) {}
export class DeviceOutput extends createZodDto(DeviceOutputApiSchema) {}
export class WebPushKeyOutput extends createZodDto(WebPushKeyApiSchema) {}
