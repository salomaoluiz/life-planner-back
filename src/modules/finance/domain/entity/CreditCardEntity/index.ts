import { AccountStatus, CreditCardBrand } from '@finance/domain/enum';
import { CurrencyCode, DEFAULT_CURRENCY } from '@finance/domain/enum/Currency';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

interface ICreditCardEntity {
  brand: CreditCardBrand;
  closingDay: number;
  color: string;
  createdAt: Date;
  currency?: CurrencyCode;
  dueDay: number;
  id: string;
  lastDigits?: string;
  limit: number;
  owner: OwnerType;
  ownerId: string;
  paymentAccountId?: string;
  paymentDay?: number;
  status: AccountStatus;
  title: string;
  updatedAt: Date;
}

class CreditCardEntity {
  brand: CreditCardBrand;
  closingDay: number;
  color: string;
  createdAt: Date;
  currency: CurrencyCode;
  dueDay: number;
  id: string;
  lastDigits?: string;
  limit: number;
  owner: OwnerType;
  ownerId: string;
  paymentAccountId?: string;
  paymentDay?: number;
  status: AccountStatus;
  title: string;
  updatedAt: Date;

  constructor(params: ICreditCardEntity) {
    this.brand = params.brand;
    this.closingDay = params.closingDay;
    this.color = params.color;
    this.createdAt = params.createdAt;
    this.currency = params.currency ?? DEFAULT_CURRENCY;
    this.dueDay = params.dueDay;
    this.id = params.id;
    this.lastDigits = params.lastDigits;
    this.limit = params.limit;
    this.owner = params.owner;
    this.ownerId = params.ownerId;
    this.paymentAccountId = params.paymentAccountId;
    this.paymentDay = params.paymentDay;
    this.status = params.status;
    this.title = params.title;
    this.updatedAt = params.updatedAt;
  }
}

export default CreditCardEntity;
