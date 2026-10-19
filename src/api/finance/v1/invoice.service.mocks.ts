import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinanceAccessService } from '@api/finance/v1/finance-access.service';
import { InvoiceService } from '@api/finance/v1/invoice.service';
import { GetInvoicesForListUseCase } from '@finance/application/use-case/GetInvoicesForListUseCase';
import { GetInvoiceUseCase } from '@finance/application/use-case/GetInvoiceUseCase';
import { MaterializeRecurrencesUseCase } from '@finance/application/use-case/MaterializeRecurrencesUseCase';
import { PayInvoiceUseCase } from '@finance/application/use-case/PayInvoiceUseCase';
import { UndoInvoicePaymentUseCase } from '@finance/application/use-case/UndoInvoicePaymentUseCase';
import CreditCardEntityFixture from '@finance/domain/entity/mocks/CreditCardEntity.fixture';
import TransactionEntityFixture from '@finance/domain/entity/mocks/TransactionEntity.fixture';
import { InvoicePaymentMethod, InvoiceStatus, SystemCategoryKey } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

// region Mocks

const userId = faker.string.uuid();
const accessibleOwners = [{ owner: OwnerType.USER, ownerId: userId }];
const cardMock = new CreditCardEntityFixture().build();
const purchaseMock = new TransactionEntityFixture().withCard(cardMock.id, '2026-10').build();
const refundMock = new TransactionEntityFixture()
  .withCredit(SystemCategoryKey.CARD_REFUND, cardMock.id, '2026-10')
  .build();
const invoiceMock = {
  amount: 45000,
  amountDue: 45000,
  carryIn: 0,
  closingDate: '2026-10-31',
  dueDate: '2026-11-10',
  earlyPaid: 0,
  listDate: '2026-11-05',
  net: 45000,
  payment: null,
  paymentAfterDue: false,
  paymentDate: '2026-11-05',
  periodEnd: '2026-10-31',
  periodStart: '2026-10-01',
  referenceMonth: '2026-10',
  status: InvoiceStatus.CLOSED,
  total: 45000,
};
const detailMock = {
  card: cardMock,
  credits: [refundMock],
  invoice: invoiceMock,
  purchases: [purchaseMock],
};
const paymentMock = {
  accountId: null,
  accountName: null,
  amount: 45000,
  creditCardId: cardMock.id,
  invoiceMonth: '2026-10',
  method: InvoicePaymentMethod.EXTERNAL,
  paidOn: '2026-11-05',
};
const financeAccessServiceMock = { resolve: jest.fn().mockResolvedValue(accessibleOwners) };
const getInvoiceMock = { execute: jest.fn().mockResolvedValue(detailMock) };
const getInvoicesForListMock = { execute: jest.fn().mockResolvedValue([detailMock]) };
const payInvoiceMock = { execute: jest.fn().mockResolvedValue(paymentMock) };
const undoInvoicePaymentMock = { execute: jest.fn().mockResolvedValue(undefined) };

const materializeRecurrencesUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };

// endregion Mocks

let setup: InvoiceService;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      InvoiceService,
      { provide: FinanceAccessService, useValue: financeAccessServiceMock },
      { provide: GetInvoiceUseCase, useValue: getInvoiceMock },
      { provide: GetInvoicesForListUseCase, useValue: getInvoicesForListMock },
      { provide: PayInvoiceUseCase, useValue: payInvoiceMock },
      { provide: UndoInvoicePaymentUseCase, useValue: undoInvoicePaymentMock },
      { provide: MaterializeRecurrencesUseCase, useValue: materializeRecurrencesUseCaseMock },
    ],
  }).compile();

  setup = module.get(InvoiceService);
});

const mocks = {
  accessibleOwners,
  card: cardMock,
  getInvoice: getInvoiceMock,
  getInvoicesForList: getInvoicesForListMock,
  materializeRecurrencesUseCase: materializeRecurrencesUseCaseMock,
  payInvoice: payInvoiceMock,
  payment: paymentMock,
  purchase: purchaseMock,
  refund: refundMock,
  undoInvoicePayment: undoInvoicePaymentMock,
  userId,
};
const spies = {};

export { mocks, setup, spies };
