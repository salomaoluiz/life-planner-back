import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { fromParam, fromResponse, seriesScopeGroup, wholeGroup } from '@api/activity/descriptors';
import {
  CreateRecurrenceApiSchema,
  CreateRecurrenceBody,
  CreateRecurrenceResultOutput,
  DeleteOccurrenceQuerySchema,
  DeleteRecurrenceQuerySchema,
  DeleteRecurrenceResultOutput,
  ListRecurrencesQuerySchema,
  MaterializeOccurrenceApiSchema,
  MaterializeOccurrenceBody,
  RecurrenceDetailsOutput,
  RecurrenceOutput,
  SplitRecurrenceApiSchema,
  SplitRecurrenceBody,
  SplitRecurrenceResultOutput,
  UpdateRecurrenceApiSchema,
  UpdateRecurrenceBody,
} from '@api/finance/v1/dto/recurrence.dto';
import { TransactionOutput } from '@api/finance/v1/dto/transaction.dto';
import { FinanceEtag } from '@api/finance/v1/finance-etag';
import { TodayQuerySchema, toOwnerIds } from '@api/finance/v1/finance-query';
import { RecurrenceService } from '@api/finance/v1/recurrence.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// `GET /recurrences/projections` lives in RecurrenceProjectionController, registered before this one (`:id` would win).
@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/recurrences',
  version: '1',
})
@FinanceEtag()
export class RecurrenceController {
  constructor(private readonly recurrenceService: RecurrenceService) {}

  @Post()
  @RecordsActivity({
    action: ActivityAction.CREATE,
    entityType: ActivityEntityType.RECURRENCE,
    idFrom: fromResponse('recurrence.id'),
  })
  @ZodResponse({ status: 201, type: CreateRecurrenceResultOutput })
  async create(
    @Request() req: JwtPayload & Request,
    @Body() body: CreateRecurrenceBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(CreateRecurrenceApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.recurrenceService.create(req.user.id, input, today);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RecordsActivity({
    action: ActivityAction.DELETE,
    entityType: ActivityEntityType.RECURRENCE,
    group: wholeGroup(ActivityGroupKind.RECURRENCE_ROWS, fromParam('id')),
  })
  @ZodResponse({ status: 200, type: DeleteRecurrenceResultOutput })
  async delete(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { confirmPaid } = validate(DeleteRecurrenceQuerySchema, query);

    return this.recurrenceService.delete(req.user.id, id, confirmPaid);
  }

  @ApiNoContentResponse()
  @Delete(':id/occurrences/:number')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RecordsActivity({
    action: ActivityAction.UPDATE,
    entityType: ActivityEntityType.RECURRENCE,
    group: seriesScopeGroup(ActivityGroupKind.RECURRENCE_ROWS),
  })
  async deleteOccurrence(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('number', ParseIntPipe) occurrenceNumber: number,
    @Query() query: Record<string, unknown>,
  ) {
    const { confirmPaid, scope, today } = validate(DeleteOccurrenceQuerySchema, query);

    await this.recurrenceService.deleteOccurrence(
      req.user.id,
      id,
      occurrenceNumber,
      scope,
      confirmPaid,
      today,
    );
  }

  @Get()
  @ZodResponse({ status: 200, type: [RecurrenceOutput] })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { ownerId, ...filter } = validate(ListRecurrencesQuerySchema, query);

    return this.recurrenceService.findAll(req.user.id, toOwnerIds(ownerId), filter);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: RecurrenceDetailsOutput })
  async findOne(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { today } = validate(TodayQuerySchema, query);

    return this.recurrenceService.findOne(req.user.id, id, today);
  }

  @Post(':id/occurrences/:number')
  @RecordsActivity({
    action: ActivityAction.CREATE,
    entityType: ActivityEntityType.TRANSACTION,
    idFrom: fromResponse('id'),
  })
  @ZodResponse({ status: 201, type: TransactionOutput })
  async materializeOccurrence(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('number', ParseIntPipe) occurrenceNumber: number,
    @Body() body: MaterializeOccurrenceBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(MaterializeOccurrenceApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.recurrenceService.materializeOccurrence(
      req.user.id,
      id,
      occurrenceNumber,
      input,
      today,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/split')
  @RecordsActivity({
    action: ActivityAction.UPDATE,
    entityType: ActivityEntityType.RECURRENCE,
    group: wholeGroup(ActivityGroupKind.RECURRENCE_ROWS, fromParam('id')),
  })
  @ZodResponse({ status: 200, type: SplitRecurrenceResultOutput })
  async split(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SplitRecurrenceBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(SplitRecurrenceApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.recurrenceService.split(req.user.id, id, input, today);
  }

  @Patch(':id')
  @RecordsActivity({
    action: ActivityAction.UPDATE,
    entityType: ActivityEntityType.RECURRENCE,
    group: wholeGroup(ActivityGroupKind.RECURRENCE_ROWS, fromParam('id')),
  })
  @ZodResponse({ status: 200, type: RecurrenceOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRecurrenceBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(UpdateRecurrenceApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.recurrenceService.update(req.user.id, id, input, today);
  }
}
