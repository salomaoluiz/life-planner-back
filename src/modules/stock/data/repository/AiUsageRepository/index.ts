import { Inject, Injectable } from '@nestjs/common';

import { IAiUsageDatasource } from '@stock/data/repository/datasource/IAiUsageDatasource';
import { AiUsageKind, IAiUsageRepository } from '@stock/domain/repository';

@Injectable()
export class AiUsageRepository implements IAiUsageRepository {
  constructor(@Inject('IAiUsageDatasource') private readonly datasource: IAiUsageDatasource) {}

  async consume(
    userId: string,
    kind: AiUsageKind,
    day: string,
    limit: number,
  ): Promise<number | undefined> {
    return (await this.datasource.consume(userId, kind, day, limit)) ?? undefined;
  }

  async findDay(userId: string, day: string): Promise<Record<AiUsageKind, number>> {
    const rows = await this.datasource.findDay(userId, day);
    function count(kind: AiUsageKind) {
      return rows.find((row) => row.kind === kind)?.count ?? 0;
    }

    return { LIGHT: count('LIGHT'), SEARCH: count('SEARCH') };
  }
}
