import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { EnvService } from '@shared/infra/env/env.service';

export interface IEmbeddings {
  // The vector of `text`, or `null` without a key, on timeout or on any provider error (never throws).
  embed(text: string, options?: { timeoutMs?: number }): Promise<null | number[]>;
}

export const EMBEDDINGS_QUERY_TIMEOUT_MS = 800;
export const EMBEDDINGS_CACHE_SIZE = 1000;
export const EMBEDDINGS_CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  vector: number[];
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

// Spec 116 FR 30-33: OpenAI-compatible `POST {url}/embeddings`. Only the text it is given leaves the process.
@Injectable()
export class Embeddings implements IEmbeddings {
  // Insertion order = recency order (a hit re-inserts), so the first key is the least recently used.
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly env: EnvService) {}

  async embed(text: string, options?: { timeoutMs?: number }): Promise<null | number[]> {
    const url = this.env.embeddingsApiUrl;
    const key = this.env.embeddingsApiKey;
    const model = this.env.embeddingsModel;
    const input = normalize(text);

    if (!url || !key || !model || input === '') {
      return null;
    }

    const cached = this.fromCache(input);

    if (cached) {
      return cached;
    }

    try {
      const dimensions = this.env.embeddingsDimensions;
      const response = await axios.post<{ data?: { embedding?: number[] }[] }>(
        `${url.replace(/\/$/, '')}/embeddings`,
        { dimensions, input, model },
        {
          headers: { Authorization: `Bearer ${key}` },
          timeout: options?.timeoutMs ?? EMBEDDINGS_QUERY_TIMEOUT_MS,
        },
      );
      const vector = response.data.data?.[0]?.embedding;

      if (!vector || vector.length !== dimensions) {
        return null;
      }

      this.toCache(input, vector);

      return vector;
    } catch {
      // Never log the error: it can carry the request headers.
      return null;
    }
  }

  private fromCache(input: string): null | number[] {
    const entry = this.cache.get(input);

    if (!entry) {
      return null;
    }

    this.cache.delete(input);

    if (entry.expiresAt < Date.now()) {
      return null;
    }

    this.cache.set(input, entry);

    return entry.vector;
  }

  private toCache(input: string, vector: number[]): void {
    this.cache.delete(input);
    this.cache.set(input, { expiresAt: Date.now() + EMBEDDINGS_CACHE_TTL_MS, vector });

    if (this.cache.size > EMBEDDINGS_CACHE_SIZE) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
  }
}
