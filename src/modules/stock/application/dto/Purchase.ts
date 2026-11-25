import { z } from 'zod';

import {
  AccessibleOwnersSchema,
  DaySchema,
  DescriptionSchema,
  OwnerIdSchema,
  OwnerTypeSchema,
  PositiveQuantitySchema,
  UnitSchema,
} from '@stock/application/dto/StockCommon';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

// Spec 120: money in minor units, like 118.
const PriceSchema = z.number().int().min(1).max(99_999_999);
const IdSchema = z.string().min(1);
const UuidSchema = z.uuid();
const MarketNameSchema = z.string().trim().min(1).max(60);
const OptionalUserSchema = { accessibleOwners: AccessibleOwnersSchema, userId: IdSchema };

export const GetMarketsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  includeArchived: z.boolean().default(false),
  ownerId: OwnerIdSchema.optional(),
});
export const CreateMarketSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  name: MarketNameSchema,
  neighborhood: MarketNameSchema.optional(),
  owner: OwnerTypeSchema,
  ownerId: OwnerIdSchema,
});
export const UpdateMarketSchema = z
  .object({
    accessibleOwners: AccessibleOwnersSchema,
    id: IdSchema,
    name: MarketNameSchema.optional(),
    neighborhood: MarketNameSchema.nullable().optional(),
    status: z.enum(StockCatalogStatus).optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined || input.neighborhood !== undefined || input.status !== undefined,
    { message: 'At least one field is required' },
  );

export const StartPurchaseSchema = z.object({
  ...OptionalUserSchema,
  id: UuidSchema,
  listId: IdSchema,
  marketId: IdSchema,
  purchaseDate: DaySchema,
});
export const GetPurchaseSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
});
export const GetListPurchasesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  closed: z.boolean().default(false),
  cursor: z.object({ closedAt: z.date(), id: IdSchema }).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  listId: IdSchema,
  now: z.date().optional(),
});
export const UpsertPurchaseRowSchema = z
  .object({
    ...OptionalUserSchema,
    barcode: z.string().trim().min(1).max(80).optional(),
    clientId: UuidSchema.optional(),
    description: DescriptionSchema.optional(),
    expirationDate: DaySchema.nullable().optional(),
    itemId: IdSchema.optional(),
    lineTotalCents: PriceSchema.nullable().optional(),
    listRowId: IdSchema.optional(),
    priceInput: z.enum(['LINE', 'UNIT']).optional(),
    purchaseId: IdSchema,
    quantity: PositiveQuantitySchema.nullable().optional(),
    rowId: UuidSchema,
    state: z.enum(['IN_CART', 'NOT_FOUND']).optional(),
    unit: UnitSchema.optional(),
    unitPriceCents: PriceSchema.nullable().optional(),
  })
  .refine(
    (input) =>
      input.itemId !== undefined ||
      input.listRowId !== undefined ||
      (input.description !== undefined && input.unit !== undefined) ||
      input.state !== undefined ||
      input.quantity !== undefined ||
      input.unitPriceCents !== undefined ||
      input.lineTotalCents !== undefined ||
      input.expirationDate !== undefined,
    { message: 'Nothing to save' },
  );
