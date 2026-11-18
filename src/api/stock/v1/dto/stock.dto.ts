import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  CatalogNameSchema,
  DescriptionSchema,
  OpenedShelfLifeDaysSchema,
  PositiveQuantitySchema,
  QuantitySchema,
  StepSchema as StepApiSchema,
  WarnDaysSchema,
} from '@stock/application/dto/StockCommon';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import { StockMovementReasons, StockMovementTypes } from '@stock/domain/entity/StockMovementEntity';

// Plain strings (no transforms) so Swagger can describe them; the use cases convert to Date.
const DayApiSchema = z.iso.date();
const BarcodeApiSchema = z.string().trim().max(64);
const BrandApiSchema = z.string().trim().max(100);
const NotesApiSchema = z.string().max(1000);
const OwnerTypeApiSchema = z.enum(OwnerType);
const StockUnitApiSchema = z.enum(StockUnits);
const LotStatusSchema = z.enum(['EXPIRED', 'EXPIRING', 'NONE', 'OK']);

export const CreateStockItemApiSchema = z
  .object({
    barcode: BarcodeApiSchema.nullish(),
    brand: BrandApiSchema.nullish(),
    categoryId: z.uuid().nullish(),
    description: DescriptionSchema,
    expirationDate: DayApiSchema.nullish(),
    idealQuantity: QuantitySchema.nullish(),
    locationId: z.uuid().nullish(),
    minQuantity: QuantitySchema.nullish(),
    notes: NotesApiSchema.nullish(),
    openedShelfLifeDays: OpenedShelfLifeDaysSchema.nullish(),
    owner: OwnerTypeApiSchema,
    ownerId: z.uuid(),
    purchaseDate: DayApiSchema.nullish(),
    quantity: QuantitySchema.optional(),
    quickStep: StepApiSchema.nullish(),
    stockOnly: z.boolean().optional(),
    unit: StockUnitApiSchema,
    warnDaysClosed: WarnDaysSchema.optional(),
    warnDaysOpened: WarnDaysSchema.optional(),
  })
  .strict();

// PATCH: `.partial().strict()` rejects unknown keys (quantity and lot dates are NOT editable here); `null` clears
// optionals only.
export const UpdateStockItemApiSchema = z
  .object({
    barcode: BarcodeApiSchema.nullable(),
    brand: BrandApiSchema.nullable(),
    categoryId: z.uuid().nullable(),
    description: DescriptionSchema,
    idealQuantity: QuantitySchema.nullable(),
    locationId: z.uuid().nullable(),
    minQuantity: QuantitySchema.nullable(),
    notes: NotesApiSchema.nullable(),
    openedShelfLifeDays: OpenedShelfLifeDaysSchema.nullable(),
    owner: OwnerTypeApiSchema,
    ownerId: z.uuid(),
    quickStep: StepApiSchema.nullable(),
    stockOnly: z.boolean(),
    unit: StockUnitApiSchema,
    warnDaysClosed: WarnDaysSchema,
    warnDaysOpened: WarnDaysSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  })
  .refine((value) => (value.owner === undefined) === (value.ownerId === undefined), {
    message: 'owner and ownerId must be sent together',
  });

// Spec 117 FR 25: optional on every body; `expiredLots` on a non-CONSUME movement is a 422 of the use case.
const QuickFields = {
  expiredLots: z.enum(['DISCARD_THEN_VALID', 'EXPIRED_FIRST', 'VALID_ONLY']).optional(),
  gestureId: z.uuid().optional(),
};
// Spec 117 FR 21: the client-generated key of a write; optional for 116 clients.
export const IdempotencyKeySchema = z.uuid().optional();
const MovementBase = {
  lotId: z.uuid().nullish(),
  note: z.string().trim().max(200).nullish(),
  today: DayApiSchema.optional(),
};

