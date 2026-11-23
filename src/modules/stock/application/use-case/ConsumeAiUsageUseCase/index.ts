import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { EnvService } from '@shared/infra/env/env.service';
import { AiUsageKind, IAiUsageRepository } from '@stock/domain/repository';
import { usageDay } from '@stock/domain/service/UsageDay';

export interface ConsumeAiUsageInput {
  kind: AiUsageKind;
  now?: Date;
  userId: string;
}

// Spec 121 FR 21: counts a provider call BEFORE it is made. `false` = the daily limit was reached.
export class ConsumeAiUsageUseCase implements UseCaseWithParams<ConsumeAiUsageInput, boolean> {
  constructor(
    @Inject('IAiUsageRepository') private readonly repository: IAiUsageRepository,
    private readonly env: EnvService,
  ) {}

  async execute(input: ConsumeAiUsageInput): Promise<boolean> {
    const limit =
      input.kind === 'LIGHT' ? this.env.llmDailyLightLimit : this.env.llmDailySearchLimit;
    const day = usageDay(input.now ?? new Date(), this.env.llmUsageTimezone);

    return (await this.repository.consume(input.userId, input.kind, day, limit)) !== undefined;
  }
}
