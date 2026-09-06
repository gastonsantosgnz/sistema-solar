/* ============================================================
   ICONOS DE LA PWA — dibujados por código, sin binarios en el
   repositorio. Un pequeño Saturno sobre el vacío, rasterizado
   con supermuestreo y codificado como PNG mínimo (RGBA + zlib).
   El contenido cabe en el círculo central (~74%) para que la
   versión "maskable" no lo recorte.
   ============================================================ */

import zlib from 'node:zlib';

/* --- PNG mínimo: firma + IHDR + IDAT + IEND, con CRC32 propio --- */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf){
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(tipo, datos){
  const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
}
function png(tam, rgba){
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0); ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; ihdr[9] = 6;                       // 8 bits por canal, RGBA
  const filas = Buffer.alloc((tam * 4 + 1) * tam);
  for (let y = 0; y < tam; y++){
    filas[y * (tam * 4 + 1)] = 0;                 // filtro: ninguno
    rgba.copy(filas, y * (tam * 4 + 1) + 1, y * tam * 4, (y + 1) * tam * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* --- el dibujo, muestreado por pixel --- */
const ESTRELLAS = [[0.16, 0.22], [0.82, 0.14], [0.76, 0.83], [0.13, 0.76], [0.9, 0.5], [0.28, 0.1]];

function muestra(x, y){
  // x, y en [-0.5, 0.5] respecto al centro del lienzo
  const rot = -0.42, cr = Math.cos(rot), sr = Math.sin(rot);
  const rx = x * cr - y * sr;
  const ry = (x * sr + y * cr) / 0.34;
  const rd = Math.hypot(rx, ry);
  const enAnillo = rd > 0.245 && rd < 0.375 && !(rd > 0.315 && rd < 0.328);
  const delante = (x * sr + y * cr) > 0;          // mitad del anillo que cruza por delante
  const d = Math.hypot(x, y);
  const enPlaneta = d < 0.205;

  if (enAnillo && (delante || !enPlaneta)){
    const k = 0.72 + 0.28 * Math.sin((rd - 0.245) / 0.13 * Math.PI);
    return [188 * k, 196 * k, 208 * k];
  }
  if (enPlaneta){
    const k = 0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - (d / 0.205) ** 2));
    const banda = 1 + 0.05 * Math.sin(y * 34);
    return [232 * k * banda, 177 * k * banda, 92 * k];
  }
  for (const [ex, ey] of ESTRELLAS){
    if (Math.hypot(x + 0.5 - ex, y + 0.5 - ey) < 0.007) return [214, 220, 230];
  }
  return [5, 6, 10];                              // --void
}

export function icono(tam){
  const SS = 3;                                   // supermuestreo 3×3
  const rgba = Buffer.alloc(tam * tam * 4);
  for (let py = 0; py < tam; py++){
    for (let px = 0; px < tam; px++){
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++){
        for (let sx = 0; sx < SS; sx++){
          const c = muestra(
            (px + (sx + 0.5) / SS) / tam - 0.5,
            (py + (sy + 0.5) / SS) / tam - 0.5
          );
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (py * tam + px) * 4;
      rgba[i] = r / (SS * SS); rgba[i + 1] = g / (SS * SS); rgba[i + 2] = b / (SS * SS);
      rgba[i + 3] = 255;
    }
  }
  return png(tam, rgba);
}
