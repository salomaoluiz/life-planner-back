import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { CategoryIconService } from '@api/finance/v1/category-icon.service';
import {
  CategoryIconsOutput,
  CategoryIconsQuerySchema,
} from '@api/finance/v1/dto/category-icon.dto';
import { validate } from '@shared/infra/validation';

// Spec 058: the icon catalog is global and read-only; the global JwtAuthGuard is the only check.
@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/category-icons',
  version: '1',
})
export class CategoryIconController {
  constructor(private readonly categoryIconService: CategoryIconService) {}

  @Get()
  @ZodResponse({ status: 200, type: CategoryIconsOutput })
  async findAll(@Query() query: Record<string, unknown>) {
    const { limit, q } = validate(CategoryIconsQuerySchema, query);

    return this.categoryIconService.findAll(q, limit);
  }
}
