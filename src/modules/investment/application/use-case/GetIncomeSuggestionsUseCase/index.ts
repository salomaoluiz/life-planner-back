import { Inject } from '@nestjs/common';

import {
  GetIncomeSuggestionsInput,
  GetIncomeSuggestionsSchema,
} from '@investment/application/dto/Income';
import {
  IncomeDefaults,
  loadReadableAsset,
  resolveIncomeDefaults,
} from '@investment/application/service/IncomeRules';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { narrowOwners } from '@investment/domain/entity/OwnerAccess';
import { InvestmentAssetStatus, InvestmentIncomeType } from '@investment/domain/enum';
import { IIncomeRepository, IInvestmentRepository } from '@investment/domain/repository';
import {
  bpsToRate,
  suggestNet,
  withholdingBps,
} from '@investment/domain/service/IncomeWithholding';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { Decimal8 } from '@shared/infra/decimal';
import { validate } from '@shared/infra/validation';

export interface IncomeSuggestionView {
  amountPerUnit: string;
  assetId: string;
  canApproveDirectly: boolean;
  currency: string;
  estimatedGross: number;
  estimatedNet: number;
  exDate: string;
  id: string;
  paymentDate: null | string;
  quantity: string;
  ticker: string;
  type: InvestmentIncomeType;
  withholdingRate: string;
}

// Spec 107 FR 27-29, section 7: the stored pending suggestions (no external call), with the estimate and whether
// "Aprovar" can create the income right away (a payment date, a default account and a default category).
export class GetIncomeSuggestionsUseCase implements UseCaseWithParams<
  GetIncomeSuggestionsInput,
  IncomeSuggestionView[]
> {
  constructor(
    @Inject('IInvestmentRepository') private readonly investment: IInvestmentRepository,
    @Inject('IIncomeRepository') private readonly incomes: IIncomeRepository,
  ) {}

  private async assetsOf(
    input: ReturnType<typeof GetIncomeSuggestionsSchema.parse>,
  ): Promise<AssetDetail[]> {
    if (input.assetId) {
      return [await loadReadableAsset(this.investment, input.assetId, input.accessibleOwners)];
    }

    const narrowed = narrowOwners(input.accessibleOwners, input.ownerId).filter(
      (access) => !input.owner || input.owner === 'ALL' || access.owner === input.owner,
    );
    const rows = await this.investment.findAssetsByOwners(narrowed, InvestmentAssetStatus.ACTIVE);

    return rows.map((row) => ({ ...row, valuations: [] }));
  }

  async execute(params: GetIncomeSuggestionsInput): Promise<IncomeSuggestionView[]> {
    const input = validate(GetIncomeSuggestionsSchema, params);
    const assets = await this.assetsOf(input);
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const suggestions = await this.incomes.findPendingSuggestions(assets.map((asset) => asset.id));
    const defaults = new Map<string, IncomeDefaults>();
    const views: IncomeSuggestionView[] = [];

    for (const suggestion of suggestions) {
      const asset = byId.get(suggestion.assetId);

      if (!asset) {
        continue;
      }

      const { event } = suggestion;
      const key = `${asset.id}:${event.type}`;
      const found =
        defaults.get(key) ??
        (await resolveIncomeDefaults(this.incomes, this.investment, input.accessibleOwners, asset, {
          exDate: event.exDate,
          type: event.type,
        }));

      defaults.set(key, found);

      const quantity = Decimal8.parse(suggestion.quantity);
      const perUnit = Decimal8.parse(event.amountPerUnit);
      const bps = withholdingBps(event.type, asset.assetClass);

      views.push({
        amountPerUnit: event.amountPerUnit,
        assetId: asset.id,
        canApproveDirectly:
          event.paymentDate !== null && found.accountId !== null && found.categoryId !== null,
        currency: event.currency,
        estimatedGross: quantity.mulToCents(perUnit),
        estimatedNet: suggestNet(quantity, perUnit, bps),
        exDate: event.exDate,
        id: suggestion.id,
        paymentDate: event.paymentDate,
        quantity: suggestion.quantity,
        ticker: asset.ticker ?? asset.name,
        type: event.type,
        withholdingRate: bpsToRate(bps),
      });
    }

    return views;
  }
}
