import { faker, Faker } from '@faker-js/faker';

export interface Rng {
  faker: Faker;
}

// Reseeds the shared faker, so every run (and every builder given a fresh rng) yields the same data.
export function createRng(seed: number): Rng {
  faker.seed(seed);

  return { faker };
}
