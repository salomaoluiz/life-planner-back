import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { z } from 'zod';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { AccessibleOwnersSchema } from '@stock/application/dto/StockCommon';
import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { IStockRepository } from '@stock/domain/repository';

export const DismissLeftoverSchema = z.object({
  accessibleOwners: AccessibleOwnersSchema,
  lotId: z.string().min(1),
  // false = undo the dismissal.
  dismissed: z.boolean(),
});
export type DismissLeftoverInput = z.input<typeof DismissLeftoverSchema>;

// Spec 123 FR 25: "Dispensar aviso" stores the leftover the warning showed; any movement on the lot, or a leftover that
// grows by 1 unit / 0.050 kg-L, brings the warning back. `dismissed: false` is the undo.
@Injectable()
export class DismissLeftoverUseCase implements UseCaseWithParams<DismissLeftoverInput, void> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
  ) {}

  async execute(params: DismissLeftoverInput): Promise<void> {
    const input = validate(DismissLeftoverSchema, params);
    const item = await this.stockRepository.findByLotId(input.lotId);

    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, item);

    if (!input.dismissed) {
      await this.stockRepository.setLeftoverDismissal(input.lotId, null);

      return;
    }

    const leftover = item.forecast;

    if (leftover?.leftoverLotId !== input.lotId || leftover.leftoverQuantity === undefined) {
      throw new UnprocessableEntityException('This lot has no leftover warning');
    }

    await this.stockRepository.setLeftoverDismissal(input.lotId, leftover.leftoverQuantity);
  }
}
