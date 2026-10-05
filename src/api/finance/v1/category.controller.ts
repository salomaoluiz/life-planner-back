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

import { CategoryService } from '@api/finance/v1/category.service';
import {
  CategoryOutput,
  CreateCategoryApiSchema,
  CreateCategoryBody,
  UpdateCategoryApiSchema,
  UpdateCategoryBody,
} from '@api/finance/v1/dto/category.dto';
import { TransactionTypeApiSchema } from '@api/finance/v1/dto/finance-fields';
import { OwnerIdQuerySchema, toOwnerIds } from '@api/finance/v1/finance-query';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

const ListCategoriesQuerySchema = z.object({
  ownerId: OwnerIdQuerySchema,
  type: TransactionTypeApiSchema.optional(),
});

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/categories',
  version: '1',
})
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ZodResponse({ status: 201, type: CategoryOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateCategoryBody) {
    const input = validate(CreateCategoryApiSchema, body);

    return this.categoryService.create(req.user.id, input);
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.categoryService.delete(req.user.id, id);
  }

  @Get()
  @ZodResponse({ status: 200, type: [CategoryOutput] })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { ownerId, type } = validate(ListCategoriesQuerySchema, query);

    return this.categoryService.findAll(req.user.id, toOwnerIds(ownerId), type);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: CategoryOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryBody,
  ) {
    const input = validate(UpdateCategoryApiSchema, body);

    return this.categoryService.update(req.user.id, id, input);
  }
}
