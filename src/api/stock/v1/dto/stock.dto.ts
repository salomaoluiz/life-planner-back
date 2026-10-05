import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { DescriptionSchema, QuantitySchema } from '@stock/application/dto/StockCommon';
import { StockUnits } from '@stock/domain/entity/StockEntity';

// Plain strings (no transforms) so Swagger can describe them; the use cases convert to Date.
const DateTimeApiSchema = z.iso.datetime({ offset: true });
const BarcodeApiSchema = z.string().trim().max(64);
const BrandApiSchema = z.string().trim().max(100);
const NotesApiSchema = z.string().max(1000);
const OwnerTypeApiSchema = z.enum(OwnerType);
const StockUnitApiSchema = z.enum(StockUnits);

export const CreateStockItemApiSchema = z
  .object({
    barcode: BarcodeApiSchema.nullish(),
    brand: BrandApiSchema.nullish(),
    description: DescriptionSchema,
    expirationDate: DateTimeApiSchema.nullish(),
    notes: NotesApiSchema.nullish(),
    openingDate: DateTimeApiSchema.nullish(),
    owner: OwnerTypeApiSchema,
    ownerId: z.uuid(),
    purchaseDate: DateTimeApiSchema.nullish(),
    quantity: QuantitySchema,
    unit: StockUnitApiSchema,
  })
  .strict();

// PATCH: `.partial().strict()` rejects unknown keys; `null` clears optionals only.
export const UpdateStockItemApiSchema = z
  .object({
    barcode: BarcodeApiSchema.nullable(),
    brand: BrandApiSchema.nullable(),
    description: DescriptionSchema,
    expirationDate: DateTimeApiSchema.nullable(),
    notes: NotesApiSchema.nullable(),
    openingDate: DateTimeApiSchema.nullable(),
    owner: OwnerTypeApiSchema,
    ownerId: z.uuid(),
    purchaseDate: DateTimeApiSchema.nullable(),
    quantity: QuantitySchema,
    unit: StockUnitApiSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  })
  .refine((value) => (value.owner === undefined) === (value.ownerId === undefined), {
    message: 'owner and ownerId must be sent together',
  });

export const StockItemApiSchema = z.object({
  barcode: z.string().nullable(),
  brand: z.string().nullable(),
  createdAt: z.iso.datetime(),
  description: z.string(),
  expirationDate: z.iso.datetime().nullable(),
  id: z.uuid(),
  notes: z.string().nullable(),
  openingDate: z.iso.datetime().nullable(),
  owner: OwnerTypeApiSchema,
  ownerId: z.uuid(),
  purchaseDate: z.iso.datetime().nullable(),
  quantity: z.number().int(),
  unit: StockUnitApiSchema,
  updatedAt: z.iso.datetime(),
});

export type CreateStockItemApiInput = z.infer<typeof CreateStockItemApiSchema>;
export type UpdateStockItemApiInput = z.infer<typeof UpdateStockItemApiSchema>;

export class CreateStockItemBody extends createZodDto(CreateStockItemApiSchema) {}
export class StockItemOutput extends createZodDto(StockItemApiSchema) {}
export class UpdateStockItemBody extends createZodDto(UpdateStockItemApiSchema) {}
