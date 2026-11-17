import { Injectable } from '@nestjs/common';

import {
  MarketIndexesOutputType,
  MarketIndexHistoryOutputType,
} from '@api/investment/v1/dto/market-index.dto';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { todayInSaoPaulo } from '@investment/application/service/Today';
import { GetMarketIndexesUseCase } from '@investment/application/use-case/GetMarketIndexesUseCase';
import { GetMarketIndexHistoryUseCase } from '@investment/application/use-case/GetMarketIndexHistoryUseCase';
import { RefreshMarketIndexesNowUseCase } from '@investment/application/use-case/RefreshMarketIndexesNowUseCase';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { MarketIndex } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Spec 113 FR 17-19 and 9: the global indexes with the titles THIS user can read following them.
@Injectable()
export class MarketIndexService {
  constructor(
    private readonly getMarketIndexesUseCase: GetMarketIndexesUseCase,
    private readonly getMarketIndexHistoryUseCase: GetMarketIndexHistoryUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly refreshMarketIndexesNowUseCase: RefreshMarketIndexesNowUseCase,
  ) {}

  async getHistory(
    userId: string,
    index: MarketIndex,
    from: string,
    to: string,
  ): Promise<MarketIndexHistoryOutputType> {
    return this.getMarketIndexHistoryUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      from,
      index,
      to,
      today: todayInSaoPaulo(),
    });
  }

  async getSummary(userId: string): Promise<MarketIndexesOutputType> {
    return this.getMarketIndexesUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      today: todayInSaoPaulo(),
    });
  }

  async refresh(userId: string): Promise<MarketIndexesOutputType> {
    await this.refreshMarketIndexesNowUseCase.execute({ userId });

    return this.getSummary(userId);
  }

  // Resolved on every request: the caller plus every family they own or joined.
  private async getAccessibleOwners(userId: string): Promise<OwnerAccess[]> {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);

    return [
      { owner: OwnerType.USER, ownerId: userId },
      ...families.map(({ archived, familyId }) => ({
        archived,
        owner: OwnerType.FAMILY,
        ownerId: familyId,
      })),
    ];
  }
}
