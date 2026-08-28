/* ============================================================
   MECÁNICA ORBITAL
   ============================================================ */

// Fecha JS -> día juliano
function dateToJD(d){ return d.getTime() / 86400000 + 2440587.5; }
function jdToDate(jd){ return new Date((jd - 2440587.5) * 86400000); }

function norm360(x){ x = x % 360; return x < 0 ? x + 360 : x; }

// Resuelve la ecuación de Kepler M = E - e·sin(E) (M, E en grados)
function solveKepler(M, e){
  const eStar = 180 / Math.PI * e;
  let E = M + eStar * Math.sin(M * DEG);
  for (let i = 0; i < 12; i++){
    const dM = M - (E - eStar * Math.sin(E * DEG));
    const dE = dM / (1 - e * Math.cos(E * DEG));
    E += dE;
    if (Math.abs(dE) < 1e-9) break;
  }
  return E;
}

/* Posición heliocéntrica en el plano de la eclíptica J2000, en km.
   out = [x, y, z]                                                */
function planetPos(id, jd, out){
  const el = ELEM[id];
  const T = (jd - J2000) / 36525;
  const a  = el[0] + el[1] * T;
  const e  = el[2] + el[3] * T;
  const I  = (el[4] + el[5] * T) * DEG;
  const L  = el[6] + el[7] * T;
  const wp = el[8] + el[9] * T;      // longitud del perihelio
  const om = (el[10] + el[11] * T) * DEG;

  let M = L - wp;
  const ex = EXTRA[id];
  if (ex){
    M += ex[0] * T * T + ex[1] * Math.cos(ex[3] * DEG * T) + ex[2] * Math.sin(ex[3] * DEG * T);
  }
  M = norm360(M + 180) - 180;

  const E = solveKepler(M, e) * DEG;
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const w = wp * DEG - om;           // argumento del perihelio
  const cw = Math.cos(w), sw = Math.sin(w);
  const co = Math.cos(om), so = Math.sin(om);
  const ci = Math.cos(I),  si = Math.sin(I);

  out[0] = ((cw * co - sw * so * ci) * xp + (-sw * co - cw * so * ci) * yp) * AU;
  out[1] = ((cw * so + sw * co * ci) * xp + (-sw * so + cw * co * ci) * yp) * AU;
  out[2] = ((sw * si) * xp + (cw * si) * yp) * AU;
  return out;
}

/* Puntos de la elipse orbital completa (en km, marco eclíptico) */
function orbitPath(id, jd, segments){
  const el = ELEM[id];
  const T = (jd - J2000) / 36525;
  const a = el[0] + el[1] * T, e = el[2] + el[3] * T;
  const I = (el[4] + el[5] * T) * DEG;
  const wp = el[8] + el[9] * T, om = (el[10] + el[11] * T) * DEG;
  const w = wp * DEG - om;
  const cw = Math.cos(w), sw = Math.sin(w), co = Math.cos(om), so = Math.sin(om);
  const ci = Math.cos(I), si = Math.sin(I);
  const pts = new Float32Array(segments * 3);
  for (let k = 0; k < segments; k++){
    const E = k / segments * Math.PI * 2;
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    pts[k*3  ] = ((cw*co - sw*so*ci)*xp + (-sw*co - cw*so*ci)*yp) * AU;
    pts[k*3+1] = ((cw*so + sw*co*ci)*xp + (-sw*so + cw*co*ci)*yp) * AU;
    pts[k*3+2] = ((sw*si)*xp + (cw*si)*yp) * AU;
  }
  return pts;
}

/* Posición de una luna respecto a su planeta (km).
   Órbita circular inclinada respecto a la eclíptica.               */
function moonPos(m, jd, out){
  const n = 2 * Math.PI / m.per;              // rad/día (signo = sentido)
  const th = n * (jd - J2000);
  const i = m.inc * DEG;
  const x = m.a * Math.cos(th), y = m.a * Math.sin(th);
  out[0] = x;
  out[1] = y * Math.cos(i);
  out[2] = y * Math.sin(i);
  return out;
}

/* Velocidad orbital instantánea (km/s) por conservación de energía  */
function orbitalSpeed(id, rKm){
  const GM = 1.32712440018e11;                 // km^3/s^2 del Sol
  const a = ELEM[id][0] * AU;
  return Math.sqrt(GM * (2 / rKm - 1 / a));
}
