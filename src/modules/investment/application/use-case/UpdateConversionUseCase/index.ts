import { Inject, NotFoundException } from '@nestjs/common';

import {
  cashIssues,
  UpdateConversionInput,
  UpdateConversionSchema,
} from '@investment/application/dto/ConversionInput';
import { ConversionWriteResult } from '@investment/application/service/ConversionView';
import {
  assertNotLocked,
  readConversionResult,
  toConversionException,
} from '@investment/application/service/ConversionWrite';
import {
  assertLinkedAccountChangeable,
  resolveOperationAccount,
} from '@investment/application/service/OperationRules';
import { ensureOwnerWritable } from '@investment/application/service/OwnerWritable';
import { QuoteContextLoader } from '@investment/application/service/QuoteContext';
import { hasOwnerAccess } from '@investment/domain/entity/OwnerAccess';
import { InvestmentOperationType } from '@investment/domain/enum';
import { IInvestmentRepository } from '@investment/domain/repository';
import { UseCaseWithParams } from '@shared/application/use-case/types';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { validate } from '@shared/infra/validation';

// Spec 112 FR 18: date, ratio and cash fields; the destination can't change; the middle of a chain is locked.
export class UpdateConversionUseCase implements UseCaseWithParams<
  UpdateConversionInput,
  ConversionWriteResult
> {
  constructor(
    @Inject('IInvestmentRepository')
    private readonly repository: IInvestmentRepository,
    private readonly quotes: QuoteContextLoader,
  ) {}

  async execute(params: UpdateConversionInput): Promise<ConversionWriteResult> {
    const input = validate(UpdateConversionSchema, params);
    const conversion = await this.repository.findConversionById(input.id);
    const origin = conversion ? await this.repository.findAssetById(conversion.fromAssetId) : null;

    if (!conversion || !origin || !hasOwnerAccess(input.accessibleOwners, origin)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, origin);
    assertNotLocked(conversion, conversion.toTicker ?? '');

    const out = origin.operations.find(
      (operation) => operation.type === InvestmentOperationType.CONVERSION_OUT,
    );
    const cashAmount = input.cashAmount === undefined ? conversion.cashAmount : input.cashAmount;
    const keptReference = cashAmount === null ? null : conversion.cashReferenceUnitValue;
    const cashReferenceUnitValue =
      input.cashReferenceUnitValue === undefined ? keptReference : input.cashReferenceUnitValue;
    const generateTransaction =
      cashAmount === null
        ? false
        : (input.generateTransaction ?? (input.accountId ? true : !!out?.generateTransaction));
    const accountId =
      cashAmount === null || !generateTransaction
        ? null
        : (input.accountId ?? out?.accountId ?? null);

    const issues = cashIssues({
      accountId,
      cashAmount,
      cashReferenceUnitValue,
      generateTransaction,
    });

    if (issues.length > 0) {
      throw new ValidationError(issues.map((issue) => ({ code: 'custom', ...issue })));
    }

    // The edit may touch the account the cash row already uses.
    await assertLinkedAccountChangeable(
      this.repository,
      input.accessibleOwners,
      out?.accountId ?? null,
    );

    if (generateTransaction && accountId) {
      await resolveOperationAccount(
        this.repository,
        input.accessibleOwners,
        accountId,
        origin.currency,
      );
    }

    try {
      await this.repository.writeConversion({
        accountId,
        assetLabel: origin.ticker ?? origin.name,
        cashAmount,
        cashReferenceUnitValue,
        conversionId: conversion.id,
        currency: origin.currency,
        date: input.date ?? conversion.date,
        destination: { assetId: conversion.toAssetId },
        fromAssetId: origin.id,
        generateTransaction,
        ratioFrom: input.ratioFrom ?? conversion.ratioFrom,
        ratioTo: input.ratioTo ?? conversion.ratioTo,
      });
    } catch (error) {
      throw toConversionException(error);
    }

    return readConversionResult(this.repository, this.quotes, conversion.id);
  }
}
