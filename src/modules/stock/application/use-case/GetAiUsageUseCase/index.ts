import { Inject } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { EnvService } from '@shared/infra/env/env.service';
import { IAiUsageRepository } from '@stock/domain/repository';
import { usageDay } from '@stock/domain/service/UsageDay';

export interface AiUsage {
  light: { limit: number; used: number };
  search: { limit: number; used: number };
}

// Spec 121 FR 23: today's counters of the user next to their limits.
export class GetAiUsageUseCase implements UseCaseWithParams<
  { now?: Date; userId: string },
  AiUsage
> {
  constructor(
    @Inject('IAiUsageRepository') private readonly repository: IAiUsageRepository,
    private readonly env: EnvService,
  ) {}

  async execute(input: { now?: Date; userId: string }): Promise<AiUsage> {
    const day = usageDay(input.now ?? new Date(), this.env.llmUsageTimezone);
    const counts = await this.repository.findDay(input.userId, day);

    return {
      light: { limit: this.env.llmDailyLightLimit, used: counts.LIGHT },
      search: { limit: this.env.llmDailySearchLimit, used: counts.SEARCH },
    };
  }
}
