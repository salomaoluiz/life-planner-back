import { Prisma } from '@db/client';

const findManySpy = jest.fn();
const createSpy = jest.fn();
const trDeleteManySpy = jest.fn();
const trCreateManySpy = jest.fn();
const trFindManySpy = jest.fn();
const recDeleteManySpy = jest.fn();
const recCreateManySpy = jest.fn();
const recFindManySpy = jest.fn();

const tx = {
  financialRecurrenceTag: {
    createMany: recCreateManySpy,
    deleteMany: recDeleteManySpy,
    findMany: recFindManySpy,
  },
  financialTag: { create: createSpy, findMany: findManySpy },
  financialTransaction: { findMany: trFindManySpy },
  financialTransactionTag: { createMany: trCreateManySpy, deleteMany: trDeleteManySpy },
} as unknown as Prisma.TransactionClient;

const mocks = { tx };
const spies = {
  create: createSpy,
  findMany: findManySpy,
  recCreateMany: recCreateManySpy,
  recDeleteMany: recDeleteManySpy,
  recFindMany: recFindManySpy,
  trCreateMany: trCreateManySpy,
  trDeleteMany: trDeleteManySpy,
  trFindMany: trFindManySpy,
};

export { mocks, spies };
