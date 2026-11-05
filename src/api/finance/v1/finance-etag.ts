import {
  applyDecorators,
  CallHandler,
  CanActivate,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FinanceAccessService, resolvedAccessStore } from '@api/finance/v1/finance-access.service';
import { GetOwnerDataVersionsUseCase } from '@finance/application/use-case/GetOwnerDataVersionsUseCase';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { buildDataEtag, matchesEtag } from '@finance/domain/service/DataEtag';
import { NotModifiedException } from '@shared/infra/http/not-modified';
import { HttpRequest, HttpResponse } from '@shared/infra/http/request-context';
import { JwtPayload } from '@shared/infra/jwt/types';

interface EtagState {
  access: { accessibleOwners: OwnerAccess[]; familyNames: Record<string, string>; userId: string };
  dataVersion: string;
  etag: string;
}

const STATE_KEY = 'financeEtag';
type StatefulRequest = { [STATE_KEY]?: EtagState } & HttpRequest & JwtPayload;

// `?ownerId=a&ownerId=b`: strings only. Anything else is left to the handler's validation (400).
function readOwnerIds(raw: unknown): 'invalid' | string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const list = Array.isArray(raw) ? raw : [raw];

  return list.every((value) => typeof value === 'string') ? (list as string[]) : 'invalid';
}

// Spec 092: answers a finance GET with 304 BEFORE any use case runs when the caller's `If-None-Match` still matches.
// Order: authorization (the owners the caller can read) -> data versions of those owners (one query) -> compare.
// A 304 never reveals data: it is only sent to a caller that may read every owner in the ETag.
@Injectable()
export class FinanceEtagGuard implements CanActivate {
  constructor(
    private readonly financeAccessService: FinanceAccessService,
    private readonly getOwnerDataVersionsUseCase: GetOwnerDataVersionsUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<StatefulRequest>();

    if (request.method !== 'GET') {
      return true;
    }

    const userId = request.user.id;
    const access = await this.financeAccessService.resolveWithNames(userId);
    const requested = readOwnerIds(request.query.ownerId);

    if (requested === 'invalid') {
      return true;
    }

    // No `ownerId`: the answer may read any owner of the caller (including archived families).
    const owners =
      requested === undefined
        ? access.accessibleOwners
        : access.accessibleOwners.filter((owner) => requested.includes(owner.ownerId));
    const versions = await this.getOwnerDataVersionsUseCase.execute(owners);
    const queryIndex = request.originalUrl.indexOf('?');
    const etag = buildDataEtag({
      day: new Date().toISOString().slice(0, 10),
      owners,
      path: request.path,
      query: queryIndex === -1 ? '' : request.originalUrl.slice(queryIndex + 1),
      userId,
      versions,
    });
    const dataVersion = versions.join('-');

    if (matchesEtag(request.headers['if-none-match'], etag)) {
      const response = http.getResponse<HttpResponse>();

      response.setHeader('ETag', etag);
      response.setHeader('X-Data-Version', dataVersion);
      response.setHeader('Cache-Control', 'private, no-cache');
      throw new NotModifiedException();
    }

    request[STATE_KEY] = { access: { ...access, userId }, dataVersion, etag };

    return true;
  }
}

// Runs the handler with the access the guard already read, and sends the ETag decided before the work (so Express
// does not hash the body again).
@Injectable()
export class FinanceEtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const state = http.getRequest<StatefulRequest>()[STATE_KEY];

    if (!state) {
      return next.handle();
    }

    return resolvedAccessStore.intercept(state.access, next, () => {
      const response = http.getResponse<HttpResponse>();

      response.setHeader('ETag', state.etag);
      response.setHeader('X-Data-Version', state.dataVersion);
    });
  }
}

// Class decorator for the finance controllers: it only acts on GET handlers.
export function FinanceEtag() {
  return applyDecorators(UseGuards(FinanceEtagGuard), UseInterceptors(FinanceEtagInterceptor));
}
