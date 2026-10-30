import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { CategoryIconController } from '@api/finance/v1/category-icon.controller';
import { CategoryIconService } from '@api/finance/v1/category-icon.service';
import { ValidationError } from '@shared/domain/error/ValidationError';

const serviceMock = { findAll: jest.fn().mockResolvedValue({ items: [] }) };
let setup: CategoryIconController;

beforeEach(async () => {
  jest.clearAllMocks();
  const module = await Test.createTestingModule({
    controllers: [CategoryIconController],
    providers: [{ provide: CategoryIconService, useValue: serviceMock }],
  }).compile();

  setup = module.get(CategoryIconController);
});

it('SHOULD be served at /finance/category-icons under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, CategoryIconController)).toBe('finance/category-icons');
  expect(Reflect.getMetadata(VERSION_METADATA, CategoryIconController)).toBe('1');
});

it('SHOULD default the limit to 60 and pass q', async () => {
  await setup.findAll({ q: 'pasta' });

  expect(serviceMock.findAll).toHaveBeenCalledWith('pasta', 60);
});

it('SHOULD coerce a numeric limit from the query string', async () => {
  await setup.findAll({ limit: '200' });

  expect(serviceMock.findAll).toHaveBeenCalledWith(undefined, 200);
});

it.each(['0', '201', 'abc'])('SHOULD throw ValidationError WHEN limit is %s', async (limit) => {
  await expect(setup.findAll({ limit })).rejects.toThrow(ValidationError);
});
