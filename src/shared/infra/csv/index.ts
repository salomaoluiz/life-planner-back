const BOM = String.fromCharCode(0xfeff);
const FORMULA_START = /^[=+\-@]/;

export type CsvSeparator = ',' | ';';

// Spec 047 FR 6: a text cell starting with a formula character is prefixed with `'`.
export function guardFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

// RFC 4180: UTF-8 BOM, CRLF line endings, a cell is quoted when it holds the separator, a quote or a line break.
export function writeCsv(rows: string[][], options: { separator: CsvSeparator }): string {
  const lines = rows.map((row) =>
    row.map((cell) => quote(guardFormula(cell), options.separator)).join(options.separator),
  );

  return `${BOM}${lines.join('\r\n')}\r\n`;
}

function quote(value: string, separator: CsvSeparator): string {
  if (value.includes(separator) || /["\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
