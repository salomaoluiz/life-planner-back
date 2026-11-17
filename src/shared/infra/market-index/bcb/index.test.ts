import axios from 'axios';

import { MarketIndexSourceError } from '../types';
import { BcbIndexes } from './index';
import { mocks } from './index.mocks';

jest.mock('axios');

const getSpy = jest.mocked(axios.get);

beforeEach(() => {
  jest.resetAllMocks();
});

describe('BcbIndexes.getSeries', () => {
  it('SHOULD parse dd/MM/yyyy dates AND keep the value string', async () => {
    getSpy.mockResolvedValueOnce({ data: mocks.sgs });

    const points = await new BcbIndexes().getSeries(12, '2026-11-11', '2026-11-12');

    expect(points).toEqual([
      { date: '2026-11-11', value: '0.050788' },
      { date: '2026-11-12', value: '0.050788' },
    ]);
    expect(getSpy.mock.calls[0][0]).toContain('bcdata.sgs.12');
    expect(getSpy.mock.calls[0][1]?.params).toMatchObject({
      dataFinal: '12/11/2026',
      dataInicial: '11/11/2026',
      formato: 'json',
    });
  });

  it('SHOULD split a range over ten years into windows AND join the points', async () => {
    getSpy.mockResolvedValue({ data: [{ data: '01/01/2000', valor: '1' }] });

    const points = await new BcbIndexes().getSeries(12, '2000-01-01', '2026-11-12');

    expect(getSpy).toHaveBeenCalledTimes(3);
    expect(getSpy.mock.calls.map((call) => call[1]?.params.dataInicial)).toEqual([
      '01/01/2000',
      '01/01/2010',
      '01/01/2020',
    ]);
    expect(getSpy.mock.calls[0][1]?.params.dataFinal).toBe('31/12/2009');
    expect(getSpy.mock.calls[2][1]?.params.dataFinal).toBe('12/11/2026');
    expect(points).toHaveLength(3);
  });

  it('SHOULD retry once WHEN the first call fails', async () => {
    getSpy
      .mockRejectedValueOnce({ code: 'ECONNABORTED' })
      .mockResolvedValueOnce({ data: mocks.sgs });

    expect(await new BcbIndexes().getSeries(12, '2026-11-11', '2026-11-12')).toHaveLength(2);
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('SHOULD throw HTTP_503 WHEN the source keeps answering 503', async () => {
    getSpy.mockRejectedValue({ response: { status: 503 } });

    await expect(new BcbIndexes().getSeries(12, '2026-11-11', '2026-11-12')).rejects.toEqual(
      new MarketIndexSourceError('HTTP_503'),
    );
  });

  it('SHOULD throw TIMEOUT WHEN the call times out twice', async () => {
    getSpy.mockRejectedValue({ code: 'ECONNABORTED' });

    await expect(new BcbIndexes().getSeries(12, '2026-11-11', '2026-11-12')).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('SHOULD skip rows with an unreadable date or value', async () => {
    getSpy.mockResolvedValueOnce({
      data: [{ data: 'bad', valor: '1' }, { data: '11/11/2026', valor: '' }, ...mocks.sgs],
    });

    expect(await new BcbIndexes().getSeries(12, '2026-11-11', '2026-11-12')).toHaveLength(2);
  });
});

describe('BcbIndexes.getIpcaExpectation', () => {
  it('SHOULD ask the Focus OData with %20 encoding AND map Data + Mediana', async () => {
    getSpy.mockResolvedValueOnce({ data: mocks.focus });

    const points = await new BcbIndexes().getIpcaExpectation('2026-11-01');

    expect(points).toEqual([
      { date: '2026-11-13', value: '5.1484' },
      { date: '2026-11-12', value: '5.1' },
    ]);

    const url = String(getSpy.mock.calls[0][0]);

    expect(url).toContain('ExpectativasMercadoInflacao12Meses');
    expect(url).toContain("Indicador%20eq%20'IPCA'");
    expect(url).toContain("Suavizada%20eq%20'S'");
    expect(url).toContain('baseCalculo%20eq%200');
    expect(url).toContain("Data%20ge%20'2026-11-01'");
  });
});
