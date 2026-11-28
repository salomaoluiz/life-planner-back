import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { ActivityAction, ActivityEntityType, ActivityGroupKind } from '@activity/domain/enum';
import { RecordsActivity } from '@api/activity/ActivityRecorder';
import { fromParam, fromResponse, wholeGroup } from '@api/activity/descriptors';
import {
  CreateIncomeSeriesApiSchema,
  CreateIncomeSeriesBody,
  IncomeSeriesCreatedOutput,
  IncomeSeriesItemOutput,
  IncomeSeriesListOutput,
  IncomeSeriesPreviewOutput,
  ListIncomeSeriesQuerySchema,
  PreviewIncomeSeriesApiSchema,
  PreviewIncomeSeriesBody,
  ProjectedIncomeListOutput,
  ProjectionsQuerySchema,
  UpdateIncomeSeriesApiSchema,
  UpdateIncomeSeriesBody,
} from '@api/investment/v1/dto/income-series.dto';
import { IncomeSeriesService } from '@api/investment/v1/income-series.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 115: recurring incomes of an asset, under the same `/investments` prefix. `preview` and `projections` are
// declared before `:id` so they are not read as ids.
@ApiBearerAuth('JWT')
@Controller({ path: 'investments/income-series', version: '1' })
export class IncomeSeriesController {
  constructor(private readonly incomeSeriesService: IncomeSeriesService) {}

  @Post()
  @RecordsActivity({
    action: ActivityAction.CREATE,
    entityType: ActivityEntityType.INCOME_SERIES,
    idFrom: fromResponse('item.id'),
  })
  @ZodResponse({ status: 201, type: IncomeSeriesCreatedOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateIncomeSeriesBody) {
    return this.incomeSeriesService.create(
      req.user.id,
      validate(CreateIncomeSeriesApiSchema, body),
    );
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: IncomeSeriesItemOutput })
  async findById(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.incomeSeriesService.findById(req.user.id, id);
  }

  @Get()
  @ZodResponse({ status: 200, type: IncomeSeriesListOutput })
  async list(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    return this.incomeSeriesService.list(
      req.user.id,
      validate(ListIncomeSeriesQuerySchema, query).assetId,
    );
  }

  @Post('preview')
  @ZodResponse({ status: 201, type: IncomeSeriesPreviewOutput })
  async preview(@Request() req: JwtPayload & Request, @Body() body: PreviewIncomeSeriesBody) {
    return this.incomeSeriesService.preview(
      req.user.id,
      validate(PreviewIncomeSeriesApiSchema, body),
    );
  }

  @Get('projections')
  @ZodResponse({ status: 200, type: ProjectedIncomeListOutput })
  async projections(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    return this.incomeSeriesService.projections(
      req.user.id,
      validate(ProjectionsQuerySchema, query),
    );
  }

  @Patch(':id')
  @RecordsActivity({
    action: ActivityAction.UPDATE,
    entityType: ActivityEntityType.INCOME_SERIES,
    group: wholeGroup(ActivityGroupKind.INCOME_SERIES_ROWS, fromParam('id')),
  })
  @ZodResponse({ status: 200, type: IncomeSeriesItemOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateIncomeSeriesBody,
  ) {
    return this.incomeSeriesService.update(
      req.user.id,
      id,
      validate(UpdateIncomeSeriesApiSchema, body),
    );
  }
}
