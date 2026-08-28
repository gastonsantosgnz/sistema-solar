/* ============================================================
   CUERPOS MENORES — asteroides y cometas con elementos
   osculantes reales del JPL Small-Body Database.
   ============================================================ */

/* Elementos osculantes JPL SBDB (full-prec), consultados 2026-08-28 */
const MENORES = [
  { id:'ceres', nombre:'Ceres', tipo:'Planeta enano', clase:'dwarf', r:469.7, rot:0.37809,
    el:{ a:2.765552595, e:0.079692295, i:10.5880278, om:80.2486268, w:73.2942145, ma:274.4193464, ep:2461200.5 },
    nota:'El mayor objeto del cinturón: contiene un tercio de toda su masa. Tiene depósitos brillantes de sal en el cráter Occator.' },
  { id:'vesta', nombre:'Vesta', tipo:'Asteroide', clase:'ast', r:261.385, rot:0.22259,
    el:{ a:2.361365965, e:0.090203744, i:7.1439255, om:103.7012933, w:151.4686478, ma:81.1901561, ep:2461200.5 },
    nota:'El asteroide más brillante visto desde la Tierra. Muchos meteoritos que caen aquí son pedazos suyos, arrancados por un impacto antiguo.' },
  { id:'palas', nombre:'Palas', tipo:'Asteroide', clase:'ast', r:256.5, rot:0.32555,
    el:{ a:2.769559011, e:0.230700100, i:34.9327932, om:172.8866193, w:310.9699162, ma:254.2496522, ep:2461200.5 },
    nota:'Su órbita está inclinada 35°: sube y baja a través del plano del sistema como un carrusel.' },
  { id:'higia', nombre:'Higía', tipo:'Asteroide', clase:'ast', r:203.56, rot:0.57617,
    el:{ a:3.150974034, e:0.106709274, i:3.8295299, om:283.1198928, w:312.4242387, ma:252.0344242, ep:2461200.5 },
    nota:'El cuarto cuerpo más grande del cinturón, casi perfectamente esférico.' },
  { id:'eros', nombre:'Eros', tipo:'Asteroide cercano', clase:'ast', r:8.42, rot:0.21958,
    el:{ a:1.458243717, e:0.222877963, i:10.8285441, om:304.2679713, w:178.9181319, ma:62.5114550, ep:2461200.5 },
    nota:'El primer asteroide orbitado y aterrizado por una sonda (NEAR Shoemaker, 2001). Tiene forma de cacahuate de 34 km.' },
  { id:'apofis', nombre:'Apofis', tipo:'Asteroide cercano', clase:'ast', r:0.17, rot:1.27333,
    el:{ a:0.922359221, e:0.191149228, i:3.3409969, om:203.8936514, w:126.6795707, ma:175.3304027, ep:2461200.5 },
    nota:'El 13 de abril de 2029 pasará a 32 000 km de la Tierra, más cerca que los satélites geoestacionarios. Se verá a simple vista.' },
  { id:'halley', nombre:'1P/Halley', tipo:'Cometa', clase:'comet', r:5.5, rot:0.4,
    el:{ a:17.928635049, e:0.967935996, i:162.1905300, om:59.0989472, w:112.2414315, ma:274.3823371, ep:2439875.5 },
    nota:'El cometa de las crónicas: registrado desde el 240 a. C. Volverá al perihelio en julio de 2061.' },
  { id:'encke', nombre:'2P/Encke', tipo:'Cometa', clase:'comet', r:2.4, rot:0.46179,
    el:{ a:2.219671348, e:0.847503420, i:11.3868074, om:334.1498910, w:187.1740631, ma:256.1941744, ep:2459891.5 },
    nota:'El periodo más corto conocido: una vuelta al Sol cada 3.3 años. Sus restos causan la lluvia de las Táuridas.' },
  { id:'churyumov', nombre:'67P/Churyumov-Gerasimenko', tipo:'Cometa', clase:'comet', r:1.7, rot:0.53172,
    el:{ a:3.462249490, e:0.640908131, i:7.0402949, om:50.1355738, w:12.7982497, ma:8.8599274, ep:2457305.5 },
    nota:'La sonda Rosetta lo orbitó dos años y le posó el módulo Philae en 2014: el primer aterrizaje en un cometa.' },
  { id:'halebopp', nombre:'Hale-Bopp', tipo:'Cometa', clase:'comet', r:30.0, rot:0.4,
    el:{ a:177.433383912, e:0.994981003, i:89.2875942, om:282.7334214, w:130.4146671, ma:3.8783863, ep:2459837.5 },
    nota:'El gran cometa de 1997: visible a simple vista durante 18 meses. No volverá hasta el año ~4385.' },
];
/* estética por clase */
for (const m of MENORES){
  if (m.clase === 'comet'){ m.color = 0xbfd4e8; m.shader = 'ICEMOON'; }
  else if (m.id === 'vesta'){ m.color = 0xb5a583; m.shader = 'ROCK'; }
  else { m.color = 0x9a9186; m.shader = 'ROCK'; }
}

/* Posición heliocéntrica (km, eclíptica J2000) desde elementos osculantes */
function menorPos(el, jd, out){
  const n = 360 / (365.256898326 * Math.pow(el.a, 1.5));   // grados/día
  let M = el.ma + n * (jd - el.ep);
  M = norm360(M + 180) - 180;
  const E = solveKepler(M, el.e) * DEG;
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e*el.e) * Math.sin(E);
  const w = el.w * DEG, om = el.om * DEG, I = el.i * DEG;
  const cw = Math.cos(w), sw = Math.sin(w);
  const co = Math.cos(om), so = Math.sin(om);
  const ci = Math.cos(I), si = Math.sin(I);
  out[0] = ((cw*co - sw*so*ci)*xp + (-sw*co - cw*so*ci)*yp) * AU;
  out[1] = ((cw*so + sw*co*ci)*xp + (-sw*so + cw*co*ci)*yp) * AU;
  out[2] = ((sw*si)*xp + (cw*si)*yp) * AU;
  return out;
}

/* Elipse completa de un cuerpo menor (para la línea de órbita) */
function orbitPathEls(el, segments){
  const w = el.w * DEG, om = el.om * DEG, I = el.i * DEG;
  const cw = Math.cos(w), sw = Math.sin(w);
  const co = Math.cos(om), so = Math.sin(om);
  const ci = Math.cos(I), si = Math.sin(I);
  const pts = new Float32Array(segments * 3);
  for (let k = 0; k < segments; k++){
    // muestreo por anomalía excéntrica: concentra puntos en el perihelio
    const E = k / segments * Math.PI * 2;
    const xp = el.a * (Math.cos(E) - el.e);
    const yp = el.a * Math.sqrt(1 - el.e*el.e) * Math.sin(E);
    pts[k*3  ] = ((cw*co - sw*so*ci)*xp + (-sw*co - cw*so*ci)*yp) * AU;
    pts[k*3+1] = ((cw*so + sw*co*ci)*xp + (-sw*so + cw*co*ci)*yp) * AU;
    pts[k*3+2] = ((sw*si)*xp + (cw*si)*yp) * AU;
  }
  return pts;
}

/* Próximo paso por el perihelio (JD) */
function proximoPerihelio(el, jd){
  const P = 365.256898326 * Math.pow(el.a, 1.5);
  const n = 360 / P;
  const desde = el.ma * P / 360;              // días transcurridos desde el perihelio en la época
  let t = el.ep - desde;
  while (t < jd) t += P;
  return t;
}
