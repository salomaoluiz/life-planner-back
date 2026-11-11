import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { CorporateEventService } from '@api/investment/v1/corporate-event.service';
import {
  ApproveEventSuggestionApiSchema,
  ApproveEventSuggestionBody,
  CreateFractionSaleApiSchema,
  CreateFractionSaleBody,
  EventSuggestionListOutput,
  EventSuggestionsQuerySchema,
} from '@api/investment/v1/dto/corporate-event.dto';
import { OperationWriteOutput } from '@api/investment/v1/dto/investment.dto';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 108: fraction sales and the event suggestions, under the same `/investments` prefix.
@ApiBearerAuth('JWT')
@Controller({
  path: 'investments',
  version: '1',
})
export class CorporateEventController {
  constructor(private readonly corporateEventService: CorporateEventService) {}

  @Post('event-suggestions/:id/approve')
  @ZodResponse({ status: 201, type: OperationWriteOutput })
  async approveSuggestion(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApproveEventSuggestionBody,
  ) {
    return this.corporateEventService.approveSuggestion(
      req.user.id,
      id,
      validate(ApproveEventSuggestionApiSchema, body ?? {}),
    );
  }

  @Post('operations/:id/fraction-sale')
  @ZodResponse({ status: 201, type: OperationWriteOutput })
  async createFractionSale(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateFractionSaleBody,
  ) {
    return this.corporateEventService.createFractionSale(
      req.user.id,
      id,
      validate(CreateFractionSaleApiSchema, body),
    );
  }

  @Get('event-suggestions')
  @ZodResponse({ status: 200, type: EventSuggestionListOutput })
  async findSuggestions(
    @Request() req: JwtPayload & Request,
    @Query() query: Record<string, unknown>,
  ) {
    return this.corporateEventService.findSuggestions(
      req.user.id,
      validate(EventSuggestionsQuerySchema, query),
    );
  }

  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('event-suggestions/:id/reject')
  async rejectSuggestion(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.corporateEventService.rejectSuggestion(req.user.id, id);
  }
}
