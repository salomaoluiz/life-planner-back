import { setup } from './index.mocks';

const BOM = String.fromCharCode(0xfeff);

describe('writeCsv', () => {
  it('SHOULD start with the BOM and join rows with CRLF', () => {
    const csv = setup.writeCsv(
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
      { separator: ';' },
    );

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe(`${BOM}a;b\r\nc;d\r\n`);
  });

  it('SHOULD quote cells with the separator, a quote or a line break', () => {
    const csv = setup.writeCsv([['a;b', 'say "hi"', 'x\ny', 'a,b']], { separator: ';' });

    expect(csv).toBe(`${BOM}"a;b";"say ""hi""";"x\ny";a,b\r\n`);
  });

  it('SHOULD quote a comma when the separator is a comma', () => {
    expect(setup.writeCsv([['a,b', 'c']], { separator: ',' })).toBe(`${BOM}"a,b",c\r\n`);
  });

  it.each(['=SUM(A1)', '+1', '-x', '@a'])('SHOULD guard the formula start of %s', (value) => {
    expect(setup.guardFormula(value)).toBe(`'${value}`);
    expect(setup.writeCsv([[value]], { separator: ';' })).toBe(`${BOM}'${value}\r\n`);
  });

  it('SHOULD keep plain text and empty cells untouched', () => {
    expect(setup.writeCsv([['plain', '']], { separator: ';' })).toBe(`${BOM}plain;\r\n`);
  });
});
