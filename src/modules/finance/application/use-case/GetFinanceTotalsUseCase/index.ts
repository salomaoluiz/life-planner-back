import { Inject } from '@nestjs/common';

import {
  GetFinanceTotalsInput,
  GetFinanceTotalsSchema,
  TotalsGroupBy,
} from '@finance/application/dto/GetFinanceTotals';
import {
  DashboardRow,
  GetDashboardRowsUseCase,
} from '@finance/application/use-case/GetDashboardRowsUseCase';
import CategoryEntity from '@finance/domain/entity/CategoryEntity';
import { narrowOwners } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus, TransactionType } from '@finance/domain/enum';
import { IFinanceCategoryRepository, IFinanceTagRepository } from '@finance/domain/repository';
import { Bucket, buildBuckets } from '@finance/domain/service/DashboardPeriod';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';

export interface Amounts {
  projected: number;
  realized: number;
}
export interface CategoryTotal extends Amounts {
  archived: boolean;
  categoryId: string;
  count: number;
  hasChildren: boolean;
  name: string;
  // The rows of the parent category itself (only with `parentId`).
  self: boolean;
}
export interface PeriodTotal {
  end: string;
  expense: Amounts;
  income: Amounts;
  start: string;
}
export interface TagTotal extends Amounts {
  count: number;
  name: string;
  tagId: string;
}
export type TotalsResult =
  | { bucket: 'MONTH' | 'WEEK'; groupBy: 'PERIOD'; items: PeriodTotal[] }
  | { groupBy: 'CATEGORY'; items: CategoryTotal[]; total: number }
  | {
      groupBy: 'TAG';
      items: TagTotal[];
      total: number;
      untagged: { count: number } & Amounts;
    };

const WEEKLY_COLUMNS_MAX_DAYS = 92;
const MS_PER_DAY = 86_400_000;

// Spec 046 §7 item 3: income and expenses grouped by period, category or tag. The sums come from the rows of
// `GetDashboardRowsUseCase`, which already holds the counting rules; here they are only grouped.
export class GetFinanceTotalsUseCase implements UseCaseWithParams<
  GetFinanceTotalsInput,
  TotalsResult
> {
  constructor(
    @Inject('IFinanceCategoryRepository')
    private readonly categoryRepository: IFinanceCategoryRepository,
    @Inject(GetDashboardRowsUseCase)
    private readonly getDashboardRowsUseCase: GetDashboardRowsUseCase,
    @Inject('IFinanceTagRepository')
    private readonly tagRepository: IFinanceTagRepository,
  ) {}

  private byPeriod(rows: DashboardRow[], common: { from: string; to: string }): TotalsResult {
    const days = Math.round((Date.parse(common.to) - Date.parse(common.from)) / MS_PER_DAY) + 1;
    const bucket = days <= WEEKLY_COLUMNS_MAX_DAYS ? 'WEEK' : 'MONTH';
    const items: PeriodTotal[] = buildBuckets(common.from, common.to, bucket).map(
      (range: Bucket) => ({
        ...range,
        expense: { projected: 0, realized: 0 },
        income: { projected: 0, realized: 0 },
      }),
    );

    for (const row of rows) {
      const item = items.find(
        (range) => row.bucketDate >= range.start && row.bucketDate <= range.end,
      );

      if (item) {
        add(row.type === TransactionType.INCOME ? item.income : item.expense, row);
      }
    }

    return { bucket, groupBy: 'PERIOD', items };
  }

  async execute(params: GetFinanceTotalsInput): Promise<TotalsResult> {
    const { groupBy, parentId, type, ...common } = validate(GetFinanceTotalsSchema, params);

    if (groupBy === TotalsGroupBy.PERIOD) {
      return this.byPeriod(
        await this.getDashboardRowsUseCase.execute({ ...common, byTag: false }),
        common,
      );
    }

    const owners = narrowOwners(common.accessibleOwners, common.ownerIds);

    if (groupBy === TotalsGroupBy.CATEGORY) {
      const [rows, categories] = await Promise.all([
        this.getDashboardRowsUseCase.execute({ ...common, byTag: false }),
        this.categoryRepository.findCategories({ owners: common.accessibleOwners }),
      ]);

      return byCategory(
        rows.filter((row) => row.type === type),
        categories,
        parentId,
      );
    }

    const [tagRows, plainRows, tags] = await Promise.all([
      this.getDashboardRowsUseCase.execute({ ...common, byTag: true }),
      this.getDashboardRowsUseCase.execute({ ...common, byTag: false }),
      this.tagRepository.findTags({ owners }),
    ]);

    return byTag(
      tagRows.filter((row) => row.type === type),
      plainRows.filter((row) => row.type === type),
      new Map(tags.map((tag) => [tag.id, tag.name])),
    );
  }
}

