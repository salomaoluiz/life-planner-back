const SCALE = 8;
const FACTOR = 10n ** BigInt(SCALE);
const DECIMAL_PATTERN = /^\d+(\.\d{1,8})?$/;

// Exact decimal with 8 places over a scaled bigint: quantities and unit prices never touch floats (spec 102).
export class Decimal8 {
  private constructor(readonly scaled: bigint) {}

  compare(other: Decimal8): -1 | 0 | 1 {
    if (this.scaled === other.scaled) {
      return 0;
    }

    return this.scaled < other.scaled ? -1 : 1;
  }

  static fromScaled(scaled: bigint): Decimal8 {
    return new Decimal8(scaled);
  }

  isPositive(): boolean {
    return this.scaled > 0n;
  }

  isZero(): boolean {
    return this.scaled === 0n;
  }

  minus(other: Decimal8): Decimal8 {
    return new Decimal8(this.scaled - other.scaled);
  }

  static parse(value: string): Decimal8 {
    const text = value.trim();

    if (!DECIMAL_PATTERN.test(text)) {
      throw new Error(`Invalid decimal: ${value}`);
    }

    const [integer, fraction = ''] = text.split('.');

    return new Decimal8(BigInt(integer) * FACTOR + BigInt(fraction.padEnd(SCALE, '0')));
  }

  static zero(): Decimal8 {
    return new Decimal8(0n);
  }

  // round_half_up(this × other × 100): the total in cents of `quantity × unitPrice`.
  mulToCents(other: Decimal8): number {
    return Number(roundDiv(this.scaled * other.scaled, 10n ** 14n));
  }

  plus(other: Decimal8): Decimal8 {
    return new Decimal8(this.scaled + other.scaled);
  }

  // Shortest form: "1200", "18.3572".
  toFixed8(): string {
    const negative = this.scaled < 0n;
    const absolute = negative ? -this.scaled : this.scaled;
    const integer = absolute / FACTOR;
    const fraction = (absolute % FACTOR).toString().padStart(SCALE, '0');

    return `${negative ? '-' : ''}${integer}.${fraction}`;
  }

  toString(): string {
    const text = this.toFixed8();

    return text.replace(/\.?0+$/, '');
  }
}

// Integer division rounding half up for non-negative values.
export function roundDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}