export const DeletePurchaseRowSchema = z.object({
  ...OptionalUserSchema,
  clientId: UuidSchema.optional(),
  purchaseId: IdSchema,
  rowId: UuidSchema,
});
export const ChangePurchaseStatusSchema = z.object({
  ...OptionalUserSchema,
  action: z.enum(['DISCARD', 'END', 'REOPEN']),
  clientId: UuidSchema.optional(),
  id: IdSchema,
});
export const MergePurchaseSchema = z.object({
  ...OptionalUserSchema,
  id: IdSchema,
  targetId: IdSchema,
});
export const ClosingLockSchema = z.object({
  ...OptionalUserSchema,
  id: IdSchema,
  now: z.date().optional(),
  release: z.boolean().default(false),
});
export const GetClosePreviewSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  id: IdSchema,
  receiptTotalCents: PriceSchema.optional(),
});
const CloseRowSchema = z.object({
  expirationDate: DaySchema.optional(),
  itemId: IdSchema.optional(),
  lineTotalCents: PriceSchema.optional(),
  newItem: z
    .object({
      categoryId: IdSchema.optional(),
      description: DescriptionSchema,
      locationId: IdSchema.optional(),
    })
    .optional(),
  quantity: PositiveQuantitySchema.optional(),
  rowId: UuidSchema,
  unitPriceCents: PriceSchema.optional(),
  unknownPrice: z.boolean().optional(),
});
const CloseBodySchema = z.object({
  accountId: IdSchema.optional(),
  clientId: UuidSchema.optional(),
  creditCardId: IdSchema.optional(),
  date: DaySchema,
  defaultFinanceCategoryId: IdSchema.optional(),
  invoiceMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  marketId: IdSchema.optional(),
  receiptTotalCents: PriceSchema,
  rows: z.array(CloseRowSchema).max(500),
});
export const ClosePurchaseSchema = CloseBodySchema.extend({
  ...OptionalUserSchema,
  id: IdSchema,
  language: z.enum(['en-US', 'pt-BR']).optional(),
}).refine((input) => (input.accountId === undefined) !== (input.creditCardId === undefined), {
  message: 'Choose one source: an account or a card',
});
export const UpdateClosedPurchaseSchema = z.object({
  ...OptionalUserSchema,
  accountId: IdSchema.optional(),
  creditCardId: IdSchema.optional(),
  date: DaySchema.optional(),
  id: IdSchema,
  invoiceMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  marketId: IdSchema.optional(),
  receiptTotalCents: PriceSchema.optional(),
  rows: z
    .array(
      z.object({
        lineTotalCents: PriceSchema.optional(),
        rowId: UuidSchema,
        unitPriceCents: PriceSchema.optional(),
      }),
    )
    .max(500)
    .optional(),
});
export const DeleteClosedPurchaseSchema = z.object({ ...OptionalUserSchema, id: IdSchema });
export const GetPendingPurchasesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  now: z.date().optional(),
  userId: IdSchema,
});
export const GetItemPricesSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  cursor: z.object({ date: z.date(), id: IdSchema }).optional(),
  itemId: IdSchema,
  limit: z.number().int().min(1).max(100).default(50),
  marketId: IdSchema.optional(),
});
export const GetPurchaseEventsSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  afterId: z.bigint().default(0n),
  listId: IdSchema,
});

export type ChangePurchaseStatusInput = z.input<typeof ChangePurchaseStatusSchema>;
export type ClosePurchaseInput = z.input<typeof ClosePurchaseSchema>;
export type ClosingLockInput = z.input<typeof ClosingLockSchema>;
export type CreateMarketInput = z.input<typeof CreateMarketSchema>;
export type DeleteClosedPurchaseInput = z.input<typeof DeleteClosedPurchaseSchema>;
export type DeletePurchaseRowInput = z.input<typeof DeletePurchaseRowSchema>;
export type GetClosePreviewInput = z.input<typeof GetClosePreviewSchema>;
export type GetItemPricesInput = z.input<typeof GetItemPricesSchema>;
export type GetListPurchasesInput = z.input<typeof GetListPurchasesSchema>;
export type GetMarketsInput = z.input<typeof GetMarketsSchema>;
export type GetPendingPurchasesInput = z.input<typeof GetPendingPurchasesSchema>;
export type GetPurchaseEventsInput = z.input<typeof GetPurchaseEventsSchema>;
export type GetPurchaseInput = z.input<typeof GetPurchaseSchema>;
export type MergePurchaseInput = z.input<typeof MergePurchaseSchema>;
export type StartPurchaseInput = z.input<typeof StartPurchaseSchema>;
export type UpdateClosedPurchaseInput = z.input<typeof UpdateClosedPurchaseSchema>;
export type UpdateMarketInput = z.input<typeof UpdateMarketSchema>;
export type UpsertPurchaseRowInput = z.input<typeof UpsertPurchaseRowSchema>;
export type UpsertPurchaseRowParsed = z.output<typeof UpsertPurchaseRowSchema>;

// Spec 121 FR 25: "Ler código" in the shopping mode; the row id is the client's (offline) or generated.
export const AddPurchaseRowByCodeSchema = z.object({
  ...OptionalUserSchema,
  clientId: UuidSchema.optional(),
  code: z.string().trim().min(1).max(80),
  purchaseId: IdSchema,
  rowId: UuidSchema.optional(),
});
export type AddPurchaseRowByCodeInput = z.input<typeof AddPurchaseRowByCodeSchema>;
