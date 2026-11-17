import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { IBcbIndexes, IndexPoint, toMarketIndexError } from '../types';

const SGS_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const FOCUS_URL =
  'https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoInflacao12Meses';
const TIMEOUT_MS = 15000;
// The SGS API refuses daily ranges over 10 years.
const WINDOW_YEARS = 10;

interface FocusResponse {
  value?: { Data?: string; Mediana?: number }[];
}
interface SgsRow {
  data?: string;
  valor?: string;
}

// `YYYY-MM-DD` -> `dd/MM/yyyy`.
function toSgsDate(date: string): string {
  const [year, month, day] = date.split('-');

  return `${day}/${month}/${year}`;
}
// `dd/MM/yyyy` -> `YYYY-MM-DD`, `null` when it is not a date.
function fromSgsDate(value: string | undefined): null | string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? '');

  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}
// Calendar windows of `WINDOW_YEARS` years: [from, from + 10y - 1d], ..., [.., to].
function windows(from: string, to: string): { from: string; to: string }[] {
  const result: { from: string; to: string }[] = [];
  let start = from;

  while (start <= to) {
    const next = `${Number(start.slice(0, 4)) + WINDOW_YEARS}${start.slice(4)}`;
    const end = new Date(`${next}T00:00:00.000Z`);

    end.setUTCDate(end.getUTCDate() - 1);

    const last = end.toISOString().slice(0, 10);

    result.push({ from: start, to: last < to ? last : to });
    start = next;
  }

  return result;
}

// Free public Central Bank APIs, no key (spec 113 FR 3): SGS series and the Focus expectations.
@Injectable()
export class BcbIndexes implements IBcbIndexes {
  async getIpcaExpectation(from: string): Promise<IndexPoint[]> {
    // OData is read with %20 (a `+` is rejected as part of the field name).
    const filter = encodeURI(
      `Indicador eq 'IPCA' and Suavizada eq 'S' and baseCalculo eq 0 and Data ge '${from}'`,
    );
    const url = `${FOCUS_URL}?$orderby=Data%20desc&$filter=${filter}&$format=json`;
    const data = await this.get<FocusResponse>(url);

    return (data.value ?? []).flatMap((row) =>
      row.Data && typeof row.Mediana === 'number'
        ? [{ date: row.Data, value: String(row.Mediana) }]
        : [],
    );
  }

  async getSeries(code: number, from: string, to: string): Promise<IndexPoint[]> {
    const points: IndexPoint[] = [];

    for (const window of windows(from, to)) {
      const rows = await this.get<SgsRow[]>(`${SGS_URL}.${code}/dados`, {
        dataFinal: toSgsDate(window.to),
        dataInicial: toSgsDate(window.from),
        formato: 'json',
      });

      for (const row of rows) {
        const date = fromSgsDate(row.data);

        if (
          date &&
          row.valor !== undefined &&
          row.valor !== '' &&
          Number.isFinite(Number(row.valor))
        ) {
          points.push({ date, value: row.valor });
        }
      }
    }

    return points;
  }

  // One retry, then the failure with its short code.
  private async get<T>(url: string, params?: Record<string, string>): Promise<T> {
    let failure: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { data } = await axios.get<T>(url, { params, timeout: TIMEOUT_MS });

        return data;
      } catch (error) {
        failure = error;
      }
    }

    throw toMarketIndexError(failure);
  }
}
