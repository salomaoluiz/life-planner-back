import { Inject } from '@nestjs/common';

import { ActivityItemInput } from '@activity/domain/entity/ActivityEntry';
import { ActivityGroupKind } from '@activity/domain/enum';
import { IActivitySnapshotRepository } from '@activity/domain/repository/IActivitySnapshotRepository';
import { UseCaseWithParams } from '@shared/application/use-case/types';

export interface ReadActivityGroupInput {
  // Ids for `TRANSACTION_IDS`; the id of the series, plan, split, category or conversion otherwise.
  id: string;
  kind: ActivityGroupKind;
}

// Spec 127 FR 3, 8: the rows of a batch as they are now.
export class ReadActivityGroupUseCase implements UseCaseWithParams<
  ReadActivityGroupInput,
  ActivityItemInput[]
> {
  constructor(
    @Inject('IActivitySnapshotRepository')
    private readonly repository: IActivitySnapshotRepository,
  ) {}

  async execute(input: ReadActivityGroupInput): Promise<ActivityItemInput[]> {
    return this.repository.readGroup(input.kind, input.id);
  }
}
