import { SystemCategoryKey } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

const base = {
  format: 'BR' as const,
  from: '2026-01-01',
  lang: 'pt-BR' as const,
  to: '2026-12-31',
  today: '2026-10-21',
};
const BOM = String.fromCharCode(0xfeff);

it('SHOULD write the header, the category path and the owner name, ";"-separated in BR', async () => {
  const { csv, filename } = await setup.execute({
    ...base,
    accessibleOwners: mocks.accessibleOwners,
    ownerNames: { 'family-id': 'Família Exemplo' },
  });
  const lines = csv.split('\r\n');

  expect(filename).toBe('transacoes-2026-01-01_2026-12-31.csv');
  expect(lines[0]).toBe(
    `${BOM}Data;Descrição;Tipo;Valor;Moeda;Categoria;Conta;Cartão;Fatura;Pago;Tags;Pertence a;Parcela;Recorrente;Notas`,
  );
  expect(lines[1]).toContain('02/10/2026;Supermercado;');
  expect(lines[1]).toContain(';Casa > Mercado;');
  expect(lines[1]).toContain(';Pessoal;');
  expect(lines[2]).toContain(';Família Exemplo;');
});

it('SHOULD use "," and ISO dates in INTL, and the english filename', async () => {
  const { csv, filename } = await setup.execute({
    ...base,
    accessibleOwners: mocks.accessibleOwners,
    format: 'INTL',
    lang: 'en-US',
  });

  expect(filename).toBe('transactions-2026-01-01_2026-12-31.csv');
  expect(csv.split('\r\n')[1].startsWith('2026-10-02,Supermercado,')).toBe(true);
});

it('SHOULD label a system category with its localized name', async () => {
  mocks.transactionRepository.findTransactionsForExport.mockResolvedValueOnce([
    {
      ...mocks.transactions.user,
      category: {
        ...mocks.transactions.user.category,
        name: 'Balance adjustment',
        systemKey: SystemCategoryKey.BALANCE_ADJUSTMENT,
      },
    },
  ]);

  const { csv } = await setup.execute({ ...base, accessibleOwners: mocks.accessibleOwners });

  expect(csv).toContain(';Ajuste de saldo;');
});

it('SHOULD ask the repository for every owner, archived families included, and resolve card paid status', async () => {
  await setup.execute({ ...base, accessibleOwners: mocks.accessibleOwners });

  expect(mocks.transactionRepository.findTransactionsForExport).toHaveBeenCalledWith({
    accountIds: undefined,
    creditCardIds: undefined,
    from: '2026-01-01',
    owners: mocks.accessibleOwners,
    to: '2026-12-31',
  });
  expect(mocks.resolvePaid.execute).toHaveBeenCalledWith(
    expect.objectContaining({ today: '2026-10-21' }),
  );
});

it('SHOULD write only the header WHEN no owner is reachable', async () => {
  const { csv } = await setup.execute({
    ...base,
    accessibleOwners: mocks.accessibleOwners,
    owner: 'FAMILY',
    ownerId: 'stranger',
  });

  expect(mocks.transactionRepository.findTransactionsForExport).not.toHaveBeenCalled();
  expect(csv.split('\r\n').filter(Boolean)).toHaveLength(1);
});

it('SHOULD keep a description with the separator and a quote intact through quoting', async () => {
  mocks.transactionRepository.findTransactionsForExport.mockResolvedValueOnce([
    { ...mocks.transactions.user, description: 'Mercado; "Bom Preço"' },
  ]);

  const { csv } = await setup.execute({ ...base, accessibleOwners: mocks.accessibleOwners });

  expect(csv).toContain('"Mercado; ""Bom Preço"""');
});

it('SHOULD quote notes with separator, quotes and line breaks as ONE cell (spec 059 FR 17)', async () => {
  mocks.transactionRepository.findTransactionsForExport.mockResolvedValueOnce([
    { ...mocks.transactions.user, notes: 'Rota; "ida", volta\r\nTerminal 2' },
  ]);

  const { csv } = await setup.execute({ ...base, accessibleOwners: mocks.accessibleOwners });

  expect(csv.endsWith(';"Rota; ""ida"", volta\r\nTerminal 2"\r\n')).toBe(true);
});
