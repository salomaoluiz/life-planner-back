interface ITransferEntity {
  amountIn: null | number;
  amountOut: number;
  createdAt: Date;
  createdBy: string;
  currencyIn: string;
  currencyOut: string;
  // Calendar dates `YYYY-MM-DD`.
  dateIn: string;
  dateOut: string;
  description: string;
  fee: null | number;
  // The expense row of the fee on the destination account, when there is a fee.
  feeRowId: null | string;
  // Null once the account was deleted (FK SetNull).
  fromAccountId: null | string;
  id: string;
  notes: null | string;
  occurrenceNumber: null | number;
  paid: boolean;
  recurrenceId: null | string;
  // Ids of the out, in and fee rows (the in row is absent while the amount in is unknown).
  rowIds: string[];
  toAccountId: null | string;
  updatedAt: Date;
}

// Spec 098: one movement between two accounts; its rows are ordinary transactions with `transferId`.
class TransferEntity {
  amountIn: null | number;
  amountOut: number;
  createdAt: Date;
  createdBy: string;
  currencyIn: string;
  currencyOut: string;
  dateIn: string;
  dateOut: string;
  description: string;
  fee: null | number;
  feeRowId: null | string;
  fromAccountId: null | string;
  id: string;
  notes: null | string;
  occurrenceNumber: null | number;
  paid: boolean;
  recurrenceId: null | string;
  rowIds: string[];
  toAccountId: null | string;
  updatedAt: Date;

  constructor(params: ITransferEntity) {
    this.amountIn = params.amountIn;
    this.amountOut = params.amountOut;
    this.createdAt = params.createdAt;
    this.createdBy = params.createdBy;
    this.currencyIn = params.currencyIn;
    this.currencyOut = params.currencyOut;
    this.dateIn = params.dateIn;
    this.dateOut = params.dateOut;
    this.description = params.description;
    this.fee = params.fee;
    this.feeRowId = params.feeRowId;
    this.fromAccountId = params.fromAccountId;
    this.id = params.id;
    this.notes = params.notes;
    this.occurrenceNumber = params.occurrenceNumber;
    this.paid = params.paid;
    this.recurrenceId = params.recurrenceId;
    this.rowIds = params.rowIds;
    this.toAccountId = params.toAccountId;
    this.updatedAt = params.updatedAt;
  }
}

export default TransferEntity;
