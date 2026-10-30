import { HTTP_CODE_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { IS_PUBLIC_KEY } from '@shared/infra/http/decorators/Public';

import { VersionController } from './version.controller';
import { mocks, setup } from './version.controller.mocks';

it('SHOULD be served at /version under URI version 1 AND be public', () => {
  expect(Reflect.getMetadata(PATH_METADATA, VersionController)).toBe('version');
  expect(Reflect.getMetadata(VERSION_METADATA, VersionController)).toBe('1');
  expect(Reflect.getMetadata(IS_PUBLIC_KEY, VersionController.prototype.get)).toBe(true);
  expect(Reflect.getMetadata(HTTP_CODE_METADATA, VersionController.prototype.get)).toBe(200);
});

describe('get', () => {
  it('SHOULD return the service output WITHOUT refresh by default', async () => {
    expect(await setup.get({})).toBe(mocks.output);
    expect(mocks.versionService.get).toHaveBeenCalledWith(false);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('SHOULD forward refresh=%s', async (value, expected) => {
    await setup.get({ refresh: value });

    expect(mocks.versionService.get).toHaveBeenCalledWith(expected);
  });

  it('SHOULD reject refresh=maybe', async () => {
    await expect(setup.get({ refresh: 'maybe' })).rejects.toBeInstanceOf(ValidationError);
    expect(mocks.versionService.get).not.toHaveBeenCalled();
  });
});
