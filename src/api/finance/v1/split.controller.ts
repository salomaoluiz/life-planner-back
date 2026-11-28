import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { ActivityAction, ActivityEntityType, ActivityGroupKind } from '@activity/domain/enum';
import { RecordsActivity } from '@api/activity/ActivityRecorder';
import { fromParam, fromResponse, wholeGroup } from '@api/activity/descriptors';
import {
  CreateSplitApiSchema,
  CreateSplitBody,
  SplitUpdateResultOutput,
  SplitWithLookupsOutput,
  UpdateSplitApiSchema,
  UpdateSplitBody,
} from '@api/finance/v1/dto/split.dto';
import { FinanceEtag } from '@api/finance/v1/finance-etag';
import { TodayQuerySchema } from '@api/finance/v1/finance-query';
import { SplitService } from '@api/finance/v1/split.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 119: one purchase in several categories; its parts are listed through `/finance/transactions`.
@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/splits',
  version: '1',
})
@FinanceEtag()
export class SplitController {
  constructor(private readonly splitService: SplitService) {}

  @Post()
  @RecordsActivity({
    action: ActivityAction.CREATE,
    entityType: ActivityEntityType.SPLIT,
    group: wholeGroup(ActivityGroupKind.SPLIT_ROWS, fromResponse('item.id')),
    idFrom: fromResponse('item.id'),
  })
  @ZodResponse({ status: 201, type: SplitWithLookupsOutput })
  async create(
    @Request() req: JwtPayload & Request,
    @Body() body: CreateSplitBody,
    @Query() query: Record<string, unknown>,
  ) {
    const { today } = validate(TodayQuerySchema, query);

    return this.splitService.create(req.user.id, validate(CreateSplitApiSchema, body), today);
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RecordsActivity({
    action: ActivityAction.DELETE,
    entityType: ActivityEntityType.SPLIT,
    group: wholeGroup(ActivityGroupKind.SPLIT_ROWS, fromParam('id')),
  })
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.splitService.delete(req.user.id, id);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: SplitWithLookupsOutput })
  async findById(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.splitService.findById(req.user.id, id);
  }

  @Patch(':id')
  @RecordsActivity({
    action: ActivityAction.UPDATE,
    entityType: ActivityEntityType.SPLIT,
    group: wholeGroup(ActivityGroupKind.SPLIT_ROWS, fromParam('id')),
  })
  @ZodResponse({ status: 200, type: SplitUpdateResultOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSplitBody,
    @Query() query: Record<string, unknown>,
  ) {
    const { today } = validate(TodayQuerySchema, query);

    return this.splitService.update(req.user.id, id, validate(UpdateSplitApiSchema, body), today);
  }
}
