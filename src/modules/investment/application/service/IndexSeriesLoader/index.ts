import { Inject, Injectable } from '@nestjs/common';

import { IMarketIndexRepository } from '@investment/domain/repository';
import { IndexSeriesData } from '@investment/domain/service/IndexSeries';

// Spec 113 FR 13: the stored index series a calculated title follows, read from the earliest date it needs.
@Injectable()
export class IndexSeriesLoader {
  constructor(
    @Inject('IMarketIndexRepository')
    private readonly indexes: IMarketIndexRepository,
  ) {}

  async load(from: string): Promise<IndexSeriesData> {
    return this.indexes.findSeriesData(from);
  }
}
