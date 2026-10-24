import { describe, expect, it } from 'vitest';
import { PIX_KEY, pixPayload } from './pix';

describe('pixPayload', () => {
  it('reproduz o exemplo do manual do BR Code do Banco Central', () => {
    expect(pixPayload('123e4567-e12b-12d1-a456-426655440000', 'Fulano de Tal', 'BRASILIA')).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    );
  });

  it('inclui a chave do projeto', () => {
    const p = pixPayload(PIX_KEY, 'APURACAO KOMBAT', 'BRASILIA');
    expect(p).toContain(PIX_KEY);
    expect(p).toMatch(/6304[0-9A-F]{4}$/);
  });
});