function add(target: Amounts, row: DashboardRow): void {
  if (row.projected) {
    target.projected += row.amount;
  } else {
    target.realized += row.amount;
  }
}
function byCategory(
  rows: DashboardRow[],
  categories: CategoryEntity[],
  parentId?: string,
): TotalsResult {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const hasChildren = new Set(categories.flatMap((category) => category.parentId ?? []));
  const groups = new Map<string, CategoryTotal>();

  for (const row of rows) {
    const key = groupKeyOf(row.categoryId, byId, parentId);

    if (key === undefined) {
      continue;
    }

    const category = byId.get(key.id);
    const group = groups.get(key.id + String(key.self)) ?? {
      archived: category?.status === AccountStatus.ARCHIVED,
      categoryId: key.id,
      count: 0,
      hasChildren: !key.self && hasChildren.has(key.id),
      name: category?.name ?? '',
      projected: 0,
      realized: 0,
      self: key.self,
    };

    add(group, row);
    group.count += row.count;
    groups.set(key.id + String(key.self), group);
  }

  const items = [...groups.values()].sort(
    (a, b) => b.realized + b.projected - (a.realized + a.projected),
  );

  return {
    groupBy: 'CATEGORY',
    items,
    total: items.reduce((sum, item) => sum + item.realized + item.projected, 0),
  };
}
function byTag(
  tagRows: DashboardRow[],
  plainRows: DashboardRow[],
  names: Map<string, string>,
): TotalsResult {
  const tags = new Map<string, TagTotal>();
  const untagged = { count: 0, projected: 0, realized: 0 };

  for (const row of tagRows) {
    if (row.tagId === null) {
      add(untagged, row);
      untagged.count += row.count;
      continue;
    }

    const tag = tags.get(row.tagId) ?? {
      count: 0,
      name: names.get(row.tagId) ?? '',
      projected: 0,
      realized: 0,
      tagId: row.tagId,
    };

    add(tag, row);
    tag.count += row.count;
    tags.set(row.tagId, tag);
  }

  return {
    groupBy: 'TAG',
    items: [...tags.values()]
      .filter((tag) => tag.realized + tag.projected > 0)
      .sort((a, b) => b.realized + b.projected - (a.realized + a.projected)),
    // Counted once: a row with several tags repeats in `tagRows`, never in `plainRows`.
    total: plainRows.reduce((sum, row) => sum + row.amount, 0),
    untagged,
  };
}

// The root (or, with `parentId`, the direct child of that parent) a category belongs to.
function groupKeyOf(
  categoryId: string,
  byId: Map<string, CategoryEntity>,
  parentId?: string,
): { id: string; self: boolean } | undefined {
  if (parentId !== undefined && categoryId === parentId) {
    return { id: parentId, self: true };
  }

  let current = categoryId;
  const seen = new Set<string>();

  while (!seen.has(current)) {
    seen.add(current);

    const parent = byId.get(current)?.parentId;

    if (parentId === undefined ? parent === undefined : parent === parentId) {
      return { id: current, self: false };
    }
    if (parent === undefined) {
      return undefined;
    }

    current = parent;
  }

  return undefined;
}
