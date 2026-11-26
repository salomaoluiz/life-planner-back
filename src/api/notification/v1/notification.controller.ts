import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  NoticeIdParamSchema,
  NoticeListQuerySchema,
  NoticePageOutput,
  PreferencesOutput,
  ReadAllBodySchema,
  SummaryPreviewOutput,
  UnreadCountOutput,
  UpdatePreferencesBodySchema,
} from '@api/notification/v1/dto/notification.dto';
import { NotificationService } from '@api/notification/v1/notification.service';
import { buildUnreadEtag, matchesUnreadEtag } from '@notification/domain/service/UnreadEtag';
import { NotModifiedException } from '@shared/infra/http/not-modified';
import { HttpResponse } from '@shared/infra/http/request-context';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 124 section 7. Static paths are declared before `:id/read`. Every read is `private, no-cache` (the global
// interceptor sets it on success; the 304 sets it here).
@ApiBearerAuth('JWT')
@Controller({
  path: 'notifications',
  version: '1',
})
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ZodResponse({ status: 200, type: NoticePageOutput })
  async list(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    return this.notificationService.list(req.user.id, validate(NoticeListQuerySchema, query));
  }

  // Conditional GET: the ETag comes from the user's own numbers, 304 when it matches.
  @Get('preferences')
  @ZodResponse({ status: 200, type: PreferencesOutput })
  async getPreferences(@Request() req: JwtPayload & Request) {
    return this.notificationService.getPreferences(req.user.id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/read')
  async read(@Request() req: JwtPayload & Request, @Param() params: Record<string, unknown>) {
    const { id } = validate(NoticeIdParamSchema, params);

    await this.notificationService.markRead(req.user.id, id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('read-all')
  async readAll(@Request() req: JwtPayload & Request, @Body() body: Record<string, unknown>) {
    const { before } = validate(ReadAllBodySchema, body ?? {});

    await this.notificationService.markAllRead(req.user.id, before);
  }

  @Get('summary-preview')
  @ZodResponse({ status: 200, type: SummaryPreviewOutput })
  async summaryPreview(@Request() req: JwtPayload & Request) {
    return this.notificationService.summaryPreview(req.user.id);
  }

  @Get('unread-count')
  @ZodResponse({ status: 200, type: UnreadCountOutput })
  async unreadCount(
    @Request() req: JwtPayload & Request,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: HttpResponse,
  ) {
    const stats = await this.notificationService.getUnreadStats(req.user.id);
    const etag = buildUnreadEtag(req.user.id, stats);

    response.setHeader('ETag', etag);

    if (matchesUnreadEtag(ifNoneMatch, etag)) {
      response.setHeader('Cache-Control', 'private, no-cache');
      throw new NotModifiedException();
    }

    return { count: stats.count };
  }

  @Patch('preferences')
  @ZodResponse({ status: 200, type: PreferencesOutput })
  async updatePreferences(
    @Request() req: JwtPayload & Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.notificationService.updatePreferences(
      req.user.id,
      validate(UpdatePreferencesBodySchema, body),
    );
  }
}
