import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@db/client';
import { EnvService } from '@shared/infra/env/env.service';

@Injectable()
export class Database {
  prisma: PrismaClient;

  constructor(private readonly env: EnvService) {
    const adapter = new PrismaPg({
      connectionString: `postgresql://${this.env.dbUser}:${this.env.dbPassword}@${this.env.dbHost}:${this.env.dbPort}/${this.env.dbName}`,
    });

    this.prisma = new PrismaClient({
      adapter,
    });
  }

  get client(): PrismaClient {
    return this.prisma;
  }
}
