import { describe, expect, it } from 'vitest';
import { PIX_KEY, crc16, pixPayload } from './pix';

describe('pixPayload', () => {
  it('reproduz o exemplo do manual do BR Code do Banco Central', () => {
    expect(pixPayload('123e4567-e12b-12d1-a456-426655440000', 'Fulano de Tal', 'BRASILIA')).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    );
  });

  it('inclui a chave do projeto', () => {
    const p = pixPayload(PIX_KEY, 'URNA KOMBAT', 'BRASILIA');
    expect(p).toContain(PIX_KEY);
    expect(p).toMatch(/6304[0-9A-F]{4}$/);
    expect(p).not.toContain('5404');
  });

  it('inclui o valor (campo 54) logo após a moeda', () => {
    const p = pixPayload(PIX_KEY, 'URNA KOMBAT', 'BRASILIA', 10);
    expect(p).toContain('530398654051' + '0.00');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
});
