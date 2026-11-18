import { defaultListName } from './index';

it('SHOULD name the list by language and fall back to pt-BR', () => {
  expect(defaultListName('en-US')).toBe('Groceries');
  expect(defaultListName('pt-BR')).toBe('Mercado');
  expect(defaultListName()).toBe('Mercado');
});
