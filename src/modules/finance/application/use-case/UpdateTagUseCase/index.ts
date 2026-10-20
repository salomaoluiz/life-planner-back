import { ConflictException, ForbiddenException, Inject, NotFoundException } from '@nestjs/common';

import { ALL_SCOPES } from '@finance/application/dto/FinanceCommon';
import { UpdateTagInput, UpdateTagSchema } from '@finance/application/dto/UpdateTag';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { TAG_NAME_IN_USE } from '@finance/application/use-case/CreateTagUseCase';
import { hasOwnerAccess } from '@finance/domain/entity/OwnerAccess';
import TagEntity from '@finance/domain/entity/TagEntity';
import { isVisibleTo } from '@finance/domain/entity/TagScope';
import { IFinanceTagRepository, UpdateTagRepositoryParams } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { validate } from '@shared/infra/validation';

export class UpdateTagUseCase implements UseCaseWithParams<UpdateTagInput, TagEntity> {
  constructor(
    @Inject('IFinanceTagRepository')
    private readonly tagRepository: IFinanceTagRepository,
  ) {}

  async execute(params: UpdateTagInput): Promise<TagEntity> {
    const input = validate(UpdateTagSchema, params);
    const tag = await this.tagRepository.findTagById(input.id);

    if (!tag || !isVisibleTo(tag, input.accessibleOwners)) {
      throw new NotFoundException();
    }

    // An All tag's owner is its creator's Personal scope, so only single-family tags are blocked.
    ensureOwnerWritable(input.accessibleOwners, tag);

    const switchesToAll = input.scope === ALL_SCOPES && !tag.allScopes;
    let scope: UpdateTagRepositoryParams['scope'];

    if (switchesToAll) {
      const caller = { owner: OwnerType.USER, ownerId: input.callerId as string };

      if (!input.callerId || !hasOwnerAccess(input.accessibleOwners, caller)) {
        throw new ForbiddenException('Owner not accessible');
      }

      scope = { creatorId: input.callerId, scopes: input.accessibleOwners };
    }

    const name = input.name !== undefined && input.name !== tag.name ? input.name : undefined;

    if (name !== undefined || scope !== undefined) {
      const [conflict] = await this.tagRepository.findConflictingScopes({
        excludeId: tag.id,
        name: name ?? tag.name,
        scopes: scope ? scope.scopes : tag.scopes,
      });

      if (conflict) {
        throw new ConflictException({ message: TAG_NAME_IN_USE, scope: conflict });
      }
    }

    if (name === undefined && scope === undefined) {
      return tag;
    }

    return this.tagRepository.updateTag({ id: tag.id, name, scope });
  }
}
