/* ============================================================
   LA GALAXIA Y EL CIELO PROFUNDO
   La Vía Láctea como objeto 3D — puntos procedurales y
   deterministas (cero datos, cero descarga) con posición real en
   km, en la escena-cielo y con su convención: el shader resta la
   posición de la cámara, así que paralaje y perspectiva salen
   solos. Poblaciones con color propio (bulbo con barra, disco
   viejo, brazos jóvenes con cúmulos y regiones HII, halo), bandas
   de polvo que restan luz, Andrómeda al fondo y ocho nebulosas
   reales en su sitio. Compuertas: generación perezosa, solo se
   dibuja lejos del Sol (crossfade con la banda pintada) y se
   recorta si los fps caen. Sin salir del sistema cuesta cero.
   ============================================================ */

const KPC = 1000 * PC;
const GAL_R_SOL = 8.2 * KPC;                            // el Sol, a 26 700 años luz del centro
const galPolo = sky.mwUni.uPole.value.clone();          // norte galáctico (marco eclíptico)
const galE1 = sky.mwUni.uCenter.value.clone().negate(); // del centro hacia el Sol, en el plano
galE1.addScaledVector(galPolo, -galE1.dot(galPolo)).normalize();
const galE2 = new THREE.Vector3().crossVectors(galPolo, galE1).normalize();
const GAL_CENTRO = sky.mwUni.uCenter.value.clone().multiplyScalar(GAL_R_SOL);

// Andrómeda (M31): 765 kpc, inclinada 77°, ángulo de posición 35°
const M31_DIR = eqToEcl(10.6847, 41.2687);
const M31_POS = M31_DIR.clone().multiplyScalar(765 * KPC);
const m31Eje = (() => {
  const n = eqToEcl(0, 90);
  n.addScaledVector(M31_DIR, -n.dot(M31_DIR)).normalize();
  return n.applyAxisAngle(M31_DIR, 35 * DEG);
})();
const m31Norm = M31_DIR.clone().applyAxisAngle(m31Eje, 77 * DEG);
const m31E2 = new THREE.Vector3().crossVectors(m31Norm, m31Eje).normalize();

const N_GAL = (matchMedia('(max-width: 720px)').matches || (navigator.hardwareConcurrency || 8) <= 4)
  ? 120000 : 240000;

/* ---------- generador ---------- */
const galTanP = Math.tan(12.5 * DEG), galR0 = 0.5 * KPC;
const galTh0 = Math.PI / 2 - Math.log(GAL_R_SOL / galR0) / galTanP;   // el Sol cae entre dos brazos
const brazoTh = (R, k) => galTh0 + k * Math.PI + Math.log(R / galR0) / galTanP;

