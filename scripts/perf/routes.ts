import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

export interface RouteInfo {
  method: string;
  template: string;
}

export interface FileRoute extends RouteInfo {
  file: string;
}

const ROOT = resolve(__dirname, '../..');

function asList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [''];

  return Array.isArray(value) ? value : [value];
}

function normalize(...parts: string[]): string {
  const joined = parts
    .join('/')
    .split('/')
    .filter((part) => part !== '')
    .join('/');

  return `/${joined}`;
}

// Reads the Nest decorators of one controller class (no DI, no database).
export function routesOfController(controller: object): RouteInfo[] {
  const version = Reflect.getMetadata(VERSION_METADATA, controller) as string | undefined;
  const prefixes = asList(Reflect.getMetadata(PATH_METADATA, controller));
  const proto = (controller as { prototype: object }).prototype;
  const routes: RouteInfo[] = [];

  for (const name of Object.getOwnPropertyNames(proto)) {
    const handler = (proto as Record<string, unknown>)[name];
    if (typeof handler !== 'function') continue;
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
    if (method === undefined) continue;
    for (const prefix of prefixes) {
      for (const sub of asList(Reflect.getMetadata(PATH_METADATA, handler))) {
        routes.push({
          method: RequestMethod[method],
          template: normalize('api', version ? `v${version}` : '', prefix, sub),
        });
      }
    }
  }

  return routes;
}

function controllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return controllerFiles(full);

    return entry.name.endsWith('.controller.ts') ? [full] : [];
  });
}

export function listRoutes(apiDir: string = join(ROOT, 'src/api')): FileRoute[] {
  return controllerFiles(apiDir)
    .sort()
    .flatMap((file) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const exported = require(file) as Record<string, unknown>;

      return Object.values(exported)
        .filter((value) => typeof value === 'function')
        .flatMap((controller) =>
          routesOfController(controller as object).map((route) => ({
            ...route,
            file: relative(ROOT, file),
          })),
        );
    });
}
