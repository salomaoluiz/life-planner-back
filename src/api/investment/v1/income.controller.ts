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
  ApproveSuggestionApiSchema,
  ApproveSuggestionBody,
  CreateIncomeApiSchema,
  CreateIncomeBody,
  IncomeDefaultsOutput,
  IncomeDefaultsQuerySchema,
  IncomeListOutput,
  IncomeSuggestionListOutput,
  IncomeWriteOutput,
  ListIncomesQuerySchema,
  ListSuggestionsQuerySchema,
  ReceiveIncomeApiSchema,
  ReceiveIncomeBody,
  UpdateIncomeApiSchema,
  UpdateIncomeBody,
} from '@api/investment/v1/dto/income.dto';
import { IncomeService } from '@api/investment/v1/income.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 107: incomes of an asset and the suggestions inbox, under the same `/investments` prefix.
@ApiBearerAuth('JWT')
@Controller({
  path: 'investments',
  version: '1',
})
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Post('income-suggestions/:id/approve')
  @ZodResponse({ status: 201, type: IncomeWriteOutput })
  async approveSuggestion(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApproveSuggestionBody,
  ) {
    return this.incomeService.approveSuggestion(
      req.user.id,
      id,
      validate(ApproveSuggestionApiSchema, body ?? {}),
    );
  }

  @Post('incomes')
  @ZodResponse({ status: 201, type: IncomeWriteOutput })
  async createIncome(@Request() req: JwtPayload & Request, @Body() body: CreateIncomeBody) {
    return this.incomeService.createIncome(req.user.id, validate(CreateIncomeApiSchema, body));
  }

  @ApiNoContentResponse()
  @Delete('incomes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteIncome(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.incomeService.deleteIncome(req.user.id, id);
  }

  @Get('assets/:id/income-defaults')
  @ZodResponse({ status: 200, type: IncomeDefaultsOutput })
  async findDefaults(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.incomeService.findDefaults(
      req.user.id,
      id,
      validate(IncomeDefaultsQuerySchema, query),
    );
  }

  @Get('incomes/:id')
  @ZodResponse({ status: 200, type: IncomeWriteOutput })
  async findIncomeById(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.incomeService.findIncomeById(req.user.id, id);
  }

  @Get('incomes')
  @ZodResponse({ status: 200, type: IncomeListOutput })
  async findIncomes(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    return this.incomeService.findIncomes(req.user.id, validate(ListIncomesQuerySchema, query));
  }

  @Get('income-suggestions')
  @ZodResponse({ status: 200, type: IncomeSuggestionListOutput })
  async findSuggestions(
    @Request() req: JwtPayload & Request,
    @Query() query: Record<string, unknown>,
  ) {
    return this.incomeService.findSuggestions(
      req.user.id,
      validate(ListSuggestionsQuerySchema, query),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('incomes/:id/receive')
  @ZodResponse({ status: 200, type: IncomeWriteOutput })
  async receiveIncome(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReceiveIncomeBody,
  ) {
    return this.incomeService.receiveIncome(
      req.user.id,
      id,
      validate(ReceiveIncomeApiSchema, body ?? {}),
    );
  }

  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('income-suggestions/:id/reject')
  async rejectSuggestion(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.incomeService.rejectSuggestion(req.user.id, id);
  }

  @Patch('incomes/:id')
  @ZodResponse({ status: 200, type: IncomeWriteOutput })
  async updateIncome(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateIncomeBody,
  ) {
    return this.incomeService.updateIncome(req.user.id, id, validate(UpdateIncomeApiSchema, body));
  }
}
