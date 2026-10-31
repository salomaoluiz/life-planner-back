import { Injectable } from '@nestjs/common';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { GetUpcomingItemsUseCase } from '@finance/application/use-case/GetUpcomingItemsUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';

@Injectable()
export class UpcomingService {
  constructor(
    private readonly financeAccessService: FinanceAccessService,
    private readonly getUpcomingItemsUseCase: GetUpcomingItemsUseCase,
    private readonly materializeRecurrencesUseCase: MaterializeRecurrencesUseCase,
  ) {}

  async getUpcoming(
    userId: string,
    request: { days: number; limit: number; ownerIds: string[]; today: string },
  ) {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    // Spec 062 FR 21: due occurrences become real rows first, so only later ones are projections.
    await this.materializeRecurrencesUseCase.execute({
      accessibleOwners,
      ownerIds: request.ownerIds,
      today: request.today,
    });

    return this.getUpcomingItemsUseCase.execute({ ...request, accessibleOwners });
  }
}
