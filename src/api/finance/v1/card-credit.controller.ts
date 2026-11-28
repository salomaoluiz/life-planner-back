import {
  Body,
  Controller,
  Delete,
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

import { ActivityAction, ActivityEntityType } from '@activity/domain/enum';
import { RecordsActivity } from '@api/activity/ActivityRecorder';
import { fromParam, fromResponse } from '@api/activity/descriptors';
import { CardCreditService } from '@api/finance/v1/card-credit.service';
import {
  CreateEarlyPaymentApiSchema,
  CreateEarlyPaymentBody,
  CreateRefundApiSchema,
  CreateRefundBody,
  EarlyPaymentOutput,
  RefundOutput,
  UpdateEarlyPaymentApiSchema,
  UpdateEarlyPaymentBody,
  UpdateRefundApiSchema,
  UpdateRefundBody,
} from '@api/finance/v1/dto/card-credit.dto';
import { TodayQuerySchema } from '@api/finance/v1/finance-query';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Refunds and early payments of a card (spec 032).
@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/credit-cards',
  version: '1',
})
export class CardCreditController {
  constructor(private readonly cardCreditService: CardCreditService) {}

  @Post(':id/early-payments')
  @RecordsActivity({
    action: ActivityAction.CREATE,
    entityType: ActivityEntityType.CARD_EARLY_PAYMENT,
    idFrom: fromResponse('id'),
  })
  @ZodResponse({ status: 201, type: EarlyPaymentOutput })
  async createEarlyPayment(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateEarlyPaymentBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(CreateEarlyPaymentApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.cardCreditService.createEarlyPayment(req.user.id, id, input, today);
  }

  @Post(':id/refunds')
  @RecordsActivity({
    action: ActivityAction.CREATE,
    entityType: ActivityEntityType.CARD_REFUND,
    idFrom: fromResponse('id'),
  })
  @ZodResponse({ status: 201, type: RefundOutput })
  async createRefund(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateRefundBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(CreateRefundApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.cardCreditService.createRefund(req.user.id, id, input, today);
  }

  @ApiNoContentResponse()
  @Delete(':id/early-payments/:earlyPaymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RecordsActivity({
    action: ActivityAction.DELETE,
    entityType: ActivityEntityType.CARD_EARLY_PAYMENT,
    idFrom: fromParam('earlyPaymentId'),
  })
  async deleteEarlyPayment(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('earlyPaymentId', ParseUUIDPipe) earlyPaymentId: string,
  ) {
    await this.cardCreditService.deleteEarlyPayment(req.user.id, id, earlyPaymentId);
  }

  @ApiNoContentResponse()
  @Delete(':id/refunds/:refundId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RecordsActivity({
    action: ActivityAction.DELETE,
    entityType: ActivityEntityType.CARD_REFUND,
    idFrom: fromParam('refundId'),
  })
  async deleteRefund(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('refundId', ParseUUIDPipe) refundId: string,
  ) {
    await this.cardCreditService.deleteRefund(req.user.id, id, refundId);
  }

  @Patch(':id/early-payments/:earlyPaymentId')
  @RecordsActivity({
    action: ActivityAction.UPDATE,
    entityType: ActivityEntityType.CARD_EARLY_PAYMENT,
    idFrom: fromParam('earlyPaymentId'),
  })
  @ZodResponse({ status: 200, type: EarlyPaymentOutput })
  async updateEarlyPayment(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('earlyPaymentId', ParseUUIDPipe) earlyPaymentId: string,
    @Body() body: UpdateEarlyPaymentBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(UpdateEarlyPaymentApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.cardCreditService.updateEarlyPayment(req.user.id, id, earlyPaymentId, input, today);
  }

  @Patch(':id/refunds/:refundId')
  @RecordsActivity({
    action: ActivityAction.UPDATE,
    entityType: ActivityEntityType.CARD_REFUND,
    idFrom: fromParam('refundId'),
  })
  @ZodResponse({ status: 200, type: RefundOutput })
  async updateRefund(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('refundId', ParseUUIDPipe) refundId: string,
    @Body() body: UpdateRefundBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(UpdateRefundApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.cardCreditService.updateRefund(req.user.id, id, refundId, input, today);
  }
}
