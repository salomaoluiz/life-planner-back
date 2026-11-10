import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import {
  PreviewFixedIncomeRedemptionInput,
  PreviewFixedIncomeRedemptionSchema,
} from '@investment/application/dto/FixedIncome';
import { liquidityWarningOf } from '@investment/application/service/FixedIncomeRules';
import { toCalcInput } from '@investment/application/service/FixedIncomeView';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentFixedIncomeLiquidity } from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
import { calculateTitle } from '@investment/domain/service/FixedIncomeCalculator';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface FixedIncomeRedemptionPreview {
  gross: number;
  iof: number;
  ir: number;
  liquidityWarning: InvestmentFixedIncomeLiquidity | null;
  lots: { date: string; gross: number; operationId: string; principalUsed: number }[];
  net: number;
  remaining: { gross: number; principal: number };
}

const PREVIEW_ID = 'preview';

// Spec 105 FR 34: what a redemption would do (lots used, gross, IR, IOF), computed by the same calculator, nothing written.
export class PreviewFixedIncomeRedemptionUseCase implements UseCaseWithParams<
  PreviewFixedIncomeRedemptionInput,
  FixedIncomeRedemptionPreview
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: PreviewFixedIncomeRedemptionInput): Promise<FixedIncomeRedemptionPreview> {
    const input = validate(PreviewFixedIncomeRedemptionSchema, params);
    const asset = await this.repository.findAssetById(input.assetId);

    if (!asset || !hasOwnerAccess(input.accessibleOwners, asset)) {
      throw new NotFoundException();
    }

    const data = (await this.repository.findFixedIncomeByAssetIds([asset.id])).get(asset.id);

    if (!data?.terms) {
      throw new UnprocessableEntityException('This asset is not a calculated title');
    }

    const base = toCalcInput(
      { ...data, terms: data.terms },
      [...asset.operations].reverse(),
      input.date,
    );
    const result = calculateTitle({
      ...base,
      redemptions: [
        ...base.redemptions,
        { date: input.date, kind: input.kind, netAmount: input.netAmount, operationId: PREVIEW_ID },
      ],
    });

    if (result.error?.operationId === PREVIEW_ID) {
      const { availableNet, date } = result.error;

      throw new UnprocessableEntityException({
        details: { availableNet },
        message: `This is more than the title is worth on ${date} (${(availableNet / 100).toFixed(2)}). Use a total redemption.`,
      });
    }

    const redemption = result.redemptions.get(PREVIEW_ID);

    if (!redemption) {
      throw new UnprocessableEntityException(
        'This change makes a redemption larger than the title',
      );
    }

    return {
      gross: redemption.gross,
      iof: redemption.iof,
      ir: redemption.ir,
      liquidityWarning: liquidityWarningOf(data.terms, input.date),
      lots: redemption.lotsUsed,
      net: input.netAmount,
      remaining: { gross: result.totals.gross, principal: result.remainingPrincipal },
    };
  }
}
