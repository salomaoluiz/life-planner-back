import {
  AssetDetailView,
  AssetView,
  ConversionLink,
  OperationView,
} from '@investment/application/service/AssetView';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { ConversionDetail } from '@investment/domain/entity/ConversionEntity';
import { InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

export interface ConversionView {
  cashAmount: null | number;
  cashReferenceUnitValue: Decimal8 | null;
  date: string;
  from: {
    assetId: string;
    cost: number;
    operationId: string;
    quantity: Decimal8;
    ticker: null | string;
  };
  id: string;
  locked: boolean;
  ratioFrom: Decimal8;
  ratioTo: Decimal8;
  to: {
    assetId: string;
    cost: number;
    fractionCost: number;
    fractionQuantity: Decimal8;
    operationId: string;
    quantity: Decimal8;
    ticker: null | string;
  };
}
export interface ConversionWriteResult {
  fromPosition: AssetView;
  item: ConversionView;
  toPosition: AssetView;
}

// The stored snapshot of both operations (spec 112 FR 12) as the response item.
export function toConversionView(
  conversion: ConversionDetail,
  origin: AssetDetail,
  destination: AssetDetail,
): ConversionView {
  const out = origin.operations.find(
    (operation) =>
      operation.conversionId === conversion.id &&
      operation.type === InvestmentOperationType.CONVERSION_OUT,
  );
  const incoming = destination.operations.find(
    (operation) =>
      operation.conversionId === conversion.id &&
      operation.type === InvestmentOperationType.CONVERSION_IN,
  );

  return {
    cashAmount: conversion.cashAmount,
    cashReferenceUnitValue: conversion.cashReferenceUnitValue,
    date: conversion.date,
    from: {
      assetId: origin.id,
      cost: out?.conversionCost ?? 0,
      operationId: out?.id ?? '',
      quantity: out?.quantity ?? Decimal8.zero(),
      ticker: conversion.fromTicker,
    },
    id: conversion.id,
    locked: conversion.locked,
    ratioFrom: conversion.ratioFrom,
    ratioTo: conversion.ratioTo,
    to: {
      assetId: destination.id,
      cost: incoming?.conversionCost ?? 0,
      fractionCost: incoming?.fractionCost ?? 0,
      fractionQuantity: incoming?.fractionQuantity ?? Decimal8.zero(),
      operationId: incoming?.id ?? '',
      quantity: incoming?.quantity ?? Decimal8.zero(),
      ticker: conversion.toTicker,
    },
  };
}

// Spec 112 FR 17, 22: `convertedTo` / `convertedFrom` on an asset read.
export function linksOf(
  assetId: string,
  conversions: ConversionDetail[],
): { convertedFrom: ConversionLink[]; convertedTo: ConversionLink | null } {
  const out = conversions.find((conversion) => conversion.fromAssetId === assetId);

  return {
    convertedFrom: conversions
      .filter((conversion) => conversion.toAssetId === assetId)
      .map((conversion) => ({
        assetId: conversion.fromAssetId,
        conversionId: conversion.id,
        date: conversion.date,
        ticker: conversion.fromTicker,
      })),
    convertedTo: out
      ? { assetId: out.toAssetId, conversionId: out.id, date: out.date, ticker: out.toTicker }
      : null,
  };
}

// The detail of an asset with its conversion links and the conversion data on its conversion operations.
export function withConversions(
  detail: AssetDetail,
  view: AssetDetailView,
  conversions: ConversionDetail[],
): AssetDetailView {
  const byId = new Map(conversions.map((conversion) => [conversion.id, conversion]));

  return {
    ...view,
    ...linksOf(detail.id, conversions),
    operations: view.operations.map((item) => withOperationConversion(item, detail.id, byId)),
  };
}

function withOperationConversion(
  item: OperationView,
  assetId: string,
  byId: Map<string, ConversionDetail>,
): OperationView {
  const conversion = item.operation.conversionId ? byId.get(item.operation.conversionId) : null;

  if (!conversion) {
    return item;
  }

  const out = conversion.fromAssetId === assetId;

  return {
    ...item,
    conversion: {
      assetId: out ? conversion.toAssetId : conversion.fromAssetId,
      cashAmount: conversion.cashAmount,
      cashReferenceUnitValue: conversion.cashReferenceUnitValue,
      conversionId: conversion.id,
      locked: conversion.locked,
      ratioFrom: conversion.ratioFrom,
      ratioTo: conversion.ratioTo,
      ticker: out ? conversion.toTicker : conversion.fromTicker,
    },
  };
}
