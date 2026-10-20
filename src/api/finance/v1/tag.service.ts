import { Injectable } from '@nestjs/common';

import { CreateTagApiInput, TagOutput, UpdateTagApiInput } from '@api/finance/v1/dto/tag.dto';
import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { CreateTagUseCase } from '@finance/application/use-case/CreateTagUseCase';
import { DeleteTagUseCase } from '@finance/application/use-case/DeleteTagUseCase';
import { GetTagsUseCase } from '@finance/application/use-case/GetTagsUseCase';
import { UpdateTagUseCase } from '@finance/application/use-case/UpdateTagUseCase';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TagEntity from '@finance/domain/entity/TagEntity';
import { tagScopeKind, visibleScopes } from '@finance/domain/entity/TagScope';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// Personal first, so the owner of an ALL tag reads as the caller's own scope when they have it.
function toTagOutput(tag: TagEntity, accessibleOwners: OwnerAccess[]): TagOutput {
  const scopes = [...visibleScopes(tag, accessibleOwners)].sort(
    (a, b) => Number(b.owner === OwnerType.USER) - Number(a.owner === OwnerType.USER),
  );
  const [firstScope] = scopes;
  // An ALL tag never exposes a creator's Personal scope the caller cannot reach.
  const owner = tag.allScopes && firstScope ? firstScope : tag;

  return {
    createdAt: tag.createdAt.toISOString(),
    id: tag.id,
    name: tag.name,
    owner: owner.owner,
    ownerId: owner.ownerId,
    scope: tagScopeKind(tag),
    scopes,
    updatedAt: tag.updatedAt.toISOString(),
    usageCount: tag.usageCount,
  };
}

@Injectable()
export class TagService {
  constructor(
    private readonly createTagUseCase: CreateTagUseCase,
    private readonly deleteTagUseCase: DeleteTagUseCase,
    private readonly financeAccessService: FinanceAccessService,
    private readonly getTagsUseCase: GetTagsUseCase,
    private readonly updateTagUseCase: UpdateTagUseCase,
  ) {}

  async create(userId: string, input: CreateTagApiInput): Promise<TagOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const tag = await this.createTagUseCase.execute({
      ...input,
      accessibleOwners,
      callerId: userId,
    });

    return toTagOutput(tag, accessibleOwners);
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);

    await this.deleteTagUseCase.execute({ accessibleOwners, id });
  }

  async findAll(userId: string, ownerIds?: string[], q?: string): Promise<TagOutput[]> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const tags = await this.getTagsUseCase.execute({ accessibleOwners, ownerIds, q });

    return tags.map((tag) => toTagOutput(tag, accessibleOwners));
  }

  async update(userId: string, id: string, input: UpdateTagApiInput): Promise<TagOutput> {
    const accessibleOwners = await this.financeAccessService.resolve(userId);
    const tag = await this.updateTagUseCase.execute({
      ...input,
      accessibleOwners,
      callerId: userId,
      id,
    });

    return toTagOutput(tag, accessibleOwners);
  }
}