export const CreateStockMovementApiSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...QuickFields,
      expirationDate: DayApiSchema.nullish(),
      note: MovementBase.note,
      purchaseDate: DayApiSchema.nullish(),
      quantity: PositiveQuantitySchema,
      reason: z.enum([StockMovementReasons.PURCHASE, StockMovementReasons.MANUAL]).optional(),
      target: z.literal('LATEST_CLOSED').optional(),
      today: MovementBase.today,
      type: z.literal(StockMovementTypes.ENTRY),
    })
    .strict(),
  z
    .object({
      ...MovementBase,
      ...QuickFields,
      quantity: PositiveQuantitySchema,
      type: z.literal(StockMovementTypes.CONSUME),
    })
    .strict(),
  z
    .object({
      ...MovementBase,
      ...QuickFields,
      quantity: PositiveQuantitySchema.optional(),
      type: z.literal(StockMovementTypes.OPEN),
    })
    .strict(),
  z
    .object({
      ...QuickFields,
      lotId: z.uuid(),
      note: MovementBase.note,
      quantity: PositiveQuantitySchema.optional(),
      reason: z.enum([
        StockMovementReasons.EXPIRED,
        StockMovementReasons.SPOILED,
        StockMovementReasons.OTHER,
      ]),
      today: MovementBase.today,
      type: z.literal(StockMovementTypes.DISCARD),
    })
    .strict(),
  z
    .object({
      ...MovementBase,
      ...QuickFields,
      countedQuantity: QuantitySchema,
      type: z.literal(StockMovementTypes.ADJUST),
    })
    .strict(),
]);

const CategoryRefSchema = z.object({
  archived: z.boolean(),
  id: z.uuid(),
  name: z.string(),
  path: z.string(),
});
const LocationRefSchema = z.object({ archived: z.boolean(), id: z.uuid(), name: z.string() });

export const StockLotApiSchema = z.object({
  effectiveExpiration: DayApiSchema.nullable(),
  expirationDate: DayApiSchema.nullable(),
  expirationStatus: LotStatusSchema,
  id: z.uuid(),
  openedAt: DayApiSchema.nullable(),
  purchaseDate: DayApiSchema.nullable(),
  quantity: z.number(),
});

const ItemFields = {
  barcode: z.string().nullable(),
  brand: z.string().nullable(),
  category: CategoryRefSchema.nullable(),
  categoryId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  description: z.string(),
  expirationStatus: LotStatusSchema,
  hasExpiredLot: z.boolean(),
  hasOpenLot: z.boolean(),
  id: z.uuid(),
  idealQuantity: z.number().nullable(),
  location: LocationRefSchema.nullable(),
  locationId: z.uuid().nullable(),
  minQuantity: z.number().nullable(),
  nearestExpiration: DayApiSchema.nullable(),
  needsRestock: z.boolean(),
  notes: z.string().nullable(),
  openedShelfLifeDays: z.number().int().nullable(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  quantity: z.number(),
  quickStep: z.number().nullable(),
  restockQuantity: z.number(),
  stockOnly: z.boolean(),
  unit: StockUnitApiSchema,
  updatedAt: z.iso.datetime(),
  warnDaysClosed: z.number().int(),
  warnDaysOpened: z.number().int(),
};

// The list never carries lots or movements (FR 34); the detail adds the lots with quantity > 0 (FR 35).
export const StockListItemApiSchema = z.object(ItemFields);
export const StockItemApiSchema = z.object({ ...ItemFields, lots: z.array(StockLotApiSchema) });

export const StockMovementApiSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  lotId: z.uuid(),
  note: z.string().nullable(),
  quantity: z.number(),
  reason: z.enum(StockMovementReasons).nullable(),
  type: z.enum(StockMovementTypes),
  // `null` for a user who left the family, was deleted or never existed ("Ex-membro" in the UI).
  user: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});
