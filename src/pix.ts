// Pix estático no padrão BR Code do Banco Central (EMV QRCPS). Sem valor (campo 54),
// quem paga digita quanto quer dar; com valor, o app já abre preenchido.

export const PIX_KEY = 'a03c9d97-08cf-48c3-aeff-a6b78b67f415';

const field = (id: string, value: string) => id + String(value.length).padStart(2, '0') + value;

/** CRC16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Payload "Pix Copia e Cola". Nome e cidade são exibidos pelo app, mas o banco usa os dados da chave. */
export function pixPayload(key: string, name: string, city: string, amount?: number, txid = '***'): string {
  const body =
    field('00', '01') +
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key)) +
    field('52', '0000') +
    field('53', '986') +
    (amount ? field('54', amount.toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', name.slice(0, 25)) +
    field('60', city.slice(0, 15)) +
    field('62', field('05', txid)) +
    '6304';
  return body + crc16(body);
}
