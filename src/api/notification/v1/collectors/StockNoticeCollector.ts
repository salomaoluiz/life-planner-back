import { Injectable } from '@nestjs/common';

import { CollectRequest, INoticeCollector, stateOf } from '@api/notification/v1/collectors/types';
import { NotificationItemInput } from '@notification/domain/entity/NotificationItem';
import { FindExpiringLotsForOwnersUseCase } from '@stock/application/use-case/FindExpiringLotsForOwnersUseCase';

// Spec 124 FR 1-3: STOCK_EXPIRING (closed lot) and STOCK_OPENED_EXPIRING (open lot) inside the ITEM's window (116 FR 20,
// the rule of the "Vencendo" badge), expired lots until discarded. "Stock only" items notify too.
@Injectable()
export class StockNoticeCollector implements INoticeCollector {
  constructor(private readonly findExpiringLotsUseCase: FindExpiringLotsForOwnersUseCase) {}

  async collect(request: CollectRequest): Promise<NotificationItemInput[]> {
    const lots = await this.findExpiringLotsUseCase.execute({
      owners: request.owners,
      today: request.localDate,
    });

    return lots.map((lot) => ({
      dueDate: lot.expiresOn,
      module: 'STOCK',
      owner: lot.owner,
      ownerId: lot.ownerId,
      route: `/stock/items/${lot.itemId}?lot=${lot.lotId}&ownerId=${lot.ownerId}`,
      snapshot: {
        description: lot.description,
        location: lot.location ?? undefined,
        ownerName: request.ownerNames[lot.ownerId],
        quantity: lot.quantity,
        unit: lot.unit,
      },
      sourceId: lot.lotId,
      state: stateOf(lot.expiresOn, request.localDate),
      type: lot.opened ? 'STOCK_OPENED_EXPIRING' : 'STOCK_EXPIRING',
    }));
  }
}