export const StockMovementResultApiSchema = z.object({
  item: StockItemApiSchema,
  movements: z.array(StockMovementApiSchema),
});
export const StockMovementPageApiSchema = z.object({
  items: z.array(StockMovementApiSchema),
  nextCursor: z.string().nullable(),
});
export const StockSuggestionApiSchema = z.object({
  items: z.array(
    z.object({
      brand: z.string().nullable(),
      description: z.string(),
      id: z.uuid(),
      quantity: z.number(),
      score: z.number(),
      unit: StockUnitApiSchema,
    }),
  ),
});
const OwnerChangeSideSchema = z.object({ from: z.string().nullable(), to: z.string().nullable() });
export const OwnerChangePreviewApiSchema = z.object({
  category: OwnerChangeSideSchema,
  location: OwnerChangeSideSchema,
});

function toList(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined || Array.isArray(value)) {
    return value;
  }

  return [value];
}

const ListQueryIds = z
  .union([z.uuid(), z.array(z.uuid())])
  .optional()
  .transform(toList);

export const ListStockItemsQuerySchema = z.object({
  categoryId: ListQueryIds,
  locationId: ListQueryIds,
  owner: OwnerTypeApiSchema.optional(),
  ownerId: z.uuid().optional(),
  today: DayApiSchema.optional(),
});
export const DayQuerySchema = z.object({ today: DayApiSchema.optional() });
export const MovementsQuerySchema = z.object({ cursor: z.string().min(1).max(200).optional() });
// Spec 117 FR 29: without owner the search covers every owner the requester can write.
export const SuggestionsQuerySchema = z.object({
  owner: OwnerTypeApiSchema.optional(),
  ownerId: z.uuid().optional(),
  q: z.string().trim().min(2).max(100),
});
export const FrequentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).optional(),
  today: DayApiSchema.optional(),
});
export const UndoGestureApiSchema = z.object({ gestureId: z.uuid() }).strict();
export const GestureExpirationApiSchema = z
  .object({ expirationDate: DayApiSchema, today: DayApiSchema.optional() })
  .strict();
export const OwnerChangePreviewQuerySchema = z.object({
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
});

export const CatalogOwnerQuerySchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
});
export const CatalogSuggestionsBodySchema = z
  .object({ owner: OwnerTypeApiSchema, ownerId: z.uuid() })
  .strict();
export const CreateStockCategoryApiSchema = z
  .object({
    financeCategoryId: z.uuid().nullish(),
    name: CatalogNameSchema,
    owner: OwnerTypeApiSchema,
    ownerId: z.uuid(),
    parentId: z.uuid().nullish(),
  })
  .strict();
export const UpdateStockCategoryApiSchema = z
  .object({
    financeCategoryId: z.uuid().nullable(),
    name: CatalogNameSchema,
    parentId: z.uuid().nullable(),
    status: z.enum(StockCatalogStatus),
  })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  });
export const CreateStockLocationApiSchema = z
  .object({ name: CatalogNameSchema, owner: OwnerTypeApiSchema, ownerId: z.uuid() })
  .strict();
export const UpdateStockLocationApiSchema = z
  .object({ name: CatalogNameSchema, status: z.enum(StockCatalogStatus) })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  });

