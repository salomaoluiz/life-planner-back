import { Injectable } from '@nestjs/common';

import { toListItemOutput } from '@api/stock/v1/stock.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { FindItemsByBarcodeUseCase } from '@stock/application/use-case/FindItemsByBarcodeUseCase';
import { GetAiUsageUseCase } from '@stock/application/use-case/GetAiUsageUseCase';
import { SuggestStockItemUseCase } from '@stock/application/use-case/SuggestStockItemUseCase';

const PERSONAL_OWNER_NAME = 'Pessoal';

@Injectable()
export class StockBarcodeService {
  constructor(
    private readonly findItemsByBarcodeUseCase: FindItemsByBarcodeUseCase,
    private readonly getAiUsageUseCase: GetAiUsageUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly suggestStockItemUseCase: SuggestStockItemUseCase,
  ) {}

  async getUsage(userId: string) {
    return this.getAiUsageUseCase.execute({ userId });
  }

  // Spec 121 FR 12: the owner is checked (404 / 422) before any external call.
  async suggest(
    userId: string,
    input: { barcode?: string; name?: string; owner: OwnerType; ownerId: string },
  ) {
    return this.suggestStockItemUseCase.execute({
      ...input,
      accessibleOwners: await this.getAccessibleOwners(userId),
      userId,
    });
  }

  // Spec 121 FR 8: archived families are readable here and flagged read-only.
  async findByBarcode(userId: string, code: string, today?: string) {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);
    const accessibleOwners = toAccessibleOwners(userId, families);
    const lookup = await this.findItemsByBarcodeUseCase.execute({ accessibleOwners, code, today });

    return {
      code: lookup.code,
      matches: lookup.views.map((view) => {
        const family = families.find(({ familyId }) => familyId === view.item.ownerId);

        return {
          item: toListItemOutput(view),
          owner: view.item.owner,
          ownerId: view.item.ownerId,
          ownerName: family?.name ?? PERSONAL_OWNER_NAME,
          readOnly: family?.archived ?? false,
        };
      }),
    };
  }

  private async getAccessibleOwners(userId: string) {
    return toAccessibleOwners(userId, await this.getUserFamilyAccessUseCase.execute(userId));
  }
}

function toAccessibleOwners(userId: string, families: { archived: boolean; familyId: string }[]) {
  return [
    { owner: OwnerType.USER, ownerId: userId },
    ...families.map(({ archived, familyId }) => ({
      archived,
      owner: OwnerType.FAMILY,
      ownerId: familyId,
    })),
  ];
}
