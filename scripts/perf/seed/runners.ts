import type { Runners, SeedContext } from '../seed';

import { seedFamilies } from './family';
import { seedStock } from './stock';

export function createRunners(): Runners {
  return {
    family: async (ctx: SeedContext) => {
      const { created, familyIds } = await seedFamilies(ctx.client, ctx.cfg.family);

      return { counts: { families: familyIds.length, familyRecordsCreated: created }, familyIds };
    },
    finance: async () => {
      throw new Error('finance seed is not implemented yet');
    },
    stock: async (ctx: SeedContext) => {
      const created = await seedStock(
        ctx.client,
        ctx.cfg.stock,
        { familyIds: ctx.familyIds, personal: ctx.userId },
        ctx.today,
        ctx.rng,
      );

      return { counts: { stockCreated: created } };
    },
  };
}
