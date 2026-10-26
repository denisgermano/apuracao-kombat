import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchResult, photoUrl, proxyBase, resetProxy, resultUrl, TseSource, throttled } from './tse';

const PROXY = 'https://tse.urnakombat.com.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json';
const DIRECT = 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json';

const raw = {
  idg: '1', dg: '25/10/2026', hg: '20:00:00', tf: 'n',
  s: { pstn: '50,0' }, e: { te: '100', esnt: '50' }, v: { vv: '40' },
  carg: [{ agr: [{ par: [{ cand: [
    { n: 13, nm: 'A', sqcand: '1', seq: '1', vap: '21', pvapn: '52,5', st: '' },
    { n: 22, nm: 'B', sqcand: '2', seq: '2', vap: '19', pvapn: '47,5', st: '' },
  ] }] }] }],
};
const json = (status = 200, headers: Record<string, string> = {}) =>
  new Response(status === 200 ? JSON.stringify(raw) : '{}', { status, headers });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetProxy();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const urls = () => fetchMock.mock.calls.map((c) => c[0]);

describe('URLs', () => {
  it('dados vão pelo proxy, fotos direto no TSE', () => {
    expect(resultUrl('6258')).toBe(PROXY);
    expect(resultUrl('6257', 'sp')).toBe('https://tse.urnakombat.com.br/oficial/ele2026/6257/dados/sp/sp-c0001-e006257-u.json');
    expect(photoUrl('6258', '123')).toBe('https://resultados.tse.jus.br/oficial/ele2026/6258/fotos/br/123.jpeg');
  });

  it('VITE_TSE_PROXY sobrescreve; vazio desliga', () => {
    vi.stubEnv('VITE_TSE_PROXY', 'http://localhost:8787/oficial/ele2026/');
    expect(proxyBase()).toBe('http://localhost:8787/oficial/ele2026');
    expect(resultUrl('6258')).toBe('http://localhost:8787/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json');
    vi.stubEnv('VITE_TSE_PROXY', '');
    expect(resultUrl('6258')).toBe(DIRECT);
  });
});

describe('fetchResult', () => {
  it('proxy ok: cache padrão, sem ir ao TSE', async () => {
    fetchMock.mockResolvedValueOnce(json());
    const res = await fetchResult('6258');
    expect(res.status).toBe(200);
    expect(urls()).toEqual([PROXY]);
    expect(fetchMock.mock.calls[0][1].cache).toBeUndefined();
  });

  it('proxy desligado: direto com no-cache', async () => {
    vi.stubEnv('VITE_TSE_PROXY', '');
    fetchMock.mockResolvedValueOnce(json());
    await fetchResult('6258');
    expect(urls()).toEqual([DIRECT]);
    expect(fetchMock.mock.calls[0][1].cache).toBe('no-cache');
  });

  it.each([
    [502, {}],
    [404, { 'X-Proxy-Error': 'route' }],
  ])('proxy %i (falha do próprio proxy): repete direto no TSE', async (status, headers) => {
    fetchMock.mockResolvedValueOnce(json(status, headers)).mockResolvedValueOnce(json());
    const res = await fetchResult('6258');
    expect(res.status).toBe(200);
    expect(urls()).toEqual([PROXY, DIRECT]);
    expect(fetchMock.mock.calls[1][1].cache).toBe('no-cache');
  });

  it.each([404, 502, 503])('%i do TSE via proxy: volta como está, sem ir direto nem contar falha', async (status) => {
    fetchMock.mockResolvedValue(json(status, { 'X-Proxy-Error': 'upstream' }));
    for (let i = 0; i < 5; i++) expect((await fetchResult('6258')).status).toBe(status);
    expect(urls()).toEqual(Array(5).fill(PROXY));
  });

  it('erro de rede no proxy: repete direto no TSE', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(json());
    expect((await fetchResult('6258')).status).toBe(200);
    expect(urls()).toEqual([PROXY, DIRECT]);
  });

  it('429 do proxy não cai para o TSE', async () => {
    fetchMock.mockResolvedValueOnce(json(429, { 'retry-after': '90' }));
    const res = await fetchResult('6258');
    expect(res.status).toBe(429);
    expect(urls()).toEqual([PROXY]);
  });

  it('3 falhas seguidas: 10 min direto, depois volta ao proxy', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (url: string) => (url.startsWith('https://tse.') ? json(503) : json()));
    for (let i = 0; i < 3; i++) await fetchResult('6258');
    expect(urls()).toEqual([PROXY, DIRECT, PROXY, DIRECT, PROXY, DIRECT]);

    fetchMock.mockClear();
    await fetchResult('6258');
    expect(urls()).toEqual([DIRECT]);

    vi.advanceTimersByTime(10 * 60_000);
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(json());
    await fetchResult('6258');
    expect(urls()).toEqual([PROXY]);
  });

  it('sucesso no proxy zera a contagem de falhas', async () => {
    fetchMock
      .mockResolvedValueOnce(json(500)).mockResolvedValueOnce(json())
      .mockResolvedValueOnce(json(500)).mockResolvedValueOnce(json())
      .mockResolvedValueOnce(json())
      .mockResolvedValueOnce(json(500)).mockResolvedValueOnce(json())
      .mockResolvedValueOnce(json());
    for (let i = 0; i < 5; i++) await fetchResult('6258');
    expect(urls().at(-1)).toBe(PROXY);
  });
});

describe('TseSource', () => {
  it('429 do proxy entra no backoff (busy), sem bater no TSE', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(json(429, { 'retry-after': '120' }));
    const status = vi.fn();
    new TseSource('6258', () => {}, status).start();
    await vi.advanceTimersByTimeAsync(0);
    expect(urls()).toEqual([PROXY]);
    expect(status).toHaveBeenCalledWith(expect.objectContaining({ kind: 'busy' }));
    expect(throttled()).toBe(true);
  });
});
