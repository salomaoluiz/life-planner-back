import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { EnvService } from '@shared/infra/env/env.service';

export interface IOpenFoodFacts {
  // The product, `null` when the code is not in Open Food Facts, `undefined` on timeout or error (never throws).
  getProduct(code: string): Promise<null | OpenFoodFactsProduct | undefined>;
}
export interface OpenFoodFactsProduct {
  brands?: string;
  categories?: string[];
  name?: string;
  quantity?: string;
}

export const OPEN_FOOD_FACTS_CACHE_SIZE = 5000;
export const OPEN_FOOD_FACTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  product: null | OpenFoodFactsProduct;
}
interface ProductResponse {
  product?: {
    brands?: unknown;
    categories_tags?: unknown;
    product_name?: unknown;
    quantity?: unknown;
  };
  status?: number;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

// Spec 121 FR 13 and section 11: Open Food Facts API v2, read only, with a descriptive generic User-Agent.
// Public data, so answers are shared between users and cached for 24 h (errors are never cached).
@Injectable()
export class OpenFoodFacts implements IOpenFoodFacts {
  // Insertion order = recency order (a hit re-inserts), so the first key is the least recently used.
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly env: EnvService) {}

  async getProduct(code: string): Promise<null | OpenFoodFactsProduct | undefined> {
    const cached = this.cache.get(code);

    if (cached && cached.expiresAt > Date.now()) {
      this.cache.delete(code);
      this.cache.set(code, cached);

      return cached.product;
    }

    try {
      const response = await axios.get<ProductResponse>(
        `${this.env.openFoodFactsUrl.replace(/\/+$/, '')}/api/v2/product/${encodeURIComponent(code)}.json`,
        {
          headers: { 'User-Agent': this.env.openFoodFactsUserAgent },
          params: { fields: 'product_name,brands,quantity,categories_tags' },
          timeout: this.env.openFoodFactsTimeoutMs,
          validateStatus: (status) => status === 200 || status === 404,
        },
      );
      const raw =
        response.status === 200 && response.data?.status !== 0 ? response.data?.product : undefined;
      const name = text(raw?.product_name);
      const product: null | OpenFoodFactsProduct = name
        ? {
            brands: text(raw?.brands),
            categories: Array.isArray(raw?.categories_tags)
              ? raw.categories_tags.filter((tag): tag is string => typeof tag === 'string')
              : undefined,
            name,
            quantity: text(raw?.quantity),
          }
        : null;

      this.remember(code, product);

      return product;
    } catch {
      return undefined;
    }
  }

  private remember(code: string, product: null | OpenFoodFactsProduct) {
    this.cache.delete(code);
    this.cache.set(code, { expiresAt: Date.now() + OPEN_FOOD_FACTS_CACHE_TTL_MS, product });

    if (this.cache.size > OPEN_FOOD_FACTS_CACHE_SIZE) {
      const [oldest] = this.cache.keys();

      this.cache.delete(oldest);
    }
  }
}
