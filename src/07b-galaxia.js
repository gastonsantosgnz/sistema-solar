/* ============================================================
   LA GALAXIA — la Vía Láctea como objeto 3D, y Andrómeda al fondo.
   Puntos procedurales y deterministas (cero datos, cero descarga)
   con posición real en km, en la misma escena-cielo y con la misma
   convención que las estrellas del catálogo: el shader resta la
   posición de la cámara, así que el paralaje y la perspectiva
   salen solos — desde dentro, el disco se ve como banda; desde
   fuera, como espiral. El Sol queda a 8.2 kpc del centro, en la
   orientación real (polo y centro galácticos del propio cielo).
   Compuertas: se genera perezosamente, solo se dibuja lejos del
   Sol (crossfade con la banda pintada), y se recorta si los fps
   caen. Sin salir del sistema solar cuesta exactamente cero.
   ============================================================ */

const KPC = 1000 * PC;                                  // km por kiloparsec
const GAL_R_SOL = 8.2 * KPC;                            // el Sol, a 26 700 años luz del centro
const galPolo = sky.mwUni.uPole.value.clone();          // norte galáctico (marco eclíptico)
const galE1 = sky.mwUni.uCenter.value.clone().negate(); // del centro hacia el Sol, en el plano
galE1.addScaledVector(galPolo, -galE1.dot(galPolo)).normalize();
const galE2 = new THREE.Vector3().crossVectors(galPolo, galE1).normalize();
const GAL_CENTRO = sky.mwUni.uCenter.value.clone().multiplyScalar(GAL_R_SOL);   // km, heliocéntrico

// Andrómeda (M31): 765 kpc, inclinada 77°, ángulo de posición 35°
const M31_DIR = eqToEcl(10.6847, 41.2687);
const M31_POS = M31_DIR.clone().multiplyScalar(765 * KPC);
const m31Eje = (() => {                                  // eje mayor: el norte celeste girado por el AP
  const n = eqToEcl(0, 90);
  n.addScaledVector(M31_DIR, -n.dot(M31_DIR)).normalize();
  return n.applyAxisAngle(M31_DIR, 35 * DEG);
})();
const m31Norm = M31_DIR.clone().applyAxisAngle(m31Eje, 77 * DEG);
const m31E2 = new THREE.Vector3().crossVectors(m31Norm, m31Eje).normalize();

const N_GAL = (matchMedia('(max-width: 720px)').matches || (navigator.hardwareConcurrency || 8) <= 4)
  ? 110000 : 220000;

/* Galaxia genérica en su propio marco (x, y en el plano; z el eje), en km.
   Bulbo, disco con dos brazos mayores y dos menores, regiones HII y halo. */
function generarGalaxia(N, rnd, escala){
  const pos = new Float32Array(N * 3), col = new Uint8Array(N * 3), lum = new Float32Array(N);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.2;
  const tanP = Math.tan(13 * DEG), r0 = 0.6 * KPC;
  const th0 = Math.PI / 2 - Math.log(GAL_R_SOL / r0) / tanP;   // el Sol cae entre dos brazos
  for (let i = 0; i < N; i++){
    const u = rnd();
    let x, y, z, r, g, b, L;
    if (u < 0.13){                                         // bulbo
      const rr = -Math.log(1 - rnd()) * 0.75 * KPC;
      const ct = rnd() * 2 - 1, st = Math.sqrt(1 - ct * ct), ph = rnd() * Math.PI * 2;
      x = rr * st * Math.cos(ph); y = rr * st * Math.sin(ph); z = rr * ct * 0.55;
      r = 255; g = 226; b = 178; L = 0.9;
    } else if (u < 0.955){                                 // disco y brazos
      let R = 0.3 * KPC - Math.log(1 - rnd()) * 3.3 * KPC;
      if (R > 21 * KPC) R = 21 * KPC * (0.6 + 0.4 * rnd());
      z = gauss() * 0.22 * KPC * (1 + R / (18 * KPC));    // el disco se ensancha hacia fuera
      let th = rnd() * Math.PI * 2;
      if (rnd() < 0.6){
        const q = rnd();
        const k = q < 0.36 ? 0 : q < 0.72 ? 1 : q < 0.86 ? 0.5 : 1.5;
        th = th0 + k * Math.PI + Math.log(R / r0) / tanP + gauss() * (0.16 + 0.16 * R / (20 * KPC));
        if (rnd() < 0.07){ r = 255; g = 175; b = 205; L = 1.5; }   // regiones HII
        else { r = 188; g = 206; b = 255; L = 1.0; }                // estrellas jóvenes
      } else { r = 236; g = 214; b = 176; L = 0.5; }               // población vieja del disco
      x = R * Math.cos(th); y = R * Math.sin(th);
    } else {                                               // halo
      const rr = 4 * KPC - Math.log(1 - rnd()) * 9 * KPC;
      const ct = rnd() * 2 - 1, st = Math.sqrt(1 - ct * ct), ph = rnd() * Math.PI * 2;
      x = rr * st * Math.cos(ph); y = rr * st * Math.sin(ph); z = rr * ct;
      r = 205; g = 195; b = 225; L = 0.3;
    }
    pos[i*3] = x * escala; pos[i*3+1] = y * escala; pos[i*3+2] = z * escala;
    col[i*3] = r; col[i*3+1] = g; col[i*3+2] = b;
    lum[i] = L * (0.6 + 0.8 * rnd());
  }
  return { pos, col, lum };
}

