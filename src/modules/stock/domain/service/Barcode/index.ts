const CODE_REGEX = /^[0-9A-Za-z]{1,64}$/;
const GTIN_LENGTHS = new Set([13, 14, 8]);

// Spec 121 FR 1: GTIN check digit over the digits before the last one, weights 3/1 from the right.
export function isValidGtin(digits: string): boolean {
  const body = digits.slice(0, -1);
  const sum = [...body]
    .reverse()
    .reduce((total, char, index) => total + Number(char) * (index % 2 === 0 ? 3 : 1), 0);

  return (10 - (sum % 10)) % 10 === Number(digits.slice(-1));
}

// UPC-E (8 digits starting with 0/1) expanded to the 12-digit UPC-A, check digit kept.
export function expandUpcE(code: string): string {
  const [system, d1, d2, d3, d4, d5, d6] = [...code];
  const check = code[7];
  let body: string;

  if (d6 === '0' || d6 === '1' || d6 === '2') {
    body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  } else if (d6 === '3') {
    body = `${d1}${d2}${d3}00000${d4}${d5}`;
  } else if (d6 === '4') {
    body = `${d1}${d2}${d3}${d4}00000${d5}`;
  } else {
    body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }

  return `${system}${body}${check}`;
}

// The stored form of a typed or scanned code, or `undefined` when it is not a valid code (FR 1).
export function normalizeBarcode(raw: string): string | undefined {
  const code = raw.trim().replace(/[\s-]/g, '');

  if (!CODE_REGEX.test(code)) {
    return undefined;
  }

  if (!/^\d+$/.test(code)) {
    return code.toUpperCase();
  }

  const padded = code.length === 12 ? `0${code}` : code;

  if (GTIN_LENGTHS.has(padded.length) && !isValidGtin(padded)) {
    return undefined;
  }

  return padded;
}
