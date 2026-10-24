// Pix estático no padrão BR Code do Banco Central (EMV QRCPS), sem valor fixo:
// quem paga escolhe quanto quer dar.

export const PIX_KEY = '7b482d38-89a8-44e2-94a8-26d3697ad2ac';

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
export function pixPayload(key: string, name: string, city: string, txid = '***'): string {
  const body =
    field('00', '01') +
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key)) +
    field('52', '0000') +
    field('53', '986') +
    field('58', 'BR') +
    field('59', name.slice(0, 25)) +
    field('60', city.slice(0, 15)) +
    field('62', field('05', txid)) +
    '6304';
  return body + crc16(body);
}
