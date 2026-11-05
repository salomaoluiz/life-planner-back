import { CallHandler } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Observable, tap } from 'rxjs';

// Spec 092: wrappers so the API layer reaches Express, RxJS and async_hooks only through `@shared/infra`.
// Re-exported for handler tests (an Observable of a value / its last value).
export { lastValueFrom } from 'rxjs';
export type HttpRequest = Request;
export type HttpResponse = Response;

// An Observable that emits `value` once (handler tests).
export function valueStream<T>(value: T): Observable<T> {
  return new Observable<T>((subscriber) => {
    subscriber.next(value);
    subscriber.complete();
  });
}

// A value that travels with the async work of ONE request (the handler and everything it awaits).
export class RequestContextStore<T> {
  private readonly storage = new AsyncLocalStorage<T>();

  get(): T | undefined {
    return this.storage.getStore();
  }

  // Runs the handler with `value` in the store; `onSuccess` fires for each value the handler emits.
  intercept(value: T, next: CallHandler, onSuccess: () => void): Observable<unknown> {
    return new Observable((subscriber) =>
      this.storage.run(value, () => next.handle().pipe(tap(onSuccess)).subscribe(subscriber)),
    );
  }

  run<R>(value: T, callback: () => R): R {
    return this.storage.run(value, callback);
  }
}
