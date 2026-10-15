import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD return the stored email WHEN the typed email matches', async () => {
  const result = await setup.execute({ email: 'test@example.com', id: mocks.userId });

  expect(result).toEqual({ email: mocks.user.email });
  expect(mocks.userRepository.getUserById).toHaveBeenCalledWith(mocks.userId);
});

it.each(['  TEST@example.com  ', 'Test@Example.com'])(
  'SHOULD accept case and surrounding spaces (%s)',
  async (typed) => {
    await expect(setup.execute({ email: typed, id: mocks.userId })).resolves.toBeDefined();
  },
);

it('SHOULD compare case-insensitively WHEN the stored email has uppercase (legacy rows)', async () => {
  mocks.userRepository.getUserById.mockResolvedValueOnce({
    ...mocks.user,
    email: 'Test@Example.com',
  });

  await expect(
    setup.execute({ email: 'test@example.com', id: mocks.userId }),
  ).resolves.toBeDefined();
});

it('SHOULD throw UnprocessableEntityException("Email does not match") WHEN the email is another one', async () => {
  await expect(setup.execute({ email: 'other@example.com', id: mocks.userId })).rejects.toThrow(
    new UnprocessableEntityException('Email does not match'),
  );
});

it('SHOULD throw NotFoundException WHEN the user is already gone', async () => {
  mocks.userRepository.getUserById.mockResolvedValueOnce(undefined);

  await expect(setup.execute({ email: 'test@example.com', id: mocks.userId })).rejects.toThrow(
    NotFoundException,
  );
});

it('SHOULD throw ValidationError WHEN the email is malformed', async () => {
  await expect(setup.execute({ email: 'not-an-email', id: mocks.userId })).rejects.toThrow(
    ValidationError,
  );
});
