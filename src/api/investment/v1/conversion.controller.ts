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
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { ConversionService } from '@api/investment/v1/conversion.service';
import {
  ConversionOutput,
  ConversionWriteOutput,
  CreateConversionApiSchema,
  CreateConversionBody,
  UpdateConversionApiSchema,
  UpdateConversionBody,
} from '@api/investment/v1/dto/conversion.dto';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 112: converts the whole position of an asset into another asset of the same class.
@ApiBearerAuth('JWT')
@Controller({
  path: 'investments',
  version: '1',
})
export class ConversionController {
  constructor(private readonly conversionService: ConversionService) {}

  @Post('assets/:id/conversions')
  @ZodResponse({ status: 201, type: ConversionWriteOutput })
  async create(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateConversionBody,
  ) {
    return this.conversionService.create(
      req.user.id,
      id,
      validate(CreateConversionApiSchema, body),
    );
  }

  @ApiNoContentResponse()
  @Delete('conversions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.conversionService.delete(req.user.id, id);
  }

  @Get('conversions/:id')
  @ZodResponse({ status: 200, type: ConversionOutput })
  async findById(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversionService.findById(req.user.id, id);
  }

  @Patch('conversions/:id')
  @ZodResponse({ status: 200, type: ConversionWriteOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateConversionBody,
  ) {
    return this.conversionService.update(
      req.user.id,
      id,
      validate(UpdateConversionApiSchema, body),
    );
  }
}
