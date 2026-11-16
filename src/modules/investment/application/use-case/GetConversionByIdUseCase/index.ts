import { Inject, NotFoundException } from '@nestjs/common';

import {
  ConversionAccessInput,
  ConversionAccessSchema,
} from '@investment/application/dto/ConversionInput';
import { ConversionView, toConversionView } from '@investment/application/service/ConversionView';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// Spec 112 section 4: anyone who can read the origin or the destination sees the conversion.
export class GetConversionByIdUseCase implements UseCaseWithParams<
  ConversionAccessInput,
  ConversionView
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
  ) {}

  async execute(params: ConversionAccessInput): Promise<ConversionView> {
    const input = validate(ConversionAccessSchema, params);
    const conversion = await this.repository.findConversionById(input.id);
    const origin = conversion ? await this.repository.findAssetById(conversion.fromAssetId) : null;
    const destination = conversion
      ? await this.repository.findAssetById(conversion.toAssetId)
      : null;

    if (
      !conversion ||
      !origin ||
      !destination ||
      !(
        hasOwnerAccess(input.accessibleOwners, origin) ||
        hasOwnerAccess(input.accessibleOwners, destination)
      )
    ) {
      throw new NotFoundException();
    }

    return toConversionView(conversion, origin, destination);
  }
}
