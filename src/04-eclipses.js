/* ============================================================
   ECLIPSES — búsqueda por sicigias y clasificación por geometría
   de conos de sombra (sin constantes mágicas).
   ============================================================ */

const R_SOL = 695700, R_TIERRA = 6371.0084, R_LUNA = 1737.4;

/* Longitud eclíptica J2000 de un vector */
function lonDe(v){ let l = Math.atan2(v[1], v[0]); return l < 0 ? l + 2*Math.PI : l; }

const _pt = [0,0,0], _pl = [0,0,0];

/* Elongación Luna-Sol vista desde la Tierra, en grados [0, 360) */
function elongacion(jd){
  planetPos('tierra', jd, _pt);
  lunaGeo(jd, _pl);
  const lSol = lonDe([-_pt[0], -_pt[1], -_pt[2]]);
  const lLuna = lonDe(_pl);
  let e = (lLuna - lSol) * 180/Math.PI;
  return e < 0 ? e + 360 : e;
}

/* Refina el instante en que la elongación cruza `objetivo` (0 o 180) */
function refinaSicigia(jd0, jd1, objetivo){
  const f = jd => {
    let d = elongacion(jd) - objetivo;
    if (d > 180) d -= 360; if (d < -180) d += 360;
    return d;
  };
  let a = jd0, b = jd1, fa = f(a);
  for (let k = 0; k < 40; k++){
    const m = (a + b) / 2, fm = f(m);
    if (fa * fm <= 0){ b = m; } else { a = m; fa = fm; }
  }
  return (a + b) / 2;
}

/* Distancia de un punto P al eje (recta por A con dirección u) */
function distEje(P, A, u){
  const dx = P[0]-A[0], dy = P[1]-A[1], dz = P[2]-A[2];
  const t = dx*u[0] + dy*u[1] + dz*u[2];
  const px = dx - t*u[0], py = dy - t*u[1], pz = dz - t*u[2];
  return { d: Math.hypot(px, py, pz), t };
}

/* Clasifica un eclipse solar en la luna nueva jd. null si no hay. */
function clasificaSolar(jd){
  planetPos('tierra', jd, _pt); lunaGeo(jd, _pl);
  const M = [_pt[0]+_pl[0], _pt[1]+_pl[1], _pt[2]+_pl[2]];   // Luna heliocéntrica
  const dSM = Math.hypot(M[0], M[1], M[2]);
  const u = [M[0]/dSM, M[1]/dSM, M[2]/dSM];                  // eje Sol→Luna
  const { d, t } = distEje(_pt, M, u);                        // Tierra respecto al eje
  if (t < 0) return null;
  // radios de sombra en el plano de la Tierra (t km más allá de la Luna)
  const rPen = R_LUNA + t * (R_SOL + R_LUNA) / dSM;           // penumbra crece
  const rUmb = R_LUNA - t * (R_SOL - R_LUNA) / dSM;           // umbra se cierra
  if (d > R_TIERRA + rPen) return null;
  let tipo;
  if (d < R_TIERRA + Math.abs(rUmb)) tipo = rUmb > 0 ? 'total' : 'anular';
  else tipo = 'parcial';
  return { clase: 'solar', tipo, jd, gamma: +(d/R_TIERRA).toFixed(3) };
}

/* Clasifica un eclipse lunar en la luna llena jd. null si no hay. */
function clasificaLunar(jd){
  planetPos('tierra', jd, _pt); lunaGeo(jd, _pl);
  const dSE = Math.hypot(_pt[0], _pt[1], _pt[2]);
  const u = [_pt[0]/dSE, _pt[1]/dSE, _pt[2]/dSE];             // eje antisolar
  const dm = _pl[0]*u[0] + _pl[1]*u[1] + _pl[2]*u[2];         // avance de la Luna por el eje
  if (dm < 0) return null;
  const px = _pl[0]-dm*u[0], py = _pl[1]-dm*u[1], pz = _pl[2]-dm*u[2];
  const d = Math.hypot(px, py, pz);
  // 2 % extra por la atmósfera terrestre (convención clásica)
  const rUmb = (R_TIERRA - dm * (R_SOL - R_TIERRA) / dSE) * 1.02;
  const rPen = (R_TIERRA + dm * (R_SOL + R_TIERRA) / dSE) * 1.02;
  if (d > rPen + R_LUNA) return null;
  let tipo;
  if (d < rUmb - R_LUNA) tipo = 'total';
  else if (d < rUmb + R_LUNA) tipo = 'parcial';
  else tipo = 'penumbral';
  return { clase: 'lunar', tipo, jd };
}

/* Distancia del centro de la Tierra al eje de sombra de la Luna (km) */
function distEjeSolar(jd){
  planetPos('tierra', jd, _pt); lunaGeo(jd, _pl);
  const M = [_pt[0]+_pl[0], _pt[1]+_pl[1], _pt[2]+_pl[2]];
  const dSM = Math.hypot(M[0], M[1], M[2]);
  const u = [M[0]/dSM, M[1]/dSM, M[2]/dSM];
  // vector Luna -> centro de la Tierra
  const w = [-_pl[0], -_pl[1], -_pl[2]];
  const t = w[0]*u[0] + w[1]*u[1] + w[2]*u[2];
  return Math.hypot(w[0]-t*u[0], w[1]-t*u[1], w[2]-t*u[2]);
}

/* Distancia de la Luna al eje de la sombra de la Tierra (km) */
function distEjeLunar(jd){
  planetPos('tierra', jd, _pt); lunaGeo(jd, _pl);
  const dSE = Math.hypot(_pt[0], _pt[1], _pt[2]);
  const u = [_pt[0]/dSE, _pt[1]/dSE, _pt[2]/dSE];      // eje antisolar
  const t = _pl[0]*u[0] + _pl[1]*u[1] + _pl[2]*u[2];
  return Math.hypot(_pl[0]-t*u[0], _pl[1]-t*u[1], _pl[2]-t*u[2]);
}

/* Afina el instante de máximo minimizando la distancia al eje (búsqueda ternaria) */
function refinaMaximo(jd, f){
  let a = jd - 0.16, b = jd + 0.16;
  for (let k = 0; k < 60; k++){
    const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
    if (f(m1) < f(m2)) b = m2; else a = m1;
  }
  return (a + b) / 2;
}

/* Busca los próximos eclipses a partir de jd0 */
function buscarEclipses(jd0, cuantos){
  const res = [];
  let jd = jd0;
  const paso = 0.5;
  let ePrev = elongacion(jd);
  let guard = 0;
  while (res.length < cuantos && guard++ < 30000){
    const jd2 = jd + paso;
    const e2 = elongacion(jd2);
    // cruce de 0° (luna nueva)
    if (((ePrev > 330 && e2 < 30) || (ePrev < 30 && e2 < ePrev)) && ePrev > e2 - 360 + 720){}
    const cruza0 = (ePrev > 300 && e2 < 60);
    const cruza180 = (ePrev < 180 && e2 >= 180);
    if (cruza0){
      const t = refinaMaximo(refinaSicigia(jd, jd2, 0), distEjeSolar);
      const ec = clasificaSolar(t);
      if (ec) res.push(ec);
    }
    if (cruza180){
      const t = refinaMaximo(refinaSicigia(jd, jd2, 180), distEjeLunar);
      const ec = clasificaLunar(t);
      if (ec) res.push(ec);
    }
    ePrev = e2; jd = jd2;
  }
  return res;
}
