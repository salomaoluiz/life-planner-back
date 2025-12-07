import { faker } from '@faker-js/faker';

import { EnvService } from './env.service';

class EnvServiceFixture {
  value = {} as Record<keyof EnvService, unknown>;

  constructor() {
    this.withDefault();
  }

  build() {
    const temp = { ...this.value };
    this.withDefault();
    return temp;
  }

  withDefault() {
    this.value = {
      dbHost: faker.internet.ipv4(),
      dbName: faker.string.alphanumeric(10),
      dbPassword: faker.internet.password(),
      dbPort: faker.internet.port().toString(),
      dbUser: faker.internet.username(),
      environment: faker.helpers.arrayElement(['development', 'production', 'test']),
      jwtExpiresIn: faker.number.int({ max: 86400, min: 3600 }),
      jwtSecret: faker.string.alphanumeric(64),
      port: faker.internet.port(),
    };
    return this;
  }

  // Builder methods

  withDbHost(dbHost: string) {
    this.value.dbHost = dbHost;
    return this;
  }

  withDbName(dbName: string) {
    this.value.dbName = dbName;
    return this;
  }

  withDbPassword(dbPassword: string) {
    this.value.dbPassword = dbPassword;
    return this;
  }

  withDbPort(dbPort: string) {
    this.value.dbPort = dbPort;
    return this;
  }

  withDbUser(dbUser: string) {
    this.value.dbUser = dbUser;
    return this;
  }

  withEnvironment(environment: string) {
    this.value.environment = environment;
    return this;
  }

  withJwtExpiresIn(jwtExpiresIn: number) {
    this.value.jwtExpiresIn = jwtExpiresIn;
    return this;
  }

  withJwtSecret(jwtSecret: string) {
    this.value.jwtSecret = jwtSecret;
    return this;
  }

  withPort(port: number) {
    this.value.port = port;
    return this;
  }
}

export default EnvServiceFixture;
