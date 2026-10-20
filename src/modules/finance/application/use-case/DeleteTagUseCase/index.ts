import { Inject, NotFoundException } from '@nestjs/common';

import { DeleteTagInput, DeleteTagSchema } from '@finance/application/dto/DeleteTag';
import { ensureOwnerWritable } from '@finance/application/service/OwnerWritable';
import { isVisibleTo } from '@finance/domain/entity/TagScope';
import { IFinanceTagRepository } from '@finance/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

// A tag is never refused for being in use: its links go with it (spec 043 FR 7).
export class DeleteTagUseCase implements UseCaseWithParams<DeleteTagInput, void> {
  constructor(
    @Inject('IFinanceTagRepository')
    private readonly tagRepository: IFinanceTagRepository,
  ) {}

  async execute(params: DeleteTagInput): Promise<void> {
    const input = validate(DeleteTagSchema, params);
    const tag = await this.tagRepository.findTagById(input.id);

    if (!tag || !isVisibleTo(tag, input.accessibleOwners)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, tag);

    await this.tagRepository.deleteTag(input.id);
  }
}
