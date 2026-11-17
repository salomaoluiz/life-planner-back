import { Injectable } from '@nestjs/common';

import {
  ConversionOutputType,
  ConversionWriteOutputType,
  CreateConversionApiInput,
  UpdateConversionApiInput,
} from '@api/investment/v1/dto/conversion.dto';
import { toPosition } from '@api/investment/v1/investment.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import {
  ConversionView,
  ConversionWriteResult,
} from '@investment/application/service/ConversionView';
import { CreateConversionUseCase } from '@investment/application/use-case/CreateConversionUseCase';
import { DeleteConversionUseCase } from '@investment/application/use-case/DeleteConversionUseCase';
import { GetConversionByIdUseCase } from '@investment/application/use-case/GetConversionByIdUseCase';
import { UpdateConversionUseCase } from '@investment/application/use-case/UpdateConversionUseCase';
import { OwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Nulls are left out, like the rest of the investment payloads (spec 079).
export function toConversionItem(view: ConversionView): ConversionOutputType['item'] {
  return {
    ...(view.cashAmount === null ? {} : { cashAmount: view.cashAmount }),
    ...(view.cashReferenceUnitValue
      ? { cashReferenceUnitValue: view.cashReferenceUnitValue.toString() }
      : {}),
    date: view.date,
    from: {
      assetId: view.from.assetId,
      cost: view.from.cost,
      operationId: view.from.operationId,
      quantity: view.from.quantity.toString(),
      ...(view.from.ticker ? { ticker: view.from.ticker } : {}),
    },
    id: view.id,
    locked: view.locked,
    ratioFrom: view.ratioFrom.toString(),
    ratioTo: view.ratioTo.toString(),
    to: {
      assetId: view.to.assetId,
      cost: view.to.cost,
      fractionCost: view.to.fractionCost,
      fractionQuantity: view.to.fractionQuantity.toString(),
      operationId: view.to.operationId,
      quantity: view.to.quantity.toString(),
      ...(view.to.ticker ? { ticker: view.to.ticker } : {}),
    },
  };
}
export function toConversionWrite(result: ConversionWriteResult): ConversionWriteOutputType {
  return {
    fromPosition: toPosition(result.fromPosition.position),
    item: toConversionItem(result.item),
    toPosition: toPosition(result.toPosition.position),
  };
}

@Injectable()
export class ConversionService {
  constructor(
    private readonly createConversionUseCase: CreateConversionUseCase,
    private readonly deleteConversionUseCase: DeleteConversionUseCase,
    private readonly getConversionByIdUseCase: GetConversionByIdUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly updateConversionUseCase: UpdateConversionUseCase,
  ) {}

  async create(userId: string, assetId: string, input: CreateConversionApiInput) {
    return toConversionWrite(
      await this.createConversionUseCase.execute({
        ...input,
        accessibleOwners: await this.getAccessibleOwners(userId),
        assetId,
      }),
    );
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.deleteConversionUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
    });
  }

  async findById(userId: string, id: string): Promise<ConversionOutputType> {
    return {
      item: toConversionItem(
        await this.getConversionByIdUseCase.execute({
          accessibleOwners: await this.getAccessibleOwners(userId),
          id,
        }),
      ),
    };
  }

  async update(userId: string, id: string, input: UpdateConversionApiInput) {
    return toConversionWrite(
      await this.updateConversionUseCase.execute({
        ...input,
        accessibleOwners: await this.getAccessibleOwners(userId),
        id,
      }),
    );
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
