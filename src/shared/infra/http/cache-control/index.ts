import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

import { IS_PUBLIC_KEY } from '@shared/infra/http/decorators/Public';

// Spec 072: money data is never stored by shared caches and always revalidated through the ETag.
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic || http.getRequest<Request>().method !== 'GET') {
      return next.handle();
    }

    return next
      .handle()
      .pipe(
        tap(() => http.getResponse<Response>().setHeader('Cache-Control', 'private, no-cache')),
      );
  }
}