export interface StockCategoryNodeOutput {
  children: StockCategoryNodeOutput[];
  effectiveFinanceCategoryId: null | string;
  financeCategoryId: null | string;
  id: string;
  itemCount: number;
  name: string;
  parentId: null | string;
  status: 'ACTIVE' | 'ARCHIVED';
}
export const StockCategoryNodeApiSchema: z.ZodType<StockCategoryNodeOutput> = z.lazy(() =>
  z.object({
    children: z.array(StockCategoryNodeApiSchema),
    effectiveFinanceCategoryId: z.uuid().nullable(),
    financeCategoryId: z.uuid().nullable(),
    id: z.uuid(),
    itemCount: z.number().int(),
    name: z.string(),
    parentId: z.uuid().nullable(),
    status: z.enum(StockCatalogStatus),
  }),
);
export const StockCategoryTreeApiSchema = z.object({ items: z.array(StockCategoryNodeApiSchema) });
export const StockCategoryApiSchema = z.object({
  financeCategoryId: z.uuid().nullable(),
  id: z.uuid(),
  name: z.string(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  parentId: z.uuid().nullable(),
  status: z.enum(StockCatalogStatus),
});
export const StockCategoryListApiSchema = z.object({ items: z.array(StockCategoryApiSchema) });
export const StockLocationApiSchema = z.object({
  id: z.uuid(),
  itemCount: z.number().int().optional(),
  name: z.string(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  status: z.enum(StockCatalogStatus),
});
export const StockItemResultApiSchema = z.object({ item: StockItemApiSchema });
export const StockFrequentApiSchema = z.object({ items: z.array(StockListItemApiSchema) });
export const StockLocationListApiSchema = z.object({ items: z.array(StockLocationApiSchema) });

export type CreateStockCategoryApiInput = z.infer<typeof CreateStockCategoryApiSchema>;
export type CreateStockItemApiInput = z.infer<typeof CreateStockItemApiSchema>;
export type CreateStockLocationApiInput = z.infer<typeof CreateStockLocationApiSchema>;
export type CreateStockMovementApiInput = z.infer<typeof CreateStockMovementApiSchema>;
export type StockItemApiOutput = z.infer<typeof StockItemApiSchema>;
export type StockListItemApiOutput = z.infer<typeof StockListItemApiSchema>;
export type UpdateStockCategoryApiInput = z.infer<typeof UpdateStockCategoryApiSchema>;
export type UpdateStockItemApiInput = z.infer<typeof UpdateStockItemApiSchema>;
export type UpdateStockLocationApiInput = z.infer<typeof UpdateStockLocationApiSchema>;

export class CreateStockCategoryBody extends createZodDto(CreateStockCategoryApiSchema) {}
export class CreateStockItemBody extends createZodDto(CreateStockItemApiSchema) {}
export class CreateStockLocationBody extends createZodDto(CreateStockLocationApiSchema) {}
// A union cannot be a DTO base: Swagger documents the discriminator, the schema above validates the body.
export class CreateStockMovementBody extends createZodDto(
  z.looseObject({ type: z.enum(StockMovementTypes) }),
) {}
export class GestureExpirationBody extends createZodDto(
  z.looseObject({ expirationDate: z.string() }),
) {}
export class OwnerChangePreviewOutput extends createZodDto(OwnerChangePreviewApiSchema) {}
export class StockCategoryListOutput extends createZodDto(StockCategoryListApiSchema) {}
export class StockCategoryOutput extends createZodDto(StockCategoryApiSchema) {}
export class StockCategoryTreeOutput extends createZodDto(StockCategoryTreeApiSchema) {}
export class StockFrequentOutput extends createZodDto(StockFrequentApiSchema) {}
export class StockItemOutput extends createZodDto(StockItemApiSchema) {}
export class StockItemResultOutput extends createZodDto(StockItemResultApiSchema) {}
export class StockListItemOutput extends createZodDto(StockListItemApiSchema) {}
export class StockLocationListOutput extends createZodDto(StockLocationListApiSchema) {}
export class StockLocationOutput extends createZodDto(StockLocationApiSchema) {}
export class StockMovementPageOutput extends createZodDto(StockMovementPageApiSchema) {}
export class StockMovementResultOutput extends createZodDto(StockMovementResultApiSchema) {}
export class StockSuggestionOutput extends createZodDto(StockSuggestionApiSchema) {}
export class UndoGestureBody extends createZodDto(z.looseObject({ gestureId: z.string() })) {}
export class UpdateStockCategoryBody extends createZodDto(UpdateStockCategoryApiSchema) {}
export class UpdateStockItemBody extends createZodDto(UpdateStockItemApiSchema) {}
export class UpdateStockLocationBody extends createZodDto(UpdateStockLocationApiSchema) {}
