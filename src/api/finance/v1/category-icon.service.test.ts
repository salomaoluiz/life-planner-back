import { Test } from '@nestjs/testing';

import { CategoryIconService } from '@api/finance/v1/category-icon.service';
import { GetCategoryIconsUseCase } from '@finance/application/use-case/GetCategoryIconsUseCase';

const icon = {
  common: true,
  group: 'OTHER',
  labelEn: 'Folder',
  labelPt: 'Pasta',
  name: 'folder',
  sort: 1,
};
const useCaseMock = { execute: jest.fn().mockResolvedValue([icon]) };

it('SHOULD return items WITHOUT the internal sort', async () => {
  const module = await Test.createTestingModule({
    providers: [CategoryIconService, { provide: GetCategoryIconsUseCase, useValue: useCaseMock }],
  }).compile();

  const result = await module.get(CategoryIconService).findAll('pasta', 20);

  expect(useCaseMock.execute).toHaveBeenCalledWith({ limit: 20, q: 'pasta' });
  expect(result).toEqual({
    items: [{ common: true, group: 'OTHER', labelEn: 'Folder', labelPt: 'Pasta', name: 'folder' }],
  });
});
