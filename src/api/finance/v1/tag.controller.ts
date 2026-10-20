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
import { z } from 'zod';

import {
  CreateTagApiSchema,
  CreateTagBody,
  TagOutput,
  UpdateTagApiSchema,
  UpdateTagBody,
} from '@api/finance/v1/dto/tag.dto';
import { OwnerIdQuerySchema, toOwnerIds } from '@api/finance/v1/finance-query';
import { TagService } from '@api/finance/v1/tag.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

const ListTagsQuerySchema = z.object({
  ownerId: OwnerIdQuerySchema,
  q: z.string().trim().min(1).max(30).optional(),
});

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/tags',
  version: '1',
})
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  @ZodResponse({ status: 201, type: TagOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateTagBody) {
    const input = validate(CreateTagApiSchema, body);

    return this.tagService.create(req.user.id, input);
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.tagService.delete(req.user.id, id);
  }

  @Get()
  @ZodResponse({ status: 200, type: [TagOutput] })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { ownerId, q } = validate(ListTagsQuerySchema, query);

    return this.tagService.findAll(req.user.id, toOwnerIds(ownerId), q);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: TagOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTagBody,
  ) {
    const input = validate(UpdateTagApiSchema, body);

    return this.tagService.update(req.user.id, id, input);
  }
}
