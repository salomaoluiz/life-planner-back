import { defaultCategoryNames, defaultLocationNames } from './index';

it('SHOULD list the nine category and five location defaults per language', () => {
  expect(defaultCategoryNames('pt-BR')).toHaveLength(9);
  expect(defaultCategoryNames('pt-BR')[0]).toBe('Mercearia');
  expect(defaultCategoryNames('en-US')[8]).toBe('Home/Tools');
  expect(defaultLocationNames('pt-BR')).toEqual([
    'Despensa',
    'Geladeira',
    'Freezer',
    'Área de serviço',
    'Garagem',
  ]);
  expect(defaultLocationNames('en-US')).toContain('Laundry');
});
