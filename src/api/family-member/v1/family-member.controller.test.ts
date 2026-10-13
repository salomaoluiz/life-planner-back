import { HTTP_CODE_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './family-member.controller.mocks';

const familyId = '0d6c9c1e-3c2b-4f57-8e7c-2a1b9a6e4d33';

function routeOf(method: 'accept' | 'delete' | 'findAll' | 'invite' | 'preview') {
  return Reflect.getMetadata(PATH_METADATA, setup[method]);
}

it('SHOULD be served under URI version 1', () => {
  expect(Reflect.getMetadata(VERSION_METADATA, setup.constructor)).toBe('1');
});

it('SHOULD expose the five contract routes', () => {
  expect(routeOf('findAll')).toBe('families/:familyId/members');
  expect(routeOf('invite')).toBe('families/:familyId/members');
  expect(routeOf('delete')).toBe('family-members/:memberId');
  expect(routeOf('preview')).toBe('family-invites/:token');
  expect(routeOf('accept')).toBe('family-invites/:token/accept');
});

it('SHOULD answer 204 on delete AND 200 (not the POST default 201) on accept', () => {
  expect(Reflect.getMetadata(HTTP_CODE_METADATA, setup.delete)).toBe(204);
  expect(Reflect.getMetadata(HTTP_CODE_METADATA, setup.accept)).toBe(200);
});

describe('findAll', () => {
  it('SHOULD list the members of the family for the JWT user', async () => {
    expect(await setup.findAll(mocks.request, familyId)).toEqual([mocks.member]);
    expect(mocks.familyMemberService.findAll).toHaveBeenCalledWith(mocks.request.user.id, familyId);
  });
});

describe('invite', () => {
  it('SHOULD invite the trimmed, lower-cased email', async () => {
    await setup.invite(mocks.request, familyId, { email: ' Invitee@Example.com ' });

    expect(mocks.familyMemberService.invite).toHaveBeenCalledWith(mocks.request.user.id, familyId, {
      email: 'invitee@example.com',
    });
  });

  it('SHOULD drop client-supplied userId/role so they never reach the service', async () => {
    await setup.invite(mocks.request, familyId, {
      email: 'a@example.com',
      role: 'OWNER',
      userId: 'someone-else',
    } as { email: string });

    expect(mocks.familyMemberService.invite).toHaveBeenCalledWith(mocks.request.user.id, familyId, {
      email: 'a@example.com',
    });
  });

  it.each([
    ['missing body', undefined],
    ['missing email', {}],
    ['empty email', { email: '' }],
    ['invalid email', { email: 'nope' }],
    ['null email', { email: null }],
    ['numeric email', { email: 123 }],
    ['255-char email', { email: `${'a'.repeat(246)}@test.com` }],
  ])('SHOULD throw ValidationError (400) WHEN %s', async (_label, body) => {
    await expect(setup.invite(mocks.request, familyId, body as never)).rejects.toThrow(
      ValidationError,
    );
    expect(mocks.familyMemberService.invite).not.toHaveBeenCalled();
  });
});

describe('delete', () => {
  it('SHOULD delete the member as the JWT user', async () => {
    await setup.delete(mocks.request, 'member-id');

    expect(mocks.familyMemberService.delete).toHaveBeenCalledWith(
      mocks.request.user.id,
      'member-id',
    );
  });
});

describe.each(['preview', 'accept'] as const)('%s', (method) => {
  it('SHOULD forward a well-formed token with the JWT user', async () => {
    await setup[method](mocks.request, mocks.token);

    expect(mocks.familyMemberService[method]).toHaveBeenCalledWith(
      mocks.request.user.id,
      mocks.token,
    );
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'a'.repeat(44)],
    ['legacy base64 JSON', Buffer.from('{"email":"a@b.c","familyId":"1"}').toString('base64')],
    ['standard base64 symbols', `${'a'.repeat(41)}+/`],
  ])(
    'SHOULD throw ValidationError (400) AND call nothing WHEN the token is %s',
    async (_label, token) => {
      await expect(setup[method](mocks.request, token)).rejects.toThrow(ValidationError);
      expect(mocks.familyMemberService[method]).not.toHaveBeenCalled();
    },
  );
});
