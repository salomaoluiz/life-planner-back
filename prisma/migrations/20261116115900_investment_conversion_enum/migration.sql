-- Spec 112: conversion operation types. Own migration: PostgreSQL can't use a new enum value in the transaction that adds it.
ALTER TYPE "InvestmentOperationType" ADD VALUE 'CONVERSION_OUT';
ALTER TYPE "InvestmentOperationType" ADD VALUE 'CONVERSION_IN';
