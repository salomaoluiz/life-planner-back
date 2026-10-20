import { ConflictException, Inject, NotFoundException } from '@nestjs/common';

import { CreateTagInput, CreateTagSchema } from '@finance/application/dto/CreateTag';
import { ALL_SCOPES } from '@finance/application/dto/FinanceCommon';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TagEntity from '@finance/domain/entity/TagEntity';
import { IFinanceTagRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';

export const TAG_NAME_IN_USE = 'Tag name already in use';

export class CreateTagUseCase implements UseCaseWithParams<CreateTagInput, TagEntity> {
  constructor(
    @Inject('IFinanceTagRepository')
    private readonly tagRepository: IFinanceTagRepository,
  ) {}

  async execute(params: CreateTagInput): Promise<TagEntity> {
    const input = validate(CreateTagSchema, params);
    const isAll = input.owner === ALL_SCOPES;
    const target = isAll
      ? { owner: OwnerType.USER, ownerId: input.callerId as string }
      : { owner: input.owner as OwnerType, ownerId: input.ownerId as string };

    if (!hasOwnerAccess(input.accessibleOwners, target)) {
      throw new NotFoundException('Owner not found');
    }

    // An All tag (target = the creator's Personal scope) is never blocked by an archived family.
    ensureOwnerWritable(input.accessibleOwners, target);

    const scopes = isAll ? input.accessibleOwners : [target];
    const [conflict] = await this.tagRepository.findConflictingScopes({ name: input.name, scopes });

    if (conflict) {
      throw new ConflictException({ message: TAG_NAME_IN_USE, scope: conflict });
    }

    return this.tagRepository.createTag({
      allScopes: isAll || undefined,
      creatorId: target.ownerId,
      name: input.name,
      owner: target.owner,
      ownerId: target.ownerId,
      scopes: isAll ? scopes : undefined,
    });
  }
}
