import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  GetOwnerChangePreviewInput,
  GetOwnerChangePreviewSchema,
} from '@stock/application/dto/GetOwnerChangePreview';
import { OwnerChangePlan, planOwnerChange } from '@stock/application/service/OwnerChange';
import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { loadCatalogLookup } from '@stock/application/service/StockView';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { IStockCatalogRepository, IStockRepository } from '@stock/domain/repository';

// Spec 116 FR 27: what the owner change would do to the category and the location, before saving.
export class GetOwnerChangePreviewUseCase implements UseCaseWithParams<
  GetOwnerChangePreviewInput,
  OwnerChangePlan['preview']
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: GetOwnerChangePreviewInput): Promise<OwnerChangePlan['preview']> {
    const input = validate(GetOwnerChangePreviewSchema, params);
    const item = await this.stockRepository.findById(input.id);

    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    const target = { owner: input.owner, ownerId: input.ownerId };

    if (!hasOwnerAccess(input.accessibleOwners, target)) {
      throw new ForbiddenException('Owner not accessible');
    }

    ensureOwnerWritable(input.accessibleOwners, item);
    ensureOwnerWritable(input.accessibleOwners, target);

    const [source, destination] = await Promise.all([
      loadCatalogLookup(this.catalogRepository, [item]),
      loadCatalogLookup(this.catalogRepository, [target]),
    ]);

    return planOwnerChange(item, source, destination).preview;
  }
}
