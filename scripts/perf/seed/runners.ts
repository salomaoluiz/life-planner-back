import type { Runners, SeedContext } from '../seed';

import { seedFamilies } from './family';
import { seedFinance } from './finance';
import type { FinanceVolumes } from './finance-plan';
import { seedStock } from './stock';

export function createRunners(): Runners {
  return {
    family: async (ctx: SeedContext) => {
      const { familyIds } = await seedFamilies(ctx.client, ctx.cfg.family);

      return { counts: { families: familyIds.length }, familyIds };
    },
    finance: async (ctx: SeedContext) =>
      seedFinance(
        ctx.client,
        ctx.cfg.finance as unknown as FinanceVolumes,
        { familyIds: ctx.familyIds, userId: ctx.userId },
        ctx.today,
        ctx.rng,
      ),
    stock: async (ctx: SeedContext) => {
      await seedStock(
        ctx.client,
        ctx.cfg.stock,
        { familyIds: ctx.familyIds, personal: ctx.userId },
        ctx.today,
        ctx.rng,
      );

      return { counts: { stock: ctx.cfg.stock.items } };
    },
  };
}
