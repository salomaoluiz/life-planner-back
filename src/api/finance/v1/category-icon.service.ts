import { Injectable } from '@nestjs/common';

import { CategoryIconsApiOutput } from '@api/finance/v1/dto/category-icon.dto';
import { GetCategoryIconsUseCase } from '@finance/application/use-case/GetCategoryIconsUseCase';

@Injectable()
export class CategoryIconService {
  constructor(private readonly getCategoryIconsUseCase: GetCategoryIconsUseCase) {}

  async findAll(q: string | undefined, limit: number): Promise<CategoryIconsApiOutput> {
    const icons = await this.getCategoryIconsUseCase.execute({ limit, q });

    return {
      items: icons.map((icon) => ({
        common: icon.common,
        group: icon.group,
        labelEn: icon.labelEn,
        labelPt: icon.labelPt,
        name: icon.name,
      })),
    };
  }
}
