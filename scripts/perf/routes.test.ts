import { Controller, Delete, Get, Post } from '@nestjs/common';

import { listRoutes, routesOfController } from './routes';

@Controller({ path: 'things', version: '1' })
class ThingsController {
  @Get()
  list() {
    return [];
  }

  @Get(':id')
  one() {
    return {};
  }

  @Post('a/b')
  nested() {
    return {};
  }
}

@Controller({ path: ['alpha', 'beta'], version: '2' })
class ManyController {
  @Delete(':id')
  remove() {
    return {};
  }
}

@Controller('plain')
class PlainController {
  @Get()
  read() {
    return {};
  }
}

@Controller({ version: '1' })
class RootController {
  @Get('families/:familyId/members')
  members() {
    return [];
  }
}

describe('routesOfController', () => {
  it('SHOULD list method and template with api prefix and version', () => {
    expect(routesOfController(ThingsController)).toEqual([
      { method: 'GET', template: '/api/v1/things' },
      { method: 'GET', template: '/api/v1/things/:id' },
      { method: 'POST', template: '/api/v1/things/a/b' },
    ]);
  });

  it('SHOULD emit one route per controller path', () => {
    expect(routesOfController(ManyController)).toEqual([
      { method: 'DELETE', template: '/api/v2/alpha/:id' },
      { method: 'DELETE', template: '/api/v2/beta/:id' },
    ]);
  });

  it('SHOULD omit the version WHEN the controller has none', () => {
    expect(routesOfController(PlainController)).toEqual([
      { method: 'GET', template: '/api/plain' },
    ]);
  });

  it('SHOULD accept a controller without a path', () => {
    expect(routesOfController(RootController)).toEqual([
      { method: 'GET', template: '/api/v1/families/:familyId/members' },
    ]);
  });
});

describe('listRoutes', () => {
  it('SHOULD find the known routes in src/api', () => {
    const keys = listRoutes().map((route) => `${route.method} ${route.template}`);

    expect(keys).toEqual(
      expect.arrayContaining([
        'GET /api/health',
        'GET /api/v1/stock/items',
        'POST /api/v1/family-invites/:token/accept',
        'GET /api/v1/finance/transactions/export/count',
      ]),
    );
  });

  it('SHOULD report the controller file of each route', () => {
    const health = listRoutes().find((route) => route.template === '/api/health');

    expect(health?.file).toBe('src/api/health/health.controller.ts');
  });
});
