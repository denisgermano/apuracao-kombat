import { describe, expect, it } from 'vitest';
import { DICTS, detectLang, LANGS, setLang, t, type Key } from './i18n';

describe('detectLang', () => {
  it('prioriza ?lang=, depois a escolha salva, depois o navegador', () => {
    expect(detectLang('es', 'en', ['pt-BR'])).toBe('es');
    expect(detectLang(null, 'en', ['pt-BR'])).toBe('en');
    expect(detectLang(null, null, ['pt-BR', 'en'])).toBe('pt');
  });

  it('reconhece variantes regionais e ignora valores inválidos', () => {
    expect(detectLang('xx', 'zz', ['es-AR'])).toBe('es');
    expect(detectLang(null, null, ['pt-PT'])).toBe('pt');
    expect(detectLang(null, null, ['en-GB'])).toBe('en');
  });

  it('cai para inglês quando o navegador não fala nenhum idioma suportado', () => {
    expect(detectLang(null, null, ['fr-FR', 'de'])).toBe('en');
    expect(detectLang(null, null, [])).toBe('en');
  });
});

describe('traduções', () => {
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('todos os idiomas usam os mesmos marcadores do português', () => {
    for (const key of Object.keys(DICTS.pt) as Key[]) {
      for (const lang of LANGS) {
        expect(vars(DICTS[lang][key]), `${lang}.${key}`).toEqual(vars(DICTS.pt[key]));
      }
    }
  });

  it('substitui os marcadores', () => {
    setLang('en');
    expect(t('votes', { n: '1,234' })).toBe('1,234 votes');
    setLang('pt');
    expect(t('sections', { p: '47,12' })).toBe('47,12% das seções');
  });
});
