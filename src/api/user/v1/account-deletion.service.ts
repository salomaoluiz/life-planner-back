import { Inject, Injectable } from '@nestjs/common';

import { DeleteAccountInput } from '@api/user/v1/dto/delete-account.dto';
import { OWNED_RECORDS_PURGES, OwnedRecordsPurgeEntry } from '@api/user/v1/owned-records-purges';
import { GetOwnedFamilyIdsUseCase } from '@family/application/use-case/GetOwnedFamilyIdsUseCase';
import { GetUserFamilyIdsUseCase } from '@family/application/use-case/GetUserFamilyIdsUseCase';
import { RemoveUserFromFamiliesUseCase } from '@family/application/use-case/RemoveUserFromFamiliesUseCase';
import { DetachCategoryCreatorFromFamilyUseCase } from '@finance/application/use-case/DetachCategoryCreatorFromFamilyUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { ConfirmUserEmailUseCase } from '@user/application/use-case/ConfirmUserEmailUseCase';
import { DeleteUserUseCase } from '@user/application/use-case/DeleteUserUseCase';

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly confirmUserEmailUseCase: ConfirmUserEmailUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly detachCategoryCreatorFromFamilyUseCase: DetachCategoryCreatorFromFamilyUseCase,
    private readonly getOwnedFamilyIdsUseCase: GetOwnedFamilyIdsUseCase,
    private readonly getUserFamilyIdsUseCase: GetUserFamilyIdsUseCase,
    @Inject('ILogger') private readonly logger: ILogger,
    @Inject(OWNED_RECORDS_PURGES) private readonly purges: OwnedRecordsPurgeEntry[],
    private readonly removeUserFromFamiliesUseCase: RemoveUserFromFamiliesUseCase,
  ) {}

  // No cross-module transaction yet (deferred decision): every step is idempotent and the user row goes last,
  // so a failure leaves the account in place and a retry finishes the job. Steps run one after the other on purpose.
  async deleteAccount(userId: string, input: DeleteAccountInput): Promise<void> {
    const user = await this.confirmUserEmailUseCase.execute({ email: input.email, id: userId });
    const familyIds = await this.getOwnedFamilyIdsUseCase.execute(userId);
    const owners = [
      { owner: OwnerType.USER, ownerId: userId },
      ...familyIds.map((ownerId) => ({ owner: OwnerType.FAMILY, ownerId })),
    ];

    // Spec 038 FR 14: every family the user belongs to keeps its own copy of their All categories BEFORE the purge,
    // otherwise deleting the Personal categories would hit the records those families still hold.
    const memberFamilyIds = await this.getUserFamilyIdsUseCase.execute(userId);
    for (const familyId of memberFamilyIds) {
      await this.detachCategoryCreatorFromFamilyUseCase.execute({ familyId, userId });
    }

    const purged: Record<string, number> = {};
    for (const { module } of this.purges) {
      purged[module] = 0;
    }
    for (const owner of owners) {
      for (const { module, purge } of this.purges) {
        purged[module] += await purge.execute(owner);
      }
    }

    const removed = await this.removeUserFromFamiliesUseCase.execute({
      email: user.email,
      userId,
    });
    await this.deleteUserUseCase.execute({ id: userId });

    // Only the user id and counts: never the email, names or record contents.
    this.logger.log(LogLevel.INFO, 'Account deleted', {
      families: removed.families,
      memberships: removed.memberships,
      module: 'AccountDeletionService',
      purged,
      userId,
    });
  }
}
