import { Inject } from '@nestjs/common';

import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityEntityType } from '@activity/domain/enum';
import { IActivitySnapshotRepository } from '@activity/domain/repository/IActivitySnapshotRepository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface ReadActivitySnapshotInput {
  entityType: ActivityEntityType;
  id: string;
}

// Spec 127 FR 6, 7: the "before" and "after" of the item a write route touched.
export class ReadActivitySnapshotUseCase implements UseCaseWithParams<
  ReadActivitySnapshotInput,
  ActivitySnapshot | null
> {
  constructor(
    @Inject('IActivitySnapshotRepository')
    private readonly repository: IActivitySnapshotRepository,
  ) {}

  async execute(input: ReadActivitySnapshotInput): Promise<ActivitySnapshot | null> {
    return this.repository.read(input.entityType, input.id);
  }
}
