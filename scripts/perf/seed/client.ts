export class ApiClient {
  private token?: string;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  delete(path: string): Promise<void> {
    return this.request<void>('DELETE', path);
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async login(email: string, password: string): Promise<void> {
    const result = await this.request<{ token: string }>('POST', '/api/v1/auth/login/email', {
      email,
      password,
    });
    this.token = result.token;
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async signup(email: string, name: string, password: string): Promise<void> {
    await this.request<void>('POST', '/api/v1/auth/signup/email', { email, name, password });
  }

  // Errors name the endpoint and the status only: bodies can carry personal data.
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      method,
    });
    if (!response.ok) {
      throw new Error(`${method} ${path} -> ${response.status}`);
    }

    return (await response.json().catch(() => undefined)) as T;
  }
}
