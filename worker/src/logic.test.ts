import { describe, expect, it } from 'vitest';
import { ageSeconds, backoffSeconds, cacheKey, corsHeaders, failKey, isJson, staleKey, upstreamUrl } from './logic';

const P = '/oficial/ele2026';
const TSE = 'https://resultados.tse.jus.br';

describe('upstreamUrl', () => {
  it('aceita br, UF e município nas duas eleições', () => {
    for (const p of [
      `${P}/6257/dados/br/br-c0001-e006257-u.json`,
      `${P}/6258/dados/br/br-c0001-e006258-u.json`,
      `${P}/6257/dados/sp/sp-c0001-e006257-u.json`,
      `${P}/6258/dados/rj/rj60011-c0001-e006258-u.json`,
    ]) expect(upstreamUrl(p)).toBe(TSE + p);
  });

  it('recusa eleição ou UF divergentes', () => {
    expect(upstreamUrl(`${P}/6257/dados/br/br-c0001-e006258-u.json`)).toBeNull();
    expect(upstreamUrl(`${P}/6258/dados/sp/rj-c0001-e006258-u.json`)).toBeNull();
    expect(upstreamUrl(`${P}/6259/dados/br/br-c0001-e006259-u.json`)).toBeNull();
  });

  it('recusa traversal, fotos, config e outros caminhos', () => {
    for (const p of [
      `${P}/6257/dados/br/../br-c0001-e006257-u.json`,
      `${P}/6257/dados/br/%2e%2e/br-c0001-e006257-u.json`,
      `${P}/6257/dados/sp/sp1234-c0001-e006257-u.json`,
      `${P}/6257/dados/sp/sp123456-c0001-e006257-u.json`,
      `${P}/6257/dados/SP/SP-c0001-e006257-u.json`,
      `${P}/6257/dados/br/br-c0001-e006257-u.json.bak`,
      `${P}/6257/dados/br/br-c0001-e006257-u.json/x`,
      `${P}/6257/fotos/br/280001234.jpeg`,
      `${P}/6257/config/br/br-e006257-i.json`,
      `/comum/config/ele-c.json`,
      `//evil.com${P}/6257/dados/br/br-c0001-e006257-u.json`,
      `/https://evil.com/x.json`,
      '/',
      '',
    ]) expect(upstreamUrl(p), p).toBeNull();
  });

  it('pathname vindo de new URL já normaliza ../ para fora do padrão', () => {
    const path = new URL(`https://tse.urnakombat.com.br${P}/6257/dados/br/../../../x/br-c0001-e006257-u.json`).pathname;
    expect(upstreamUrl(path)).toBeNull();
  });
});

describe('corsHeaders', () => {
  it('ecoa origens permitidas', () => {
    for (const o of ['https://urnakombat.com.br', 'http://localhost:5173', 'http://localhost', 'http://127.0.0.1:4174']) {
      expect(corsHeaders(o)['Access-Control-Allow-Origin']).toBe(o);
    }
  });

  it('não envia ACAO para outras origens, mas mantém Vary e Expose', () => {
    for (const o of [
      null, '', 'https://evil.com', 'http://urnakombat.com.br', 'https://urnakombat.com.br.evil.com',
      'https://www.urnakombat.com.br', 'https://localhost:5173', 'http://localhost.evil.com', 'null',
    ]) {
      const h = corsHeaders(o);
      expect(h['Access-Control-Allow-Origin'], String(o)).toBeUndefined();
      expect(h.Vary).toBe('Origin');
      expect(h['Access-Control-Expose-Headers']).toBe('X-Proxy-Cache, X-Proxy-Age, X-Proxy-Error, Retry-After');
    }
  });
});

describe('chaves de cache', () => {
  const url = `${TSE}${P}/6257/dados/br/br-c0001-e006257-u.json`;
  it('ignora query e hash', () => {
    expect(cacheKey(url + '?t=123&x=1')).toBe(url);
    expect(cacheKey(url + '#a')).toBe(url);
    expect(cacheKey(url)).toBe(url);
  });
  it('stale é separada da fresca e também ignora query', () => {
    expect(staleKey(url + '?t=1')).toBe(staleKey(url));
    expect(staleKey(url)).not.toBe(cacheKey(url));
  });
  it('marca de falha é separada das outras', () => {
    expect(failKey(url + '?t=1')).toBe(failKey(url));
    expect(failKey(url)).not.toBe(cacheKey(url));
    expect(failKey(url)).not.toBe(staleKey(url));
  });
});

describe('utilitários', () => {
  it('isJson rejeita HTML', () => {
    expect(isJson('{"a":1}')).toBe(true);
    expect(isJson('<html>429</html>')).toBe(false);
    expect(isJson('')).toBe(false);
  });
  it('ageSeconds', () => {
    expect(ageSeconds('1000', 31_500)).toBe(30);
    expect(ageSeconds(null)).toBe(0);
    expect(ageSeconds('lixo')).toBe(0);
    expect(ageSeconds('5000', 1000)).toBe(0);
  });
});

describe('backoffSeconds', () => {
  it('5xx, 404 e rede: FRESH_S', () => {
    expect(backoffSeconds(502, null)).toBe(15);
    expect(backoffSeconds(503, '120')).toBe(15);
    expect(backoffSeconds(404, null)).toBe(15);
  });
  it('429 respeita Retry-After entre 15 e 300 s', () => {
    expect(backoffSeconds(429, null)).toBe(15);
    expect(backoffSeconds(429, '5')).toBe(15);
    expect(backoffSeconds(429, '90')).toBe(90);
    expect(backoffSeconds(429, '3600')).toBe(300);
    expect(backoffSeconds(429, 'lixo')).toBe(15);
    const now = Date.parse('2026-10-25T20:00:00Z');
    expect(backoffSeconds(429, 'Sun, 25 Oct 2026 20:01:00 GMT', now)).toBe(60);
  });
});
