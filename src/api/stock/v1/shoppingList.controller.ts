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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  AddShoppingListRowApiSchema,
  AddShoppingListRowBody,
  CreateShoppingListApiSchema,
  CreateShoppingListBody,
  RestockSummaryOutput,
  ShoppingListDetailOutput,
  ShoppingListOutput,
  ShoppingListRowOutput,
  ShoppingListRowResultOutput,
  ShoppingListsOutput,
  ShoppingListsQuerySchema,
  UpdateShoppingListApiSchema,
  UpdateShoppingListBody,
  UpdateShoppingListRowApiSchema,
  UpdateShoppingListRowBody,
} from '@api/stock/v1/dto/shoppingList.dto';
import { ShoppingListService } from '@api/stock/v1/shoppingList.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 118 FR 2: the default list is named by the request language; without one it is pt-BR.
export function listLanguageOf(header?: string): 'en-US' | 'pt-BR' | undefined {
  if (!header) {
    return undefined;
  }

  return header.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US';
}

// `restock-summary` and `rows/:rowId` are declared before the `:id` routes.
@ApiBearerAuth('JWT')
@Controller({ path: 'stock/shopping-lists', version: '1' })
export class ShoppingListController {
  constructor(private readonly shoppingListService: ShoppingListService) {}

  @Post()
  @ZodResponse({ status: 201, type: ShoppingListOutput })
  async create(
    @Request() req: JwtPayload & Request,
    @Body() body: CreateShoppingListBody,
    @Headers('accept-language') language?: string,
  ) {
    return this.shoppingListService.create(
      req.user.id,
      validate(CreateShoppingListApiSchema, body),
      listLanguageOf(language),
    );
  }

  @ApiNoContentResponse()
  @Delete('rows/:rowId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRow(
    @Request() req: JwtPayload & Request,
    @Param('rowId', ParseUUIDPipe) rowId: string,
  ): Promise<void> {
    await this.shoppingListService.deleteRow(req.user.id, rowId);
  }

  @Get()
  @ZodResponse({ type: ShoppingListsOutput })
  async findAll(
    @Request() req: JwtPayload & Request,
    @Query() query: Record<string, string>,
    @Headers('accept-language') language?: string,
  ) {
    const input = validate(ShoppingListsQuerySchema, query);

    return this.shoppingListService.findAll(req.user.id, input, listLanguageOf(language));
  }

  @Get(':id')
  @ZodResponse({ type: ShoppingListDetailOutput })
  async findById(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.shoppingListService.findById(req.user.id, id);
  }

  @Get('restock-summary')
  @ZodResponse({ type: RestockSummaryOutput })
  async restockSummary(@Request() req: JwtPayload & Request) {
    return this.shoppingListService.restockSummary(req.user.id);
  }

  @Patch(':id')
  @ZodResponse({ type: ShoppingListOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateShoppingListBody,
  ) {
    return this.shoppingListService.update(
      req.user.id,
      id,
      validate(UpdateShoppingListApiSchema, body),
    );
  }

  @Patch('rows/:rowId')
  @ZodResponse({ type: ShoppingListRowOutput })
  async updateRow(
    @Request() req: JwtPayload & Request,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body() body: UpdateShoppingListRowBody,
  ) {
    return this.shoppingListService.updateRow(
      req.user.id,
      rowId,
      validate(UpdateShoppingListRowApiSchema, body),
    );
  }

  // 201 for a new row, 200 when the item was already on the list and the quantities were summed (FR 14).
  @Post(':id/rows')
  @ZodResponse({ status: 201, type: ShoppingListRowResultOutput })
  async addRow(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddShoppingListRowBody,
    @Res({ passthrough: true }) response: { status: (code: number) => unknown },
  ) {
    const result = await this.shoppingListService.addRow(
      req.user.id,
      id,
      validate(AddShoppingListRowApiSchema, body),
    );

    if (result.merged) {
      response.status(HttpStatus.OK);
    }

    return result;
  }
}