function generarGalaxia(N, rnd, escala){
  const pos = new Float32Array(N * 3), col = new Uint8Array(N * 3);
  const lum = new Float32Array(N), tam = new Float32Array(N);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.2;
  const cb = Math.cos(27 * DEG), sb = Math.sin(27 * DEG);       // la barra, girada respecto al Sol
  // cúmulos: centros a lo largo de los brazos; ahí se apiñan las estrellas jóvenes
  const CUM = 900, cum = [];
  for (let i = 0; i < CUM; i++){
    const R = (1.8 + rnd() * 14) * KPC;
    const q = rnd(), k = q < 0.38 ? 0 : q < 0.76 ? 1 : q < 0.88 ? 0.5 : 1.5;
    const th = brazoTh(R, k) + gauss() * 0.05;
    cum.push([R * Math.cos(th), R * Math.sin(th), gauss() * 0.05 * KPC]);
  }
  for (let i = 0; i < N; i++){
    const u = rnd();
    let x, y, z, r, g, b, L, T;
    if (u < 0.11){                                         // bulbo con barra
      const rr = -Math.log(1 - rnd()) * 0.9 * KPC;
      const ct = rnd() * 2 - 1, st = Math.sqrt(1 - ct * ct), ph = rnd() * Math.PI * 2;
      let bx = rr * st * Math.cos(ph) * 1.6, by = rr * st * Math.sin(ph) * 0.75;
      x = bx * cb - by * sb; y = bx * sb + by * cb; z = rr * ct * 0.5;
      r = 255; g = 212; b = 158; L = 0.22; T = 2.6;
    } else if (u < 0.45){                                  // disco viejo, entre brazos
      let R = 0.3 * KPC - Math.log(1 - rnd()) * 3.4 * KPC;
      if (R > 21 * KPC) R = 21 * KPC * (0.6 + 0.4 * rnd());
      const th = rnd() * Math.PI * 2;
      x = R * Math.cos(th); y = R * Math.sin(th);
      z = gauss() * 0.2 * KPC * (1 + R / (18 * KPC));
      r = 238; g = 222; b = 194; L = 0.3; T = 2.7;
    } else if (u < 0.90){                                  // brazos: estrellas jóvenes y cúmulos
      if (rnd() < 0.4){
        const c = cum[Math.floor(rnd() * CUM)];
        x = c[0] + gauss() * 0.07 * KPC; y = c[1] + gauss() * 0.07 * KPC; z = c[2] + gauss() * 0.04 * KPC;
        if (rnd() < 0.14){ r = 255; g = 150; b = 178; L = 1.1; T = 3.4; }   // regiones HII
        else { r = 168; g = 190; b = 255; L = 0.6; T = 2.2; }
      } else {
        let R = 0.8 * KPC - Math.log(1 - rnd()) * 3.6 * KPC;
        if (R > 19 * KPC) R = 19 * KPC * (0.7 + 0.3 * rnd());
        const q = rnd(), k = q < 0.38 ? 0 : q < 0.76 ? 1 : q < 0.88 ? 0.5 : 1.5;
        const th = brazoTh(R, k) + gauss() * (0.12 + 0.14 * R / (20 * KPC));
        x = R * Math.cos(th); y = R * Math.sin(th);
        z = gauss() * 0.14 * KPC * (1 + R / (18 * KPC));
        r = 190; g = 205; b = 255; L = 0.5; T = 2.4;
      }
    } else if (u < 0.96){                                  // chispas: estrellas sueltas brillantes
      let R = 0.5 * KPC - Math.log(1 - rnd()) * 3.5 * KPC;
      const th = rnd() * Math.PI * 2;
      x = R * Math.cos(th); y = R * Math.sin(th); z = gauss() * 0.25 * KPC;
      r = 232; g = 236; b = 255; L = 0.9; T = 1.1;
    } else {                                               // halo
      const rr = 4 * KPC - Math.log(1 - rnd()) * 9 * KPC;
      const ct = rnd() * 2 - 1, st = Math.sqrt(1 - ct * ct), ph = rnd() * Math.PI * 2;
      x = rr * st * Math.cos(ph); y = rr * st * Math.sin(ph); z = rr * ct;
      r = 212; g = 202; b = 228; L = 0.16; T = 1.8;
    }
    pos[i*3] = x * escala; pos[i*3+1] = y * escala; pos[i*3+2] = z * escala;
    col[i*3] = r; col[i*3+1] = g; col[i*3+2] = b;
    lum[i] = L * (0.65 + 0.7 * rnd()); tam[i] = T * (0.8 + 0.4 * rnd());
  }
  return { pos, col, lum, tam };
}

/* polvo: bandas oscuras por el borde interior de los brazos, y parches sueltos */
function generarPolvo(N, rnd){
  const pos = new Float32Array(N * 3), tam = new Float32Array(N);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.2;
  for (let i = 0; i < N; i++){
    let x, y, z;
    if (rnd() < 0.75){
      const R = (1.5 + rnd() * 11.5) * KPC;
      const q = rnd(), k = q < 0.42 ? 0 : q < 0.84 ? 1 : q < 0.92 ? 0.5 : 1.5;
      const th = brazoTh(R, k) - 0.2 + gauss() * 0.06;
      x = R * Math.cos(th); y = R * Math.sin(th); z = gauss() * 0.06 * KPC;
    } else {
      const R = 1 * KPC - Math.log(1 - rnd()) * 4 * KPC, th = rnd() * Math.PI * 2;
      x = R * Math.cos(th); y = R * Math.sin(th); z = gauss() * 0.05 * KPC;
    }
    pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
    tam[i] = 5 + rnd() * 4;
  }
  return { pos, tam };
}

