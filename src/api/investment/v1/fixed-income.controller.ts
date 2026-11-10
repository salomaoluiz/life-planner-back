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
  Put,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  AdjustmentApiSchema,
  AdjustmentBody,
  AdjustmentDateParamSchema,
  AdjustmentWriteOutput,
  ContributionApiSchema,
  ContributionBody,
  CreateFixedIncomeTitleApiSchema,
  CreateFixedIncomeTitleBody,
  FixedIncomeWriteOutput,
  RateApiSchema,
  RedemptionApiSchema,
  RedemptionBody,
  RedemptionPreviewApiSchema,
  RedemptionPreviewBody,
  RedemptionPreviewOutput,
  SimulateApiSchema,
  SimulateBody,
  SimulateOutput,
  UpsertTermsApiSchema,
  UpsertTermsBody,
} from '@api/investment/v1/dto/fixed-income.dto';
import { AssetDetailOutput } from '@api/investment/v1/dto/investment.dto';
import { FixedIncomeService } from '@api/investment/v1/fixed-income.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 105 section 7: shares the `/investments` prefix with the core controller.
@ApiBearerAuth('JWT')
@Controller({
  path: 'investments',
  version: '1',
})
export class FixedIncomeController {
  constructor(private readonly fixedIncomeService: FixedIncomeService) {}

  @Post('assets/:id/fixed-income/contributions')
  @ZodResponse({ status: 201, type: FixedIncomeWriteOutput })
  async createContribution(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ContributionBody,
  ) {
    return this.fixedIncomeService.createContribution(
      req.user.id,
      id,
      validate(ContributionApiSchema, body),
    );
  }

  @Post('assets/:id/fixed-income/rates')
  @ZodResponse({ status: 201, type: AssetDetailOutput })
  async createRate(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.fixedIncomeService.createRate(req.user.id, id, validate(RateApiSchema, body));
  }

  @Post('assets/:id/fixed-income/redemptions')
  @ZodResponse({ status: 201, type: FixedIncomeWriteOutput })
  async createRedemption(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RedemptionBody,
  ) {
    return this.fixedIncomeService.createRedemption(
      req.user.id,
      id,
      validate(RedemptionApiSchema, body),
    );
  }

  @Post('fixed-income')
  @ZodResponse({ status: 201, type: AssetDetailOutput })
  async createTitle(
    @Request() req: JwtPayload & Request,
    @Body() body: CreateFixedIncomeTitleBody,
  ) {
    return this.fixedIncomeService.createTitle(
      req.user.id,
      validate(CreateFixedIncomeTitleApiSchema, body),
    );
  }

  @ApiNoContentResponse()
  @Delete('fixed-income/adjustments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAdjustment(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.fixedIncomeService.deleteAdjustment(req.user.id, id);
  }

  @ApiNoContentResponse()
  @Delete('fixed-income/rates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRate(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.fixedIncomeService.deleteRate(req.user.id, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('assets/:id/fixed-income/redemption-preview')
  @ZodResponse({ status: 200, type: RedemptionPreviewOutput })
  async previewRedemption(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RedemptionPreviewBody,
  ) {
    return this.fixedIncomeService.previewRedemption(
      req.user.id,
      id,
      validate(RedemptionPreviewApiSchema, body),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('fixed-income/simulate')
  @ZodResponse({ status: 200, type: SimulateOutput })
  async simulate(@Body() body: SimulateBody) {
    return this.fixedIncomeService.simulate(validate(SimulateApiSchema, body));
  }

  @Patch('fixed-income/rates/:id')
  @ZodResponse({ status: 200, type: AssetDetailOutput })
  async updateRate(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.fixedIncomeService.updateRate(req.user.id, id, validate(RateApiSchema, body));
  }

  @Put('assets/:id/fixed-income/adjustments/:date')
  @ZodResponse({ status: 200, type: AdjustmentWriteOutput })
  async upsertAdjustment(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('date') date: string,
    @Body() body: AdjustmentBody,
  ) {
    return this.fixedIncomeService.upsertAdjustment(
      req.user.id,
      id,
      validate(AdjustmentDateParamSchema, date),
      validate(AdjustmentApiSchema, body),
    );
  }

  @Put('assets/:id/fixed-income/terms')
  @ZodResponse({ status: 200, type: AssetDetailOutput })
  async upsertTerms(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpsertTermsBody,
  ) {
    return this.fixedIncomeService.upsertTerms(
      req.user.id,
      id,
      validate(UpsertTermsApiSchema, body),
    );
  }
}
