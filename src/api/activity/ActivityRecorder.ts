import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ActivityReaderRegistry } from '@activity/application/service/ActivityReaderRegistry';
import { RecordActivityUseCase } from '@activity/application/use-case/RecordActivityUseCase';
import { ActivityItemInput } from '@activity/domain/entity/ActivityEntry';
import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityAction, ActivityEntityType } from '@activity/domain/enum';
import { Database } from '@shared/infra/db/Database';
import { fromPromise, HttpRequest, lastValueFrom } from '@shared/infra/http/request-context';
import { JwtPayload } from '@shared/infra/jwt/types';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';

export const ACTIVITY_METADATA = 'activity:descriptor';

export interface ActivityContext {
  body: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
  // `undefined` while the "before" snapshot is read.
  response: unknown;
  userId: string;
}
export interface ActivitySnapshots {
  after: ActivitySnapshot | null;
  before: ActivitySnapshot | null;
}

// Spec 127: what one write route records. See the plan, Task 5.
export interface ActivityDescriptor {
  action: ActivityAction;
  // `true` for a request that writes several rows (FR 3); a function decides from the request.
  batch?: ((context: ActivityContext) => boolean) | boolean;
  entityType: ActivityEntityType;
  extra?: (context: ActivityContext, snapshots: ActivitySnapshots) => Record<string, unknown>;
  // Id handed to the reader (before and after). Default: `:id` of the route, else `response.id`.
  idFrom?: (context: ActivityContext) => string | undefined;
  items?: (context: ActivityContext, snapshots: ActivitySnapshots) => Promise<ActivityItemInput[]>;
  // The route did not write (dry run, nothing created): the request records nothing.
  skipWhen?: (context: ActivityContext) => boolean;
  // Replaces the "after" read for a request that has no single item to read (CSV import).
  snapshot?: (context: ActivityContext) => Promise<ActivitySnapshot | null>;
}

// Method decorator: the route runs inside one transaction with its history entry (FR 1).
export function RecordsActivity(descriptor: ActivityDescriptor) {
  return applyDecorators(
    SetMetadata(ACTIVITY_METADATA, descriptor),
    UseInterceptors(ActivityRecorderInterceptor),
  );
}

function defaultId(context: ActivityContext): string | undefined {
  return context.params.id ?? (context.response as { id?: string } | undefined)?.id;
}

@Injectable()
export class ActivityRecorderInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: Database,
    private readonly registry: ActivityReaderRegistry,
    private readonly recordActivityUseCase: RecordActivityUseCase,
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const descriptor = this.reflector.get<ActivityDescriptor | undefined>(
      ACTIVITY_METADATA,
      context.getHandler(),
    );

    if (!descriptor) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<HttpRequest & JwtPayload>();

    return fromPromise(async () =>
      this.database.runInTransaction(async () => this.record(descriptor, request, next)),
    );
  }

  private async read(
    entityType: ActivityEntityType,
    id: string | undefined,
  ): Promise<ActivitySnapshot | null> {
    const reader = this.registry.get(entityType);

    if (!reader) {
      throw new Error(`No activity reader registered for ${entityType}`);
    }

    return id === undefined ? null : reader.read(id);
  }

  private async readAfter(
    descriptor: ActivityDescriptor,
    context: ActivityContext,
    idFrom: (context: ActivityContext) => string | undefined,
  ): Promise<ActivitySnapshot | null> {
    if (descriptor.action === ActivityAction.DELETE) {
      return null;
    }

    return descriptor.snapshot
      ? descriptor.snapshot(context)
      : this.read(descriptor.entityType, idFrom(context));
  }

  private async record(
    descriptor: ActivityDescriptor,
    request: HttpRequest & JwtPayload,
    next: CallHandler,
  ): Promise<unknown> {
    const base = {
      body: request.body as unknown,
      params: request.params as Record<string, string>,
      query: request.query as Record<string, unknown>,
      userId: request.user.id,
    };
    const idFrom = descriptor.idFrom ?? defaultId;
    const beforeContext = { ...base, response: undefined };
    const before =
      descriptor.action === ActivityAction.CREATE
        ? null
        : await this.read(descriptor.entityType, idFrom(beforeContext));
    const response = await lastValueFrom(next.handle());
    const after = { ...base, response };

    if (descriptor.skipWhen?.(after)) {
      return response;
    }

    const afterSnapshot = await this.readAfter(descriptor, after, idFrom);
    const snapshots = { after: afterSnapshot, before };
    const actor = await this.findUserByIdUseCase.execute({ id: request.user.id });

    await this.recordActivityUseCase.execute({
      action: descriptor.action,
      actor: { id: actor.id, name: actor.name },
      after: afterSnapshot,
      batch:
        typeof descriptor.batch === 'function'
          ? descriptor.batch(after)
          : (descriptor.batch ?? false),
      before,
      extra: descriptor.extra?.(after, snapshots),
      items: descriptor.items ? await descriptor.items(after, snapshots) : [],
    });

    return response;
  }
}
