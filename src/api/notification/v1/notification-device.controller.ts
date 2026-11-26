import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  DeviceCreatedOutput,
  DeviceIdParamSchema,
  DeviceListOutput,
  DeviceOutput,
  RegisterDeviceBodySchema,
  SeenBodySchema,
  TestPushBodySchema,
  UpdateDeviceBodySchema,
  WebPushKeyOutput,
} from '@api/notification/v1/dto/notification-device.dto';
import { NotificationDeviceService } from '@api/notification/v1/notification-device.service';
import { HttpResponse } from '@shared/infra/http/request-context';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 124 section 7: devices, the test push and the VAPID key. `X-Device-Id` marks the calling device.
@ApiBearerAuth('JWT')
@Controller({
  path: 'notifications',
  version: '1',
})
export class NotificationDeviceController {
  constructor(private readonly deviceService: NotificationDeviceService) {}

  @Get('devices')
  @ZodResponse({ status: 200, type: DeviceListOutput })
  async list(
    @Request() req: JwtPayload & Request,
    @Headers('x-device-id') currentDeviceId: string | undefined,
  ) {
    return this.deviceService.list(req.user.id, currentDeviceId);
  }

  // 201 for a new device, 200 WHEN the same token was registered before (upsert).
  @Post('devices')
  @ZodResponse({ status: 201, type: DeviceCreatedOutput })
  async register(
    @Request() req: JwtPayload & Request,
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) response: HttpResponse,
  ) {
    const { created, id } = await this.deviceService.register(
      req.user.id,
      validate(RegisterDeviceBodySchema, body),
    );

    if (!created) {
      response.status(HttpStatus.OK);
    }

    return { id };
  }

  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req: JwtPayload & Request, @Param() params: Record<string, unknown>) {
    const { id } = validate(DeviceIdParamSchema, params);

    await this.deviceService.delete(req.user.id, id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('devices/:id/seen')
  async seen(
    @Request() req: JwtPayload & Request,
    @Param() params: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ) {
    const { id } = validate(DeviceIdParamSchema, params);

    await this.deviceService.seen(req.user.id, id, validate(SeenBodySchema, body));
  }

  @HttpCode(HttpStatus.ACCEPTED)
  @Post('test')
  async test(
    @Request() req: JwtPayload & Request,
    @Body() body: Record<string, unknown>,
    @Headers('x-device-id') currentDeviceId: string | undefined,
  ) {
    const { deviceId } = validate(TestPushBodySchema, body ?? {});

    await this.deviceService.sendTest(req.user.id, deviceId, currentDeviceId);
  }

  @Patch('devices/:id')
  @ZodResponse({ status: 200, type: DeviceOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param() params: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ) {
    const { id } = validate(DeviceIdParamSchema, params);

    return this.deviceService.update(req.user.id, id, validate(UpdateDeviceBodySchema, body));
  }

  @Get('web-push-key')
  @ZodResponse({ status: 200, type: WebPushKeyOutput })
  webPushKey() {
    return this.deviceService.webPushKey();
  }
}
