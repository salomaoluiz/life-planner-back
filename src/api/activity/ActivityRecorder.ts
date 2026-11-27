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

import { ReadActivityGroupUseCase } from '@activity/application/use-case/ReadActivityGroupUseCase';
import { ReadActivitySnapshotUseCase } from '@activity/application/use-case/ReadActivitySnapshotUseCase';
import { RecordActivityUseCase } from '@activity/application/use-case/RecordActivityUseCase';
import { ActivitySnapshot } from '@activity/domain/entity/ActivitySnapshot';
import { ActivityAction, ActivityEntityType, ActivityGroupKind } from '@activity/domain/enum';
import { diffItems } from '@activity/domain/service/ActivityItemsDiff';
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
  entityType: ActivityEntityType;
  extra?: (context: ActivityContext, snapshots: ActivitySnapshots) => Record<string, unknown>;
  // Id handed to the reader (before and after). Default: `:id` of the route, else `response.id`.
  idFrom?: (context: ActivityContext) => string | undefined;
  // A request that writes several rows (FR 3): the rows are read before and after, the changed ones are the items.
  // Returning `undefined` makes it a single-item entry (for example scope ONLY_THIS).
  group?: (
    context: ActivityContext,
  ) => { id: string | undefined; kind: ActivityGroupKind } | undefined;
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
    private readonly readActivityGroupUseCase: ReadActivityGroupUseCase,
    private readonly readActivitySnapshotUseCase: ReadActivitySnapshotUseCase,
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
    return id === undefined ? null : this.readActivitySnapshotUseCase.execute({ entityType, id });
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

  private async readGroup(descriptor: ActivityDescriptor, context: ActivityContext) {
    const group = descriptor.group?.(context);

    return group?.id === undefined
      ? []
      : this.readActivityGroupUseCase.execute({ id: group.id, kind: group.kind });
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
    const beforeItems = await this.readGroup(descriptor, beforeContext);
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
    const items = diffItems(beforeItems, await this.readGroup(descriptor, after));
    const snapshots = { after: afterSnapshot, before };
    const actor = await this.findUserByIdUseCase.execute({ id: request.user.id });

    await this.recordActivityUseCase.execute({
      action: descriptor.action,
      actor: { id: actor.id, name: actor.name },
      after: afterSnapshot,
      batch: descriptor.group?.(after) !== undefined,
      before,
      extra: descriptor.extra?.(after, snapshots),
      items,
    });

    return response;
  }
}