/* pasa los puntos del marco propio al marco eclíptico heliocéntrico */
function montarGalaxia(p, C, e1, e2, n){
  const a = p.pos;
  for (let i = 0; i < a.length; i += 3){
    const x = a[i], y = a[i+1], z = a[i+2];
    a[i]   = C.x + x * e1.x + y * e2.x + z * n.x;
    a[i+1] = C.y + x * e1.y + y * e2.y + z * n.y;
    a[i+2] = C.z + x * e1.z + y * e2.z + z * n.z;
  }
  return p;
}

const GAL_VERT = `
attribute vec3 aCol; attribute float aLum;
uniform vec3 uCamKm; uniform float uPix, uGal, uMin, uRef2;
varying vec3 vCol; varying float vInt;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vec3 p = position - uCamKm;
  float d = max(length(p), uMin);
  vInt = clamp(uGal * aLum * uRef2 / (d * d), 0.0, 2.5);
  vCol = aCol;
  gl_PointSize = clamp(uPix * (1.0 + 1.4 * sqrt(vInt)), 1.0, 4.5);
  vec4 mv = viewMatrix * vec4(normalize(p) * 4.0, 1.0);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;

let galListo = false, galPuntos = null, m31Puntos = null;
const galUni = { uCamKm: sky.uCamKm, uPix: { value: 2.6 }, uGal: { value: 0 },
                 uMin: { value: 0.8 * KPC }, uRef2: { value: (30 * KPC) ** 2 } };
const m31Uni = { uCamKm: sky.uCamKm, uPix: { value: 2.2 }, uGal: { value: 1.6 },
                 uMin: { value: 2 * KPC }, uRef2: { value: (30 * KPC) ** 2 } };

function nubeGalactica(p, uni){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p.pos, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(p.col, 3, true));
  g.setAttribute('aLum', new THREE.BufferAttribute(p.lum, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: uni, vertexShader: GAL_VERT, fragmentShader: STAR_FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  pts.frustumCulled = false;
  pts.renderOrder = -8;                                  // entre la banda (-10) y las estrellas (-5)
  return pts;
}

/* se construye la primera vez que hace falta (o en un rato libre tras cargar) */
function asegurarGalaxia(){
  if (galListo) return;
  galListo = true;
  galPuntos = nubeGalactica(
    montarGalaxia(generarGalaxia(N_GAL, azarDe(1977), 1), GAL_CENTRO, galE1, galE2, galPolo), galUni);
  m31Puntos = nubeGalactica(
    montarGalaxia(generarGalaxia(Math.round(N_GAL / 8), azarDe(31), 1.3), M31_POS, m31Eje, m31E2, m31Norm), m31Uni);
  galPuntos.visible = false;
  sky.scene.add(galPuntos, m31Puntos);
}
setTimeout(() => {
  if (galListo) return;
  if ('requestIdleCallback' in window) requestIdleCallback(asegurarGalaxia, { timeout: 8000 });
  else setTimeout(asegurarGalaxia, 1500);
}, 5000);

/* por cuadro: crossfade banda ↔ galaxia según la distancia al Sol, y recorte adaptativo */
let galLento = 0, galFraccion = 1;
function actualizarGalaxia(){
  const c = state.camKm;
  const dSol = Math.hypot(c[0], c[1], c[2]);
  // 0 hasta 300 años luz, 1 desde 4 000: en escala logarítmica
  const mezcla = Math.max(0, Math.min(1, (Math.log10(Math.max(dSol, 1) / LY) - 2.477) / 1.125));
  sky.mwUni.uApaga.value = 1 - mezcla;
  if (mezcla > 0.002 && !galListo) asegurarGalaxia();
  if (!galListo) return;
  const ver = state.verViaLactea;
  galPuntos.visible = ver && mezcla > 0.002;
  m31Puntos.visible = ver;
  galUni.uGal.value = 0.55 * mezcla;

  // si con la galaxia a la vista el cuadro no da, se dibujan menos puntos
  if (galPuntos.visible){
    if (fps < 36) galLento++; else galLento = Math.max(0, galLento - 2);
    if (galLento > 90 && galFraccion > 0.3){
      galFraccion *= 0.6; galLento = 0;
      galPuntos.geometry.setDrawRange(0, Math.round(N_GAL * galFraccion));
    }
  }
}

/* Salir del sistema → ver la galaxia entera desde 45 000 años luz */
function verGalaxia(){
  asegurarGalaxia();
  cerrarMomento();
  document.body.classList.remove('menu');
  state.sizeScale = 1; $('#escala').value = 0;
  const pos = GAL_CENTRO.clone().addScaledVector(galPolo, 38 * KPC).addScaledVector(galE2, 22 * KPC);
  state.mode = 'free';
  state.camKm[0] = pos.x; state.camKm[1] = pos.y; state.camKm[2] = pos.z;
  const d = GAL_CENTRO.clone().sub(pos), L = d.length();
  freeYaw = Math.atan2(d.y, d.x) - Math.PI / 2;
  freePitch = Math.asin(Math.max(-1, Math.min(1, d.z / L)));
  freeRoll = 0; velVuelo = 0;
  camera.fov = 52; camera.updateProjectionMatrix();
  state.playing = false;
  sincronizar(); actualizarPanel();
  aviso('Estás a 45 000 años luz sobre el plano de la galaxia. El Sol es uno de sus 200 000 '
      + 'millones de soles, a 26 700 años luz del centro, en un brazo menor. Su luz tardaría '
      + 'toda la historia de la escritura en llegar hasta aquí.');
}
