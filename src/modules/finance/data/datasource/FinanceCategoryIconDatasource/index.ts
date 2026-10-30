import { Injectable } from '@nestjs/common';

import { Prisma } from '@db/client';
import {
  CategoryIconRow,
  IFinanceCategoryIconDatasource,
} from '@finance/data/repository/datasource/IFinanceCategoryIconDatasource';
import { buildPrefixQuery } from '@finance/domain/service/IconSearchQuery';
import { Database } from '@shared/infra/db/Database';

const COLUMNS = Prisma.sql`"name", "label_pt", "label_en", "group_key", "common", "sort"`;

@Injectable()
export class FinanceCategoryIconDatasource implements IFinanceCategoryIconDatasource {
  constructor(private readonly db: Database) {}

  async listAll(): Promise<CategoryIconRow[]> {
    return this.db.client.categoryIcon.findMany({
      orderBy: { sort: 'asc' },
      select: {
        common: true,
        group_key: true,
        label_en: true,
        label_pt: true,
        name: true,
        sort: true,
      },
    });
  }

  // GIN index on `search`; an exact name / label match first, then relevance, then the curated order.
  async search(params: { limit: number; terms: string[] }): Promise<CategoryIconRow[]> {
    const query = buildPrefixQuery(params.terms);
    const phrase = params.terms.join(' ');

    return this.db.client.$queryRaw<CategoryIconRow[]>(
      Prisma.sql`
        SELECT ${COLUMNS}
        FROM "category_icons"
        WHERE "search" @@ to_tsquery('simple', ${query})
        ORDER BY (
            "name" = ${phrase}
            OR lower(immutable_unaccent("label_pt")) = ${phrase}
            OR lower(immutable_unaccent("label_en")) = ${phrase}
          ) DESC,
          ts_rank("search", to_tsquery('simple', ${query})) DESC,
          "sort" ASC
        LIMIT ${params.limit}`,
    );
  }

  // Spec 058 FR 12 says 0.3, but a transposition like `psata` → `pasta` scores 0.2 on trigrams (checked against the
  // seeded catalog), so the threshold is 0.2 with `strict_word_similarity`, which keeps nonsense (`zzzqq`) empty.
  async searchSimilar(params: { limit: number; text: string }): Promise<CategoryIconRow[]> {
    return this.db.client.$queryRaw<CategoryIconRow[]>(
      Prisma.sql`
        SELECT ${COLUMNS}
        FROM "category_icons"
        WHERE strict_word_similarity(${params.text}, "search_text") >= 0.2
        ORDER BY strict_word_similarity(${params.text}, "search_text") DESC, "sort" ASC
        LIMIT ${params.limit}`,
    );
  }
}