function montarPuntos(p, C, e1, e2, n){
  const a = p.pos;
  for (let i = 0; i < a.length; i += 3){
    const x = a[i], y = a[i+1], z = a[i+2];
    a[i]   = C.x + x * e1.x + y * e2.x + z * n.x;
    a[i+1] = C.y + x * e1.y + y * e2.y + z * n.y;
    a[i+2] = C.z + x * e1.z + y * e2.z + z * n.z;
  }
  return p;
}

/* ---------- shaders ---------- */
const GAL_VERT = `
attribute vec3 aCol; attribute float aLum, aTam;
uniform vec3 uCamKm; uniform float uPix, uGal, uMin, uRef2;
varying vec3 vCol; varying float vInt;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vec3 p = position - uCamKm;
  float d = max(length(p), uMin);
  vInt = clamp(uGal * aLum * uRef2 / (d * d), 0.0, 1.2);
  vCol = aCol;
  gl_PointSize = clamp(uPix * aTam * (0.8 + 0.6 * sqrt(vInt)), 1.0, 12.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(normalize(p) * 4.0, 1.0);
  #include <logdepthbuf_vertex>
}`;
const GAL_FRAG = `
varying vec3 vCol; varying float vInt;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.0) * (1.0 - r2);
  gl_FragColor = vec4(vCol * vInt, a);
  #include <logdepthbuf_fragment>
}`;
const POLVO_VERT = `
attribute float aTam;
uniform vec3 uCamKm; uniform float uPix;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vec3 p = position - uCamKm;
  gl_PointSize = clamp(uPix * aTam, 1.0, 14.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(normalize(p) * 4.0, 1.0);
  #include <logdepthbuf_vertex>
}`;
const POLVO_FRAG = `
uniform float uDust;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
  gl_FragColor = vec4(0.012, 0.009, 0.014, exp(-r2 * 2.5) * (1.0 - r2) * uDust);
  #include <logdepthbuf_fragment>
}`;

/* ---------- nubes ---------- */
let galListo = false, galPuntos = null, galPolvo = null, m31Puntos = null;
const galUni = { uCamKm: sky.uCamKm, uPix: { value: 2.2 }, uGal: { value: 0 },
                 uMin: { value: 0.8 * KPC }, uRef2: { value: (30 * KPC) ** 2 } };
const m31Uni = { uCamKm: sky.uCamKm, uPix: { value: 2.0 }, uGal: { value: 1.4 },
                 uMin: { value: 2 * KPC }, uRef2: { value: (30 * KPC) ** 2 } };
const polvoUni = { uCamKm: sky.uCamKm, uPix: { value: 2.2 }, uDust: { value: 0 } };

