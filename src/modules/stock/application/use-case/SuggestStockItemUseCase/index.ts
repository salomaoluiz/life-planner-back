import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ILlm } from '@shared/infra/llm';
import { IOpenFoodFacts } from '@shared/infra/open-food-facts';
import { validate } from '@shared/infra/validation';
import {
  SuggestStockItemInput,
  SuggestStockItemSchema,
} from '@stock/application/dto/SuggestStockItem';
import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { loadCatalogLookup } from '@stock/application/service/StockView';
import {
  LightAnswerSchema,
  lightPrompt,
  SearchAnswerSchema,
  searchPrompt,
} from '@stock/application/service/SuggestionPrompts';
import { ConsumeAiUsageUseCase } from '@stock/application/use-case/ConsumeAiUsageUseCase';
import { AiUsage, GetAiUsageUseCase } from '@stock/application/use-case/GetAiUsageUseCase';
import {
  ItemSuggestion,
  SuggestionFields,
  SuggestionSource,
} from '@stock/domain/entity/ItemSuggestion';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { IStockCatalogRepository } from '@stock/domain/repository';
import { AiFields, filterAiFields } from '@stock/domain/service/AiSuggestionRules';
import { normalizeBarcode } from '@stock/domain/service/Barcode';
import { pathOf } from '@stock/domain/service/CategoryTree';
import { mapOpenFoodFacts } from '@stock/domain/service/OpenFoodFactsMapping';

export const SUGGESTION_CACHE_SIZE = 1000;
export const SUGGESTION_CACHE_TTL_MS = 10 * 60 * 1000;

export type ItemSuggestionResult = { usage: AiUsage } & ItemSuggestion;

interface CacheEntry {
  expiresAt: number;
  suggestion: ItemSuggestion;
}

// Spec 121 FR 12-24: Open Food Facts, then a light AI call (product known) or a full AI call (product unknown),
// each counted BEFORE it is made. Never throws because of the providers: it answers with what it has.
export class SuggestStockItemUseCase implements UseCaseWithParams<
  SuggestStockItemInput,
  ItemSuggestionResult
> {
  // Insertion order = recency order (a hit re-inserts), so the first key is the least recently used.
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
    @Inject('IOpenFoodFacts') private readonly openFoodFacts: IOpenFoodFacts,
    @Inject('ILlm') private readonly llm: ILlm,
    private readonly consumeUsage: ConsumeAiUsageUseCase,
    private readonly getUsage: GetAiUsageUseCase,
  ) {}

  private async build(
    userId: string,
    target: { owner: OwnerType; ownerId: string },
    subject: { barcode: string } | { name: string },
    now: Date,
    key: string,
  ): Promise<ItemSuggestion> {
    const catalog = await loadCatalogLookup(this.catalogRepository, [target]);
    const categories = catalog.categories
      .filter((category) => category.status === StockCatalogStatus.ACTIVE)
      .map((category) => ({ id: category.id, path: pathOf(catalog.categories, category.id) }));
    const locations = catalog.locations
      .filter((location) => location.status === StockCatalogStatus.ACTIVE)
      .map((location) => ({ id: location.id, name: location.name }));
    const choices = { categories, locations };
    const names = {
      categories: categories.map(({ path }) => path),
      locations: locations.map(({ name }) => name),
    };

    const fields: SuggestionFields = {};
    const sources: ItemSuggestion['sources'] = {};
    const { consumeUsage, llm } = this;
    const state: { notice: ItemSuggestion['notice'] } = { notice: null };
    function add(values: AiFields, source: SuggestionSource) {
      for (const [field, value] of Object.entries(values)) {
        if (value !== undefined && fields[field as keyof SuggestionFields] === undefined) {
          (fields as Record<string, unknown>)[field] = value;
          sources[field as keyof SuggestionFields] = source;
        }
      }
    }
    // `false` = nothing to ask (no provider); `true` = counted. A refused count sets the notice.
    async function reserve(kind: 'LIGHT' | 'SEARCH') {
      if (!llm.isEnabled(kind)) {
        return false;
      }

      if (await consumeUsage.execute({ kind, now, userId })) {
        return true;
      }

      state.notice = 'LIMIT_REACHED';

      return false;
    }

    const product =
      'barcode' in subject ? await this.openFoodFacts.getProduct(subject.barcode) : null;

    if (product) {
      add(mapOpenFoodFacts(product), 'OPEN_FOOD_FACTS');

      if (await reserve('LIGHT')) {
        const answer = await this.llm.complete({
          kind: 'LIGHT',
          schema: LightAnswerSchema,
          ...lightPrompt(product, names),
        });

        if (answer) {
          add(filterAiFields(answer, choices), 'AI');
        } else {
          state.notice = 'AI_UNAVAILABLE';
        }
      }
    } else if (await reserve('SEARCH')) {
      const answer = await this.llm.complete({
        kind: 'SEARCH',
        schema: SearchAnswerSchema,
        ...searchPrompt(subject, names),
      });

      if (!answer) {
        state.notice = 'AI_UNAVAILABLE';
      } else {
        const valid = filterAiFields(answer, choices);

        if (answer.confidence === 'LOW' || !valid.description) {
          // Not sure: keep only what is checkable against the owner's own lists.
          add(
            {
              categoryId: valid.categoryId,
              locationId: valid.locationId,
              openedShelfLifeDays: valid.openedShelfLifeDays,
            },
            'AI',
          );
          state.notice = 'AI_NOT_SURE';
        } else {
          add(valid, 'AI');
        }
      }
    }

    if (state.notice === null && Object.keys(fields).length === 0) {
      state.notice = 'NOT_FOUND';
    }

    const { notice } = state;
    const suggestion: ItemSuggestion = { fields, notice, sources };

    // A limit or a provider failure is not worth remembering: the next try may work.
    if (notice !== 'AI_UNAVAILABLE' && notice !== 'LIMIT_REACHED') {
      this.remember(key, suggestion);
    }

    return suggestion;
  }

  async execute(params: SuggestStockItemInput): Promise<ItemSuggestionResult> {
    const input = validate(SuggestStockItemSchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    if (!hasOwnerAccess(input.accessibleOwners, target)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, target);

    const barcode = input.barcode === undefined ? undefined : normalizeBarcode(input.barcode);

    if (input.barcode !== undefined && barcode === undefined) {
      throw new BadRequestException('Invalid barcode');
    }

    const subject = barcode === undefined ? { name: input.name ?? '' } : { barcode };
    const key = [
      input.userId,
      input.owner,
      input.ownerId,
      'barcode' in subject ? subject.barcode : subject.name.toLowerCase(),
    ].join('|');
    const now = input.now ?? new Date();
    const cached = this.fromCache(key);
    const suggestion = cached ?? (await this.build(input.userId, target, subject, now, key));

    return { ...suggestion, usage: await this.getUsage.execute({ now, userId: input.userId }) };
  }

  private fromCache(key: string): ItemSuggestion | undefined {
    const entry = this.cache.get(key);

    if (!entry || entry.expiresAt <= Date.now()) {
      return undefined;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.suggestion;
  }

  private remember(key: string, suggestion: ItemSuggestion) {
    this.cache.delete(key);
    this.cache.set(key, { expiresAt: Date.now() + SUGGESTION_CACHE_TTL_MS, suggestion });

    if (this.cache.size > SUGGESTION_CACHE_SIZE) {
      const [oldest] = this.cache.keys();

      this.cache.delete(oldest);
    }
  }
}
