import 'dotenv/config';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { SharedModule } from '@shared/shared.module';
import { BackfillStockEmbeddingsUseCase } from '@stock/application/use-case/BackfillStockEmbeddingsUseCase';
import { StockModule } from '@stock/stock.module';

// Spec 116 FR 31: `yarn stock:embeddings:backfill` fills the name embeddings the migration left null. It needs the
// EMBEDDINGS_* variables; without them nothing is written. Exit 0 = every item has a vector, 1 = some failed.
@Module({ imports: [SharedModule, StockModule] })
class BackfillModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(BackfillModule, { logger: ['error'] });

  try {
    const { failed, processed } = await app.get(BackfillStockEmbeddingsUseCase).execute();

    console.log(`stock embeddings: ${processed} filled, ${failed} failed`);
    process.exitCode = failed > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
}

void main();
