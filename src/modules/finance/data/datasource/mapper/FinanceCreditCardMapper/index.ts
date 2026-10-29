import { FinancialCreditCard } from '@db/client';
import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { AccountStatus, CreditCardBrand } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export class FinanceCreditCardMapper {
  static toDomain(raw: FinancialCreditCard): CreditCardEntity {
    return new CreditCardEntity({
      archivedAt: raw.archived_at ?? undefined,
      brand: CreditCardBrand[raw.brand],
      closingDay: raw.closing_day,
      color: raw.color,
      createdAt: raw.created_at,
      currency: raw.currency as CurrencyCode,
      dueDay: raw.due_day,
      id: raw.id,
      lastDigits: raw.last_digits ?? undefined,
      limit: raw.limit,
      owner: OwnerType[raw.owner],
      ownerId: raw.owner_id,
      paymentAccountId: raw.payment_account_id ?? undefined,
      paymentDay: raw.payment_day ?? undefined,
      status: AccountStatus[raw.status],
      title: raw.title,
      updatedAt: raw.updated_at,
    });
  }
}
