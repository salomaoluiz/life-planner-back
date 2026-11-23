import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { DescriptionSchema, PositiveQuantitySchema } from '@stock/application/dto/StockCommon';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

const OwnerTypeApiSchema = z.enum(OwnerType);
const UnitApiSchema = z.enum(StockUnits);
const PriceApiSchema = z.number().int().min(1).max(99_999_999);
const DayApiSchema = z.iso.date();
const MarketNameApiSchema = z.string().trim().min(1).max(60);
const InvoiceMonthApiSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const MarketsQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  ownerId: z.uuid().optional(),
});
export const CreateMarketApiSchema = z
  .object({
    name: MarketNameApiSchema,
    neighborhood: MarketNameApiSchema.optional(),
    owner: OwnerTypeApiSchema,
    ownerId: z.uuid(),
  })
  .strict();
export const UpdateMarketApiSchema = z
  .object({
    name: MarketNameApiSchema,
    neighborhood: MarketNameApiSchema.nullable(),
    status: z.enum(StockCatalogStatus),
  })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  });
export const StartPurchaseApiSchema = z
  .object({
    id: z.uuid(),
    listId: z.uuid(),
    marketId: z.uuid(),
    purchaseDate: DayApiSchema,
  })
  .strict();
export const UpsertPurchaseRowApiSchema = z
  .object({
    barcode: z.string().trim().min(1).max(80).optional(),
    description: DescriptionSchema.optional(),
    expirationDate: DayApiSchema.nullable().optional(),
    itemId: z.uuid().optional(),
    lineTotalCents: PriceApiSchema.nullable().optional(),
    listRowId: z.uuid().optional(),
    priceInput: z.enum(['LINE', 'UNIT']).optional(),
    quantity: PositiveQuantitySchema.nullable().optional(),
    state: z.enum(['IN_CART', 'NOT_FOUND']).optional(),
    unit: UnitApiSchema.optional(),
    unitPriceCents: PriceApiSchema.nullable().optional(),
  })
  .strict();
