/* ============================================================
   SONDAS ESPACIALES
   Las naves ya no siguen órbitas keplerianas: los sobrevuelos
   planetarias las lanzaron a trayectorias hiperbólicas. Así que
   en vez de elementos orbitales se guardan posiciones reales
   muestreadas del JPL Horizons a paso uniforme, y se interpolan
   con Catmull-Rom (pasa por los puntos y da curvas suaves en los
   virajes de asistencia gravitatoria).
   ============================================================ */

const SONDAS = [
  { id:'voyager1', nombre:'Voyager 1', tipo:'Sonda interestelar',
    lanzamiento:'1977-09-05', color:0xa8e0ff,
    nota:'El objeto humano más lejano. Cruzó la heliopausa en 2012 y ya vuela por el medio interestelar. Lleva el Disco de Oro con sonidos e imágenes de la Tierra.' },
  { id:'voyager2', nombre:'Voyager 2', tipo:'Sonda interestelar',
    lanzamiento:'1977-08-20', color:0x9fd4f0,
    nota:'La única nave que ha visitado los cuatro planetas exteriores. Sigue siendo la única que ha visto Urano y Neptuno de cerca.' },
  { id:'newhorizons', nombre:'New Horizons', tipo:'Sonda al cinturón de Kuiper',
    lanzamiento:'2006-01-19', color:0xc8dcc0,
    nota:'Nos dio las primeras fotos de Plutón en 2015. Después sobrevoló Arrokoth, el objeto más lejano jamás visitado de cerca.' },
  { id:'parker', nombre:'Parker Solar Probe', tipo:'Sonda solar',
    lanzamiento:'2018-08-12', color:0xffcf8a,
    nota:'El objeto humano más rápido: roza la corona del Sol a 690 000 km/h, dentro de la atmósfera solar.' }
];

/* decodifica y prepara la tabla de cada sonda */
function b64f32(str){
  const bin = atob(str), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Float32Array(u.buffer);
}
for (const s of SONDAS){
  const d = SONDASDATA[s.id];
  s.jd0 = d.jd0; s.paso = d.paso; s.n = d.n;
  s.xyz = b64f32(d.xyz);
  s.jdFin = d.jd0 + d.paso * (d.n - 1);
}

function catmull(p0, p1, p2, p3, t){
  const t2 = t*t, t3 = t2*t;
  return 0.5 * (2*p1 + (-p0 + p2)*t + (2*p0 - 5*p1 + 4*p2 - p3)*t2 + (-p0 + 3*p1 - 3*p2 + p3)*t3);
}

/* Posición heliocéntrica de una sonda (km, eclíptica J2000).
   Devuelve false antes del lanzamiento.                          */
function sondaPos(s, jd, out){
  if (jd < s.jd0) return false;
  const a = s.xyz;
  if (jd > s.jdFin){
    // más allá de la tabla: sigue recto con la última velocidad conocida
    const i = s.n - 1, j = s.n - 2;
    const dt = (jd - s.jdFin) / s.paso;
    for (let k = 0; k < 3; k++){
      const v = a[i*3+k] - a[j*3+k];
      out[k] = a[i*3+k] + v * dt;
    }
    return true;
  }
  const u = (jd - s.jd0) / s.paso;
  const i = Math.min(s.n - 2, Math.max(0, Math.floor(u)));
  const t = u - i;
  const i0 = Math.max(0, i - 1), i1 = i, i2 = i + 1, i3 = Math.min(s.n - 1, i + 2);
  for (let k = 0; k < 3; k++){
    out[k] = catmull(a[i0*3+k], a[i1*3+k], a[i2*3+k], a[i3*3+k], t);
  }
  return true;
}

/* Velocidad instantánea en km/s por diferencias centradas */
function sondaVel(s, jd){
  const p1 = [0,0,0], p2 = [0,0,0];
  const h = 0.5;                                   // medio día
  if (!sondaPos(s, jd - h, p1) || !sondaPos(s, jd + h, p2)) return 0;
  return Math.hypot(p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]) / (2 * h * 86400);
}
