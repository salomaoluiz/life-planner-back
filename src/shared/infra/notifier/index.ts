import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Client } from 'pg';

import { EnvService } from '@shared/infra/env/env.service';
import { ILogger, LogLevel } from '@shared/infra/logger/types';

import { INotifier } from './types';

const RECONNECT_MS = 5000;
const CHANNEL_PATTERN = /^[a-z_][a-z0-9_]*$/;

// Spec 120 FR 23: Postgres LISTEN/NOTIFY on one dedicated connection, reconnected when it drops.
@Injectable()
export class PgNotifier implements INotifier, OnModuleDestroy {
  private client?: Client;
  private readonly handlers = new Map<string, Set<(payload: string) => void>>();
  private reconnecting?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    private readonly env: EnvService,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  private async connect(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    const client = new Client({
      connectionString: `postgresql://${encodeURIComponent(this.env.dbUser)}:${encodeURIComponent(this.env.dbPassword)}@${this.env.dbHost}:${this.env.dbPort}/${this.env.dbName}`,
    });

    client.on('notification', (message) => {
      this.handlers.get(message.channel)?.forEach((handler) => handler(message.payload ?? ''));
    });
    client.on('error', (error) => this.lost(error));
    client.on('end', () => this.lost());
    await client.connect();
    this.client = client;

    return client;
  }

  private lost(error?: Error): void {
    this.client = undefined;

    if (this.stopped || this.reconnecting) {
      return;
    }

    this.logger.log(LogLevel.WARN, 'Notifier connection lost', {
      error: error?.message,
      module: 'notifier',
    });
    this.reconnecting = setTimeout(() => {
      this.reconnecting = undefined;
      void this.restore();
    }, RECONNECT_MS);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.reconnecting);
    await this.client?.end().catch(() => undefined);
  }

  private async restore(): Promise<void> {
    try {
      const client = await this.connect();

      for (const [channel, known] of this.handlers) {
        if (known.size > 0) {
          await client.query(`LISTEN ${channel}`);
        }
      }
    } catch (error) {
      this.lost(error as Error);
    }
  }

  async subscribe(channel: string, handler: (payload: string) => void): Promise<() => void> {
    if (!CHANNEL_PATTERN.test(channel)) {
      throw new Error('Invalid channel name');
    }

    const known = this.handlers.get(channel) ?? new Set();
    const first = known.size === 0;

    known.add(handler);
    this.handlers.set(channel, known);

    const client = await this.connect();

    if (first) {
      await client.query(`LISTEN ${channel}`);
    }

    return () => {
      known.delete(handler);
    };
  }
}
