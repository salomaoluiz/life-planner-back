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

import {
  CreateInstallmentPlanApiSchema,
  CreateInstallmentPlanBody,
  InstallmentPlanOutput,
  PrepayInstallmentPlanApiSchema,
  PrepayInstallmentPlanBody,
  PrepaymentPreviewOutput,
  PrepaymentPreviewQuerySchema,
  UpdateInstallmentPlanApiSchema,
  UpdateInstallmentPlanBody,
} from '@api/finance/v1/dto/installment-plan.dto';
import { TodayQuerySchema } from '@api/finance/v1/finance-query';
import { InstallmentPlanService } from '@api/finance/v1/installment-plan.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/installment-plans',
  version: '1',
})
export class InstallmentPlanController {
  constructor(private readonly installmentPlanService: InstallmentPlanService) {}

  @Post()
  @ZodResponse({ status: 201, type: InstallmentPlanOutput })
  async create(
    @Request() req: JwtPayload & Request,
    @Body() body: CreateInstallmentPlanBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(CreateInstallmentPlanApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.installmentPlanService.create(req.user.id, input, today);
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.installmentPlanService.delete(req.user.id, id);
  }

  @ApiNoContentResponse()
  @Delete(':id/prepayment')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePrepayment(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.installmentPlanService.undoPrepayment(req.user.id, id);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: InstallmentPlanOutput })
  async findOne(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { today } = validate(TodayQuerySchema, query);

    return this.installmentPlanService.findOne(req.user.id, id, today);
  }

  @Get(':id/prepayment-preview')
  @ZodResponse({ status: 200, type: PrepaymentPreviewOutput })
  async findPrepaymentPreview(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { targetInvoiceMonth, today } = validate(PrepaymentPreviewQuerySchema, query);

    return this.installmentPlanService.prepaymentPreview(
      req.user.id,
      id,
      targetInvoiceMonth,
      today,
    );
  }

  @Post(':id/prepayment')
  @ZodResponse({ status: 201, type: InstallmentPlanOutput })
  async prepay(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PrepayInstallmentPlanBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(PrepayInstallmentPlanApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.installmentPlanService.prepay(req.user.id, id, input, today);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: InstallmentPlanOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateInstallmentPlanBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(UpdateInstallmentPlanApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.installmentPlanService.update(req.user.id, id, input, today);
  }
}
