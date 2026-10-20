import CreditCardEntity from '@finance/domain/entity/CreditCardEntity';
import { OwnerAccess } from '@finance/domain/entity/OwnerAccess';
import { AccountStatus, CreditCardBrand } from '@finance/domain/enum';
import { CurrencyCode } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

export type IFinanceCreditCardRepository = {
  createCreditCard(params: CreateCreditCardRepositoryParams): Promise<CreditCardEntity>;
  deleteCreditCard(id: string): Promise<void>;
  existsByOwner(access: OwnerAccess): Promise<boolean>;
  findCreditCardById(id: string): Promise<CreditCardEntity | undefined>;
  findCreditCards(owners: OwnerAccess[], status?: AccountStatus): Promise<CreditCardEntity[]>;
  updateCreditCard(params: UpdateCreditCardRepositoryParams): Promise<CreditCardEntity>;
};

interface CreateCreditCardRepositoryParams {
  brand: CreditCardBrand;
  closingDay: number;
  color: string;
  currency: CurrencyCode;
  dueDay: number;
  lastDigits?: string;
  limit: number;
  owner: OwnerType;
  ownerId: string;
  paymentAccountId?: string;
  paymentDay?: number;
  status: AccountStatus;
  title: string;
}
// `null` clears the optional columns; `undefined` leaves them untouched.
interface UpdateCreditCardRepositoryParams {
  brand?: CreditCardBrand;
  closingDay?: number;
  color?: string;
  dueDay?: number;
  id: string;
  lastDigits?: null | string;
  limit?: number;
  owner?: OwnerType;
  ownerId?: string;
  paymentAccountId?: null | string;
  paymentDay?: null | number;
  status?: AccountStatus;
  title?: string;
}

export { CreateCreditCardRepositoryParams, UpdateCreditCardRepositoryParams };
