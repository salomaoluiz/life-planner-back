import { Injectable } from '@nestjs/common';

import { Prisma } from '@db/client';
import { Database } from '@shared/infra/db/Database';
import {
  IStockSuggestionDatasource,
  StockSuggestionDatasourceRow,
} from '@stock/data/repository/datasource/IStockSuggestionDatasource';

// The name text every signal is computed on: accent-insensitive, lowercase, name + brand (spec 116 FR 29).
const NAME_TEXT = Prisma.sql`immutable_unaccent(lower("description" || ' ' || coalesce("brand", '')))`;

function toVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

// `name_embedding` is a pgvector column Prisma cannot model: it is only touched here, with raw SQL.
@Injectable()
export class StockSuggestionDatasource implements IStockSuggestionDatasource {
  constructor(private readonly db: Database) {}

  async findEmbeddingText(id: string): Promise<null | string> {
    const rows = await this.db.client.$queryRaw<{ text: string }[]>(
      Prisma.sql`SELECT "description" || ' ' || coalesce("brand", '') AS "text" FROM "stock_items" WHERE "id" = ${id}`,
    );

    return rows[0]?.text.trim() ?? null;
  }

  // One statement: trigram (word_similarity, GIN index through `<%`) and cosine distance (HNSW) over the owner's
  // items only. The threshold is set per transaction because `<%` reads the session setting.
  async findSuggestions(params: {
    embedding?: number[];
    limit: number;
    max_distance: number;
    min_trigram: number;
    owner: 'FAMILY' | 'USER';
    owner_id: string;
    query: string;
  }): Promise<StockSuggestionDatasourceRow[]> {
    const query = Prisma.sql`immutable_unaccent(lower(${params.query}))`;
    const vector = params.embedding ? Prisma.sql`${toVector(params.embedding)}::vector` : undefined;
    const distance = vector
      ? Prisma.sql`CASE WHEN "name_embedding" IS NULL THEN NULL ELSE "name_embedding" <=> ${vector} END`
      : Prisma.sql`NULL::double precision`;
    const nearby = vector
      ? Prisma.sql`OR ("name_embedding" IS NOT NULL AND "name_embedding" <=> ${vector} <= ${params.max_distance})`
      : Prisma.empty;

    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(params.min_trigram)}, true)`,
      );

      return tx.$queryRaw<StockSuggestionDatasourceRow[]>(Prisma.sql`
        SELECT "id", "description", "brand", "unit"::text AS "unit",
               (SELECT coalesce(sum(lot."quantity"), 0) FROM "stock_lots" lot WHERE lot."item_id" = "stock_items"."id")::float8 AS "quantity",
               word_similarity(${query}, ${NAME_TEXT})::float8 AS "trigram",
               ${distance}::float8 AS "distance"
        FROM "stock_items"
        WHERE "owner" = ${params.owner}::"OwnerType" AND "owner_id" = ${params.owner_id}
          AND (${query} <% ${NAME_TEXT} ${nearby})
        ORDER BY GREATEST(word_similarity(${query}, ${NAME_TEXT}), 1 - coalesce(${distance}, 2)) DESC, "id"
        LIMIT ${params.limit}
      `);
    });
  }

  async findWithoutEmbedding(limit: number): Promise<{ id: string; text: string }[]> {
    return this.db.client.$queryRaw<{ id: string; text: string }[]>(Prisma.sql`
      SELECT "id", trim("description" || ' ' || coalesce("brand", '')) AS "text"
      FROM "stock_items" WHERE "name_embedding" IS NULL ORDER BY "created_at", "id" LIMIT ${limit}
    `);
  }

  async setEmbedding(id: string, embedding: number[]): Promise<void> {
    await this.db.client.$executeRaw(
      Prisma.sql`UPDATE "stock_items" SET "name_embedding" = ${toVector(embedding)}::vector WHERE "id" = ${id}`,
    );
  }
}
