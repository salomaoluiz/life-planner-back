import { resetPerfAccount } from './reset';
import { SeedRefusal } from './safety';

function fakeClient() {
  return {
    delete: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(undefined),
    signup: jest.fn().mockResolvedValue(undefined),
  };
}

describe('resetPerfAccount', () => {
  it('refuses a different logged-in email before any call', async () => {
    const client = fakeClient();

    await expect(
      resetPerfAccount(client as never, 'other@example.com', 'perf@example.com', 'pw'),
    ).rejects.toBeInstanceOf(SeedRefusal);

    expect(client.delete).not.toHaveBeenCalled();
    expect(client.signup).not.toHaveBeenCalled();
  });

  it('deletes the account and signs up and logs in again', async () => {
    const client = fakeClient();

    await resetPerfAccount(client as never, 'Perf@Example.com', 'perf@example.com', 'pw');

    expect(client.delete).toHaveBeenCalledTimes(1);
    expect(client.delete).toHaveBeenCalledWith('/api/v1/user/me', { email: 'perf@example.com' });
    expect(client.signup).toHaveBeenCalledWith('perf@example.com', 'Perf account', 'pw');
    expect(client.login).toHaveBeenCalledWith('perf@example.com', 'pw');
  });
});
