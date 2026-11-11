import { Injectable } from '@nestjs/common';

import {
  ApproveEventSuggestionApiInput,
  CreateFractionSaleApiInput,
  EventSuggestionListOutputType,
} from '@api/investment/v1/dto/corporate-event.dto';
import { toOperationWrite } from '@api/investment/v1/investment.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { ApproveEventSuggestionUseCase } from '@investment/application/use-case/ApproveEventSuggestionUseCase';
import { CreateFractionSaleUseCase } from '@investment/application/use-case/CreateFractionSaleUseCase';
import { GetEventSuggestionsUseCase } from '@investment/application/use-case/GetEventSuggestionsUseCase';
import { RejectEventSuggestionUseCase } from '@investment/application/use-case/RejectEventSuggestionUseCase';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

@Injectable()
export class CorporateEventService {
  constructor(
    private readonly approveEventSuggestionUseCase: ApproveEventSuggestionUseCase,
    private readonly createFractionSaleUseCase: CreateFractionSaleUseCase,
    private readonly getEventSuggestionsUseCase: GetEventSuggestionsUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly rejectEventSuggestionUseCase: RejectEventSuggestionUseCase,
  ) {}

  async approveSuggestion(userId: string, id: string, input: ApproveEventSuggestionApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return toOperationWrite(
      await this.approveEventSuggestionUseCase.execute({ ...input, accessibleOwners, id, userId }),
    );
  }

  async createFractionSale(userId: string, eventId: string, input: CreateFractionSaleApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return toOperationWrite(
      await this.createFractionSaleUseCase.execute({ ...input, accessibleOwners, eventId }),
    );
  }

  // Nulls are left out, like the finance payload (spec 079).
  async findSuggestions(
    userId: string,
    query: {
      assetId?: string;
      cursor?: string;
      limit?: number;
      owner?: 'ALL' | 'FAMILY' | 'USER';
      ownerId?: string;
    },
  ): Promise<EventSuggestionListOutputType> {
    const page = await this.getEventSuggestionsUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      ...query,
    });

    return {
      count: page.items.length,
      items: page.items.map((item) => ({
        assetId: item.assetId,
        ...(item.averagePriceAfter ? { averagePriceAfter: item.averagePriceAfter } : {}),
        ...(item.averagePriceBefore ? { averagePriceBefore: item.averagePriceBefore } : {}),
        ...(item.bonusPercent ? { bonusPercent: item.bonusPercent } : {}),
        ...(item.bonusUnitCost ? { bonusUnitCost: item.bonusUnitCost } : {}),
        currency: item.currency,
        date: item.date,
        fractionQuantity: item.fractionQuantity,
        id: item.id,
        quantityAfter: item.quantityAfter,
        quantityBefore: item.quantityBefore,
        ...(item.ratioFrom ? { ratioFrom: item.ratioFrom } : {}),
        ...(item.ratioTo ? { ratioTo: item.ratioTo } : {}),
        ticker: item.ticker,
        type: item.type as EventSuggestionListOutputType['items'][number]['type'],
      })),
      nextCursor: page.nextCursor,
    };
  }

  async rejectSuggestion(userId: string, id: string): Promise<void> {
    await this.rejectEventSuggestionUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
      userId,
    });
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
