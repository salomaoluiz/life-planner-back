import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
  CatalogOwnerQuerySchema,
  CatalogSuggestionsBodySchema,
  CreateStockCategoryApiSchema,
  CreateStockCategoryBody,
  CreateStockLocationApiSchema,
  CreateStockLocationBody,
  DeleteCatalogQuerySchema,
  StockCategoryListOutput,
  StockCategoryOutput,
  StockCategoryTreeOutput,
  StockLocationListOutput,
  StockLocationOutput,
  StockLocationTreeOutput,
  UpdateStockCategoryApiSchema,
  UpdateStockCategoryBody,
  UpdateStockLocationApiSchema,
  UpdateStockLocationBody,
} from '@api/stock/v1/dto/stock.dto';
import { StockService } from '@api/stock/v1/stock.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Names of the suggested defaults follow the Accept-Language of the request (pt-BR by prefix, else en-US).
export function languageOf(header?: string): 'en-US' | 'pt-BR' {
  return header?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US';
}

@ApiBearerAuth('JWT')
@Controller({ path: 'stock/categories', version: '1' })
export class StockCategoryController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  @ZodResponse({ status: 201, type: StockCategoryOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateStockCategoryBody) {
    return this.stockService.createCategory(
      req.user.id,
      validate(CreateStockCategoryApiSchema, body),
    );
  }

  @Post('suggestions')
  @ZodResponse({ status: 201, type: StockCategoryListOutput })
  async createSuggestions(
    @Request() req: JwtPayload & Request,
    @Body() body: Record<string, unknown>,
    @Headers('accept-language') language?: string,
  ) {
    return this.stockService.createCategorySuggestions(
      req.user.id,
      validate(CatalogSuggestionsBodySchema, body),
      languageOf(language),
    );
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    await this.stockService.deleteCategory(
      req.user.id,
      id,
      validate(DeleteCatalogQuerySchema, query).moveTo,
    );
  }

  @Get()
  @ZodResponse({ status: 200, type: StockCategoryTreeOutput })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    return this.stockService.findCategories(req.user.id, validate(CatalogOwnerQuerySchema, query));
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: StockCategoryOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStockCategoryBody,
  ) {
    return this.stockService.updateCategory(
      req.user.id,
      id,
      validate(UpdateStockCategoryApiSchema, body),
    );
  }
}

@ApiBearerAuth('JWT')
@Controller({ path: 'stock/locations', version: '1' })
export class StockLocationController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  @ZodResponse({ status: 201, type: StockLocationOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateStockLocationBody) {
    return this.stockService.createLocation(
      req.user.id,
      validate(CreateStockLocationApiSchema, body),
    );
  }

  @Post('suggestions')
  @ZodResponse({ status: 201, type: StockLocationListOutput })
  async createSuggestions(
    @Request() req: JwtPayload & Request,
    @Body() body: Record<string, unknown>,
    @Headers('accept-language') language?: string,
  ) {
    return this.stockService.createLocationSuggestions(
      req.user.id,
      validate(CatalogSuggestionsBodySchema, body),
      languageOf(language),
    );
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    await this.stockService.deleteLocation(
      req.user.id,
      id,
      validate(DeleteCatalogQuerySchema, query).moveTo,
    );
  }

  @Get()
  @ZodResponse({ status: 200, type: StockLocationTreeOutput })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    return this.stockService.findLocations(req.user.id, validate(CatalogOwnerQuerySchema, query));
  }

  // Spec 117 FR 30: the QR route header; registered after the fixed routes.
  @Get(':id')
  @ZodResponse({ status: 200, type: StockLocationOutput })
  async findById(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.stockService.findLocationById(req.user.id, id);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: StockLocationOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStockLocationBody,
  ) {
    return this.stockService.updateLocation(
      req.user.id,
      id,
      validate(UpdateStockLocationApiSchema, body),
    );
  }
}
