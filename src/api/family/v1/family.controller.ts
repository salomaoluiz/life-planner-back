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

import {
  CreateFamilyApiSchema,
  CreateFamilyInput,
  FamilyOutput,
  UpdateFamilyApiSchema,
  UpdateFamilyInput,
} from '@api/family/v1/dto/family.dto';
import { FamilyService } from '@api/family/v1/family.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

@ApiBearerAuth('JWT')
@Controller({
  path: 'families',
  version: '1',
})
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Post()
  @ZodResponse({ status: 201, type: FamilyOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateFamilyInput) {
    const input = validate(CreateFamilyApiSchema, body);

    return this.familyService.create(req.user.id, input);
  }

  @ApiNoContentResponse()
  @Delete(':familyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Request() req: JwtPayload & Request,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ) {
    await this.familyService.delete(req.user.id, familyId);
  }

  @Get()
  @ZodResponse({ status: 200, type: [FamilyOutput] })
  async findAll(@Request() req: JwtPayload & Request) {
    return this.familyService.findAll(req.user.id);
  }

  @Get(':familyId')
  @ZodResponse({ status: 200, type: FamilyOutput })
  async findById(
    @Request() req: JwtPayload & Request,
    @Param('familyId', ParseUUIDPipe) familyId: string,
  ) {
    return this.familyService.findById(req.user.id, familyId);
  }

  @Patch(':familyId')
  @ZodResponse({ status: 200, type: FamilyOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() body: UpdateFamilyInput,
  ) {
    const input = validate(UpdateFamilyApiSchema, body);

    return this.familyService.update(req.user.id, familyId, input);
  }
}
