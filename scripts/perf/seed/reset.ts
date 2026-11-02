import { ApiClient } from './client';
import { SeedRefusal } from './safety';

// Deletes only the perf account (and with it everything it owns), then recreates it empty.
export async function resetPerfAccount(
  client: ApiClient,
  loggedEmail: string,
  perfEmail: string,
  password: string,
): Promise<void> {
  if (loggedEmail.toLowerCase() !== perfEmail.toLowerCase()) {
    throw new SeedRefusal('perf reset refused: the logged-in user is not PERF_USER_EMAIL');
  }
  await client.delete('/api/v1/user/me', { email: perfEmail.toLowerCase() });
  await client.signup(perfEmail, 'Perf account', password);
  await client.login(perfEmail, password);
}