export const ClosePurchaseApiSchema = z
  .object({
    accountId: z.uuid().optional(),
    creditCardId: z.uuid().optional(),
    date: DayApiSchema,
    defaultFinanceCategoryId: z.uuid().optional(),
    invoiceMonth: InvoiceMonthApiSchema.optional(),
    marketId: z.uuid().optional(),
    receiptTotalCents: PriceApiSchema,
    rows: z
      .array(
        z
          .object({
            expirationDate: DayApiSchema.optional(),
            itemId: z.uuid().optional(),
            lineTotalCents: PriceApiSchema.optional(),
            newItem: z
              .object({
                categoryId: z.uuid().optional(),
                description: DescriptionSchema,
                locationId: z.uuid().optional(),
              })
              .strict()
              .optional(),
            quantity: PositiveQuantitySchema.optional(),
            rowId: z.uuid(),
            unitPriceCents: PriceApiSchema.optional(),
            unknownPrice: z.boolean().optional(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();
export const UpdateClosedPurchaseApiSchema = z
  .object({
    accountId: z.uuid().optional(),
    creditCardId: z.uuid().optional(),
    date: DayApiSchema.optional(),
    invoiceMonth: InvoiceMonthApiSchema.optional(),
    marketId: z.uuid().optional(),
    receiptTotalCents: PriceApiSchema.optional(),
    rows: z
      .array(
        z
          .object({
            lineTotalCents: PriceApiSchema.optional(),
            rowId: z.uuid(),
            unitPriceCents: PriceApiSchema.optional(),
          })
          .strict(),
      )
      .max(500)
      .optional(),
  })
  .strict();
export const ListPurchasesQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z
    .string()
    .optional()
    .transform((value) => (value ?? 'OPEN,ENDED').split(',')),
});
export const PricesQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  marketId: z.uuid().optional(),
});
export const ClosePreviewQuerySchema = z.object({
  receiptTotalCents: z.coerce.number().int().min(1).max(99_999_999).optional(),
});

export type ClosePurchaseApiInput = z.infer<typeof ClosePurchaseApiSchema>;
export type CreateMarketApiInput = z.infer<typeof CreateMarketApiSchema>;
export type StartPurchaseApiInput = z.infer<typeof StartPurchaseApiSchema>;
export type UpdateClosedPurchaseApiInput = z.infer<typeof UpdateClosedPurchaseApiSchema>;
export type UpdateMarketApiInput = z.infer<typeof UpdateMarketApiSchema>;
export type UpsertPurchaseRowApiInput = z.infer<typeof UpsertPurchaseRowApiSchema>;

const MarketSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  neighborhood: z.string().nullable(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  status: z.enum(StockCatalogStatus),
});
const PurchaseRowSchema = z.object({
  checkedAt: z.string(),
  checkedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  description: z.string(),
  expirationDate: z.string().nullable(),
  id: z.uuid(),
  itemId: z.uuid().nullable(),
  lastPrice: z.object({ date: z.string(), unitPriceCents: z.number().int() }).nullable(),
  lineTotalCents: z.number().int().nullable(),
  listRowId: z.uuid().nullable(),
  priceChangePercent: z.number().int().nullable(),
  priceInput: z.enum(['LINE', 'UNIT']).nullable(),
  quantity: z.number().nullable(),
  state: z.enum(['IN_CART', 'NOT_FOUND']),
  unit: UnitApiSchema.nullable(),
  unitPriceCents: z.number().int().nullable(),
  unknownPrice: z.boolean(),
});
const PurchaseHeaderSchema = z.object({
  accountId: z.uuid().nullable(),
  closing: z.object({ at: z.string(), by: z.string() }).nullable(),
  creditCardId: z.uuid().nullable(),
  currency: z.string(),
  id: z.uuid(),
  invoiceMonth: z.string().nullable(),
  lastActivityAt: z.string(),
  listId: z.uuid(),
  marketId: z.uuid(),
  purchaseDate: z.string(),
  receiptTotalCents: z.number().int().nullable(),
  splitId: z.uuid().nullable(),
  startedBy: z.string().nullable(),
  status: z.enum(['CLOSED', 'DISCARDED', 'ENDED', 'OPEN']),
  transactionId: z.uuid().nullable(),
});
const PurchaseViewApiSchema = z.object({
  cart: z.object({
    count: z.number().int(),
    totalCents: z.number().int(),
    unpricedCount: z.number().int(),
  }),
  forecastCents: z.number().int(),
  otherCarts: z.array(
    z.object({
      listRowId: z.uuid(),
      marketName: z.string(),
      purchaseId: z.uuid(),
      userName: z.string(),
    }),
  ),
  purchase: PurchaseHeaderSchema,
  remaining: z.object({
    count: z.number().int(),
    estimatedCents: z.number().int(),
    pricedCount: z.number().int(),
  }),
  rows: z.array(PurchaseRowSchema),
});

export class ClosedPurchaseOutput extends createZodDto(
  z.object({
    list: z.object({ removedRows: z.number().int(), updatedRows: z.number().int() }),
    purchase: PurchaseHeaderSchema,
    splitId: z.uuid().nullable(),
    stock: z.object({ lots: z.number().int(), newItems: z.number().int() }),
    transactionId: z.uuid().nullable(),
  }),
) {}
export class ClosePreviewOutput extends createZodDto(
  z.object({
    expirations: z.array(z.object({ rowId: z.uuid(), suggestedDate: z.string() })),
    financeError: z.string().nullable(),
    financeParts: z
      .array(
        z.object({
          categoryId: z.string().nullable(),
          kind: z.enum(['ADJUSTMENT', 'CATEGORY', 'NO_PRICE']),
          valueCents: z.number().int(),
        }),
      )
      .nullable(),
    missingPrices: z.array(z.uuid()),
    needsDefaultFinanceCategory: z.boolean(),
    newItems: z.array(
      z.object({
        description: z.string(),
        rowId: z.uuid(),
        suggestion: z.object({ description: z.string(), itemId: z.uuid() }).nullable(),
        unit: z.string().nullable(),
      }),
    ),
    unknownWeight: z.array(z.uuid()),
  }),
) {}
export class ClosePurchaseBody extends createZodDto(ClosePurchaseApiSchema) {}
export class ClosingLockOutput extends createZodDto(
  z.object({ closingAt: z.string().nullable(), closingBy: z.string().nullable() }),
) {}
export class CreateMarketBody extends createZodDto(CreateMarketApiSchema) {}
export class DeletedPurchaseOutput extends createZodDto(
  z.object({ keptRows: z.array(z.object({ description: z.string(), rowId: z.uuid() })) }),
) {}
export class ItemPricesOutput extends createZodDto(
  z.object({
    items: z.array(
      z.object({
        date: z.string(),
        id: z.uuid(),
        marketId: z.uuid(),
        unitPriceCents: z.number().int(),
      }),
    ),
    nextCursor: z.string().nullable(),
  }),
) {}
export class ListPurchasesOutput extends createZodDto(
  z.object({
    items: z.array(PurchaseViewApiSchema.or(PurchaseHeaderSchema)),
    nextCursor: z.string().nullable(),
  }),
) {}
export class MarketOutput extends createZodDto(MarketSchema) {}
export class MarketsOutput extends createZodDto(z.object({ items: z.array(MarketSchema) })) {}
export class PendingPurchasesOutput extends createZodDto(
  z.object({
    items: z.array(
      z.object({
        cartTotalCents: z.number().int(),
        checkedCount: z.number().int(),
        id: z.uuid(),
        lastActivityAt: z.string(),
        listId: z.uuid(),
        listName: z.string(),
        marketName: z.string(),
        status: z.enum(['ENDED', 'OPEN']),
      }),
    ),
  }),
) {}
export class PurchaseHeaderOutput extends createZodDto(PurchaseHeaderSchema) {}
export const AddRowByCodeApiSchema = z.object({ code: z.string().trim().min(1).max(80) });
export class AddRowByCodeBody extends createZodDto(AddRowByCodeApiSchema) {}
export class PurchaseRowByCodeOutput extends createZodDto(
  z.object({ row: PurchaseRowSchema, source: z.enum(['ITEM', 'NONE', 'OPEN_FOOD_FACTS']) }),
) {}
export class PurchaseRowResultOutput extends createZodDto(
  z.object({
    conflict: z.object({ purchaseId: z.uuid(), userName: z.string() }).nullable(),
    convertedToOutside: z.boolean(),
    row: PurchaseRowSchema,
  }),
) {}
export class PurchaseViewOutput extends createZodDto(PurchaseViewApiSchema) {}
export class StartPurchaseBody extends createZodDto(StartPurchaseApiSchema) {}
export class UpdateClosedPurchaseBody extends createZodDto(UpdateClosedPurchaseApiSchema) {}
export class UpdateMarketBody extends createZodDto(UpdateMarketApiSchema) {}
export class UpsertPurchaseRowBody extends createZodDto(UpsertPurchaseRowApiSchema) {}