function nubeLuminosa(p, uni, orden){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(p.col, 3, true));
  g.setAttribute('aLum', new THREE.BufferAttribute(p.lum, 1));
  g.setAttribute('aTam', new THREE.BufferAttribute(p.tam, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: uni, vertexShader: GAL_VERT, fragmentShader: GAL_FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  pts.frustumCulled = false; pts.renderOrder = orden;
  return pts;
}

function asegurarGalaxia(){
  if (galListo) return;
  galListo = true;
  galPuntos = nubeLuminosa(
    montarPuntos(generarGalaxia(N_GAL, azarDe(1977), 1), GAL_CENTRO, galE1, galE2, galPolo), galUni, -8);
  const pv = montarPuntos(generarPolvo(Math.round(N_GAL * 0.2), azarDe(404)), GAL_CENTRO, galE1, galE2, galPolo);
  const gp = new THREE.BufferGeometry();
  gp.setAttribute('position', new THREE.BufferAttribute(pv.pos, 3));
  gp.setAttribute('aTam', new THREE.BufferAttribute(pv.tam, 1));
  gp.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  galPolvo = new THREE.Points(gp, new THREE.ShaderMaterial({
    uniforms: polvoUni, vertexShader: POLVO_VERT, fragmentShader: POLVO_FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.NormalBlending
  }));
  galPolvo.frustumCulled = false; galPolvo.renderOrder = -7;   // el polvo resta luz sobre la galaxia
  m31Puntos = nubeLuminosa(
    montarPuntos(generarGalaxia(Math.round(N_GAL / 8), azarDe(31), 1.3), M31_POS, m31Eje, m31E2, m31Norm), m31Uni, -8);
  galPuntos.visible = galPolvo.visible = false;
  sky.scene.add(galPuntos, galPolvo, m31Puntos);
}
setTimeout(() => {
  if (galListo) return;
  if ('requestIdleCallback' in window) requestIdleCallback(asegurarGalaxia, { timeout: 8000 });
  else setTimeout(asegurarGalaxia, 1500);
}, 5000);

/* ---------- nebulosas reales ---------- */
const NEBULOSAS = [
  { id:'orion',    nombre:'Nebulosa de Orión',    ra:83.82,  dec:-5.39,  ly:1344, radio:12,  c1:[0.55,0.86,0.95], c2:[0.85,0.35,0.62], sem:1.3, alfa:0.75 },
  { id:'pleyades', nombre:'Pléyades',             ra:56.75,  dec:24.12,  ly:444,  radio:8,   c1:[0.6,0.7,1.0],    c2:[0.3,0.4,0.9],   sem:2.1, alfa:0.5 },
  { id:'norteam',  nombre:'Nebulosa Norteamérica', ra:314.7, dec:44.3,   ly:2590, radio:50,  c1:[0.9,0.4,0.38],   c2:[0.5,0.2,0.3],   sem:3.7, alfa:0.55 },
  { id:'laguna',   nombre:'Nebulosa de la Laguna', ra:270.92, dec:-24.38, ly:4100, radio:55, c1:[1.0,0.55,0.62],  c2:[0.85,0.3,0.42], sem:4.4, alfa:0.6 },
  { id:'trifida',  nombre:'Nebulosa Trífida',     ra:270.6,  dec:-23.03, ly:5200, radio:21,  c1:[1.0,0.5,0.65],   c2:[0.45,0.55,1.0], sem:5.2, alfa:0.65 },
  { id:'roseta',   nombre:'Nebulosa Roseta',      ra:97.98,  dec:4.95,   ly:5200, radio:65,  c1:[0.95,0.35,0.4],  c2:[0.6,0.2,0.32],  sem:6.6, alfa:0.55, anillo:1 },
  { id:'aguila',   nombre:'Nebulosa del Águila',  ra:274.7,  dec:-13.8,  ly:5700, radio:35,  c1:[0.92,0.45,0.32], c2:[0.55,0.45,0.42], sem:7.9, alfa:0.6 },
  { id:'carina',   nombre:'Nebulosa de Carina',   ra:161.26, dec:-59.87, ly:8500, radio:150, c1:[1.0,0.6,0.38],   c2:[0.9,0.28,0.32], sem:8.8, alfa:0.7 }
];
const NEB_VERT = `
varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const NEB_FRAG = GLSL_NOISE + `
uniform vec3 uC1, uC2; uniform float uSem, uAlfa, uAnillo;
varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  vec2 q = vUv - 0.5;
  float r = length(q) * 2.0;
  if (r > 1.0) discard;
  vec3 p = vec3(q * 3.0, uSem);
  float n1 = fbm(p * 1.6, 5, 2.1, 0.55) * 0.5 + 0.5;
  float n2 = fbm(p * 4.5 + vec3(3.0), 4, 2.2, 0.5) * 0.5 + 0.5;
  float forma = smoothstep(1.0, 0.15, r + (n1 - 0.5) * 0.9);
  if (uAnillo > 0.0) forma *= smoothstep(0.05, 0.42, r + (n2 - 0.5) * 0.3);
  float dens = forma * (0.3 + 0.7 * n2);
  vec3 col = mix(uC2, uC1, smoothstep(0.2, 0.9, n1 * (1.0 - r * 0.6) + 0.2));
  gl_FragColor = vec4(col * dens * 1.3, dens * uAlfa);
  #include <logdepthbuf_fragment>
}`;
const nebGeo = new THREE.PlaneGeometry(2, 2);
for (const n of NEBULOSAS){
  n.pos = eqToEcl(n.ra, n.dec).multiplyScalar(n.ly * LY);
  n.uni = { uC1: { value: new THREE.Vector3(...n.c1) }, uC2: { value: new THREE.Vector3(...n.c2) },
            uSem: { value: n.sem }, uAlfa: { value: n.alfa }, uAnillo: { value: n.anillo || 0 } };
  n.mesh = new THREE.Mesh(nebGeo, new THREE.ShaderMaterial({
    uniforms: n.uni, vertexShader: NEB_VERT, fragmentShader: NEB_FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  }));
  n.mesh.frustumCulled = false; n.mesh.renderOrder = -6;
  n.dir = new THREE.Vector3();
  sky.scene.add(n.mesh);
}
let nebEtqListas = false;

/* destinos sin cuerpo, para el rumbo y las listas */
const DESTINOS_FIJOS = [
  { nombre: 'Centro galáctico', pos: GAL_CENTRO },
  { nombre: 'Andrómeda', pos: M31_POS },
  ...NEBULOSAS.map(n => ({ nombre: n.nombre, pos: n.pos }))
];

/* ---------- por cuadro ---------- */
let galLento = 0, galFraccion = 1;
const _ng = new THREE.Vector3();
function actualizarGalaxia(){
  const c = state.camKm;
  const dSol = Math.hypot(c[0], c[1], c[2]);
  // 0 hasta 300 años luz, 1 desde 4 000: en escala logarítmica
  const mezcla = Math.max(0, Math.min(1, (Math.log10(Math.max(dSol, 1) / LY) - 2.477) / 1.125));
  sky.mwUni.uApaga.value = 1 - mezcla;
  const ver = state.verViaLactea;

  // nebulosas: billboards en la esfera del cielo con su tamaño angular real
  if (!nebEtqListas && typeof etqEstrellas !== 'undefined'){
    nebEtqListas = true;
    for (const n of NEBULOSAS){
      const el = document.createElement('div');
      el.className = 'etq estrella nebulosa';
      el.innerHTML = `<span>${n.nombre}</span>`;
      capaEtq.appendChild(el);
      n.etq = { label: n.nombre, dir: n.dir, siempre: false };
      etqEstrellas.push({ el, s: n.etq });
    }
  }
  for (const n of NEBULOSAS){
    _ng.set(n.pos.x - c[0], n.pos.y - c[1], n.pos.z - c[2]);
    const d = _ng.length();
    n.dir.copy(_ng).divideScalar(d);
    const ang = Math.atan((n.radio * LY) / d);
    const dentro = 1 - Math.min(1, Math.max(0, (ang - 0.8) / 0.6));   // al entrar, se disuelve
    n.mesh.visible = ver && dentro > 0.01;
    if (n.mesh.visible){
      n.mesh.position.copy(n.dir).multiplyScalar(3.9);
      n.mesh.scale.setScalar(3.9 * Math.tan(Math.min(ang, 1.3)));
      n.mesh.lookAt(0, 0, 0);
      n.uni.uAlfa.value = n.alfa * dentro;
    }
    if (n.etq) n.etq.siempre = ver && ang > 0.006 && dentro > 0.3;   // con nombre cuando ya es mancha
  }

  if (mezcla > 0.002 && !galListo) asegurarGalaxia();
  if (!galListo) return;
  galPuntos.visible = galPolvo.visible = ver && mezcla > 0.002;
  m31Puntos.visible = ver;
  galUni.uGal.value = 0.36 * mezcla * sky.mwUni.uInt.value;     // el deslizador de Vía Láctea también manda aquí
  polvoUni.uDust.value = 0.6 * mezcla;

  if (galPuntos.visible){
    if (fps < 36) galLento++; else galLento = Math.max(0, galLento - 2);
    if (galLento > 90 && galFraccion > 0.3){
      galFraccion *= 0.6; galLento = 0;
      galPuntos.geometry.setDrawRange(0, Math.round(N_GAL * galFraccion));
    }
  }
}

/* ---------- destinos ---------- */
function mirarHacia(pos, d){
  state.mode = 'free';
  state.camKm[0] = pos.x; state.camKm[1] = pos.y; state.camKm[2] = pos.z;
  const L = d.length();
  freeYaw = Math.atan2(d.y, d.x) - Math.PI / 2;
  freePitch = Math.asin(Math.max(-1, Math.min(1, d.z / L)));
  freeRoll = 0; velVuelo = 0;
  camera.fov = 52; camera.updateProjectionMatrix();
  state.playing = false;
  sincronizar(); actualizarPanel();
}
function prepararViaje(){
  cerrarMomento();
  document.body.classList.remove('menu');
  state.sizeScale = 1; $('#escala').value = 0;
}

/* ver la galaxia entera desde 45 000 años luz */
function verGalaxia(){
  asegurarGalaxia();
  prepararViaje();
  const pos = GAL_CENTRO.clone().addScaledVector(galPolo, 38 * KPC).addScaledVector(galE2, 22 * KPC);
  mirarHacia(pos, GAL_CENTRO.clone().sub(pos));
  aviso('Estás a 45 000 años luz sobre el plano de la galaxia. El Sol es uno de sus 200 000 '
      + 'millones de soles, a 26 700 años luz del centro, en un brazo menor. Su luz tardaría '
      + 'toda la historia de la escritura en llegar hasta aquí.');
}

/* plantarse frente a una nebulosa, a dos radios y medio */
function irANebulosa(n, silencioso){
  prepararViaje();
  const dir = n.pos.clone().normalize();
  const pos = n.pos.clone().addScaledVector(dir, -n.radio * LY * 2.5);
  mirarHacia(pos, n.pos.clone().sub(pos));
  if (!silencioso) aviso(`${n.nombre}, a ${nf(n.ly, 0)} años luz de casa: una nube de gas de ${nf(n.radio * 2, 0)} años luz de ancho. `
      + 'Su forma y sus colores aquí son procedurales; su posición, tamaño y distancia, reales.');
}

/* vista de un sistema con planetas: la estrella enfocada y sus órbitas en cuadro */
function irASistema(id, silencioso){
  const e = porId[id]; if (!e) return;
  prepararViaje();
  const planetas = EXOPLANETAS.filter(p => p.padre === id);
  const aMax = Math.max(e.def.r * 40, ...planetas.map(p => p.a));
  state.mode = 'orbit';
  enfocar(id, true);
  state.pitch = 0.85; state.yaw = 0.6;
  state.dist = state.distTarget = aMax * 2.6;
  state.verOrbitas = true;
  state.playing = false;
  sincronizar(); actualizarPanel();
  if (!silencioso) aviso(`${e.def.nombre}: ${planetas.length} planeta${planetas.length === 1 ? '' : 's'} conocido${planetas.length === 1 ? '' : 's'}, `
      + `a ${nf(e.def.ly, e.def.ly < 100 ? 1 : 0)} años luz. Órbitas dibujadas circulares y coplanares: `
      + 'sus inclinaciones reales se desconocen.');
}
