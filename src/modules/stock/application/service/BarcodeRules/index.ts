import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { IStockRepository } from '@stock/domain/repository';
import { normalizeBarcode } from '@stock/domain/service/Barcode';

// Spec 121 FR 1: the stored form of a typed code; 422 `BARCODE_INVALID` when it is not a valid code.
export function normalizeOrThrow(raw: string): string {
  const code = normalizeBarcode(raw);

  if (code === undefined) {
    throw new UnprocessableEntityException({ code: 'BARCODE_INVALID', message: 'Invalid barcode' });
  }

  return code;
}

// Spec 121 FR 2: one item per code and owner; 409 `BARCODE_IN_USE` with the item that holds it.
export async function assertBarcodeFree(
  repository: IStockRepository,
  target: { owner: OwnerType; ownerId: string },
  code: string,
  exceptItemId?: string,
): Promise<void> {
  const [holder] = (await repository.findByOwners([target], { barcode: code })).filter(
    (item) => item.id !== exceptItemId,
  );

  if (holder) {
    throw new ConflictException({
      code: 'BARCODE_IN_USE',
      description: holder.description,
      itemId: holder.id,
      message: 'Barcode already in use',
    });
  }
}
