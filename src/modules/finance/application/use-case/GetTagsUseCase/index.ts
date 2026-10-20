import { Inject, NotFoundException } from '@nestjs/common';

import { GetTagsInput, GetTagsSchema } from '@finance/application/dto/GetTags';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import TagEntity from '@finance/domain/entity/TagEntity';
import { IFinanceTagRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// One owner: the suggestions order (usage desc, unused last, then name). Several owners: name, case-insensitive.
export class GetTagsUseCase implements UseCaseWithParams<GetTagsInput, TagEntity[]> {
  constructor(
    @Inject('IFinanceTagRepository')
    private readonly tagRepository: IFinanceTagRepository,
  ) {}

  async execute(params: GetTagsInput): Promise<TagEntity[]> {
    const input = validate(GetTagsSchema, params);

    if (
      input.ownerIds?.some(
        (ownerId) => !input.accessibleOwners.some((access) => access.ownerId === ownerId),
      )
    ) {
      throw new NotFoundException('Owner not found');
    }

    const owners = narrowOwners(input.accessibleOwners, input.ownerIds);

    if (owners.length === 0) {
      return [];
    }

    const tags = await this.tagRepository.findTags({ owners, q: input.q });

    return [...tags].sort(owners.length === 1 ? bySuggestion : byName);
  }
}

function byName(a: TagEntity, b: TagEntity): number {
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}
function bySuggestion(a: TagEntity, b: TagEntity): number {
  return b.usageCount - a.usageCount || byName(a, b);
}
