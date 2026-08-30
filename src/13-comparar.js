/* ============================================================
   COMPARADOR DE TAMAÑOS
   Escena "estudio" aparte: los cuerpos elegidos posan en fila a
   escala real, alineados por la base, con su inclinación axial
   verdadera y rotando despacio. Reutiliza geometrías y MATERIALES
   del motor: mientras el comparador está abierto la simulación no
   se dibuja, así que compartir materiales es seguro (renderCuadro
   recalcula todos los uniforms al volver). El Sol, si se incluye,
   asoma como un arco por el borde izquierdo: a escala real no cabe
   entero junto a los planetas, y ese es justamente el punto.
   ============================================================ */

const COMP_FOV = 2.5 * DEG;          // pseudo-ortográfica: casi sin perspectiva
const COMP_LUZ = V3(-0.35, 0.28, 1).normalize();   // casi frontal: pose de estudio, no fase
const COMP_MAX = 10;
const COMP_GRUPOS = [
  ['Estrella',   ['sol']],
  ['Planetas',   BODIES.filter(b => b.clase === 'planet').map(b => b.id)],
  ['Enanos',     ['pluton', 'ceres']],
  ['Asteroides', ['vesta', 'palas', 'higia', 'eros', 'apofis']],
  ['Cometas',    ['halley', 'encke', 'churyumov', 'halebopp']],
  ['Lunas',      MOONS.map(m => m.id)]
];
const COMP_PRESETS = [
  ['Tierra y Luna',         ['tierra', 'luna']],
  ['Rocosos',               ['mercurio', 'venus', 'tierra', 'marte']],
  ['Gigantes',              ['jupiter', 'saturno', 'urano', 'neptuno']],
  ['Ganímedes vs Mercurio', ['ganimedes', 'mercurio']],
  ['Lunas grandes',         ['luna', 'io', 'europa', 'ganimedes', 'calisto', 'titan']],
  ['Todos + Sol',           ['sol', 'mercurio', 'venus', 'tierra', 'marte', 'jupiter', 'saturno', 'urano', 'neptuno']]
];

const escenaComp = new THREE.Scene();
const camComp = new THREE.PerspectiveCamera(2.5, 1, 0.5, 5e6);
const cieloComp = new THREE.PerspectiveCamera(55, 1, 0.1, 20);
cieloComp.quaternion.setFromEuler(new THREE.Euler(0.32, 0.55, 0.12));
// pose de estudio: todo se inclina ~17° hacia el espectador, para que los
// anillos no queden de canto (la cámara mira perpendicular a la fila)
const COMP_POSE = new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), 0.30);

let compItems = [];                  // { c, grupo, mesh, nubes, ring, x, r, amb, fase }
let compEtqs = [];
let compT = 0, compZ = 1, compZT = 1;
let compPanX = 0, compPanY = 0, compPanXT = 0, compPanYT = 0;
let compSel = -1;                    // parada del recorrido: -1 = vista general
let compTW = 1, compMR = 1, compMinR = 1;
let compPlayingAntes = null, compGammaAntes = 1;
const _cq = new THREE.Quaternion(), _cv = new THREE.Vector3(), _pc = new THREE.Vector3();
const COMP_Y = V3(0, 1, 0), COMP_Z = V3(0, 0, 1);

/* encuadre actual: el zoom cambia el fov, la cámara no se mueve en z */
function vistaComp(){
  const aspect = innerWidth / Math.max(innerHeight, 1);
  const halfH0 = Math.max(compTW * 0.56 / aspect, compMR * 1.6);
  const halfH = halfH0 / compZ;
  const D = halfH0 / Math.tan(COMP_FOV / 2);
  return { aspect, halfH0, halfH, halfW: halfH * aspect, D };
}

function armarComparacion(ids){
  while (escenaComp.children.length) escenaComp.remove(escenaComp.children[0]);
  compItems = []; compEtqs = [];

  // el Sol es un cuerpo más de la fila: completo, y como el mayor va a la izquierda
  const fila = ids.filter(id => porId[id])
                  .sort((a, b) => porId[b].def.r - porId[a].def.r);

  const radios = fila.map(id => porId[id].def.r / U);
  // el ancho que un cuerpo ocupa de verdad: los anillos cuentan para separarlo
  const extens = fila.map((id, i) => {
    const d = porId[id].def;
    return d.ring ? Math.max(radios[i], d.ring[1] / U) : radios[i];
  });
  compMR = Math.max(...radios);
  compMinR = Math.min(...radios);
  // separación proporcional a cada par de vecinos: respira igual a cualquier escala
  const gaps = extens.slice(0, -1).map((e, i) => 0.35 * (e + extens[i + 1]));
  compTW = extens.reduce((s, e) => s + 2 * e, 0) + gaps.reduce((s, g) => s + g, 0);

  const capa = $('#compEtq');
  capa.innerHTML = '';

  let x = -compTW / 2;
  fila.forEach((id, i) => {
    const c = porId[id];
    const r = radios[i];
    const ex = extens[i];
    const cx = x + ex;                                  // centrado en su ancho con anillos
    x += 2 * ex + (gaps[i] || 0);

    const grupo = new THREE.Group();
    grupo.position.set(cx, r, 0);                       // alineados por la base (y = 0)
    grupo.quaternion.setFromAxisAngle(COMP_Z, -(c.def.tilt || 0) * DEG).premultiply(COMP_POSE);
    const mesh = new THREE.Mesh(esferaGeo, c.mesh.material);
    mesh.scale.setScalar(r);
    grupo.add(mesh);
    let ring = null, nubes = null;
    if (c.ring){
      ring = new THREE.Mesh(c.ring.geometry, c.ring.material);
      ring.scale.setScalar(r);
      grupo.add(ring);
    }
    if (c.atm){
      const a = new THREE.Mesh(esferaGeo, c.atm.material);
      a.scale.setScalar(r * (c.def.id === 'tierra' ? 1.018 : 1.026));
      grupo.add(a);
    }
    if (c.nubes){
      nubes = new THREE.Mesh(esferaGeo, c.nubes.material);
      nubes.scale.setScalar(r * 1.006);
      grupo.add(nubes);
    }
    if (id === 'sol'){
      const halo = new THREE.Sprite(porId.sol.corona.material);   // su propia corona
      halo.scale.set(r * 3.1, r * 3.1, 1);
      grupo.add(halo);
      porId.sol.corona.material.opacity = 0.85;   // el simulador lo repone al volver
    }
    escenaComp.add(grupo);
    // luz ambiente de estudio: el lado en sombra se insinúa, no se pierde
    const amb = c.uni.uAmb.value;
    c.uni.uAmb.value = 0.12;
    compItems.push({ c, grupo, mesh, nubes, ring, x: cx, r, ext: ex, amb, fase: Math.random() * Math.PI * 2 });

    const el = document.createElement('div');
    el.className = 'cetq';
    el.innerHTML = `<b>${c.def.nombre}</b><em>&Oslash; ${nf(c.def.r * 2, 0)} km</em>`;
    el.onclick = () => tourComp(i);
    capa.appendChild(el);
    compEtqs.push({ x: cx, el, w: 0 });
  });

  // medir los rótulos ya montados, para el descarte por solapamiento
  requestAnimationFrame(() => { for (const q of compEtqs) q.w = q.el.offsetWidth || 80; });

  $('#compDato').textContent = textoDato(fila);
}

function textoDato(fila){
  const A = porId[fila[0]].def, B = porId[fila[fila.length - 1]].def;
  const kd = A.r / B.r;
  if (fila.length === 2)
    return `${A.nombre}: ${nf(kd, kd < 10 ? 2 : 1)} × el diámetro de ${B.nombre} · ${nf(Math.pow(kd, 3), 0)} × su volumen`;
  return `De ${A.nombre} (Ø ${nf(A.r * 2, 0)} km) a ${B.nombre} (Ø ${nf(B.r * 2, 0)} km): ${nf(kd, kd < 10 ? 1 : 0)} × en diámetro`;
}

/* un cuadro del estudio: cámara, poses, luz y rótulos */
function renderComparar(dt){
  compT += dt;
  const k = Math.min(1, dt * 7);
  compZ += (compZT - compZ) * k;
  const v = vistaComp();

  // los límites del paneo se abren al acercar y se cierran al alejar
  const s = 1 - 1 / Math.max(compZ, compZT);
  compPanXT = Math.max(-compTW * 0.55 * s, Math.min(compTW * 0.55 * s, compPanXT));
  compPanYT = Math.max(-compMR * s, Math.min(2.2 * compMR * s, compPanYT));
  compPanX += (compPanXT - compPanX) * k;
  compPanY += (compPanYT - compPanY) * k;

  camComp.aspect = v.aspect;
  camComp.fov = 2 * Math.atan(v.halfH / v.D) / DEG;
  camComp.near = Math.max(v.D * 0.002, 0.01);
  camComp.far = v.D * 6 + R_SOL / U * 4;
  camComp.updateProjectionMatrix();
  camComp.position.set(compPanX, v.halfH * 0.4 + compPanY, v.D);
  camComp.updateMatrixWorld(true);
  cieloComp.aspect = v.aspect;
  cieloComp.updateProjectionMatrix();

  const spin = compT * (Math.PI * 2 / 26);      // una vuelta cada 26 s
  for (const it of compItems){
    it.mesh.quaternion.setFromAxisAngle(COMP_Y, spin + it.fase);
    if (it.nubes) it.nubes.quaternion.setFromAxisAngle(COMP_Y, (spin + it.fase) * 1.045);
    const u = it.c.uni;
    u.uSunDir.value.copy(COMP_LUZ);
    u.uLight.value = 1.06;
    u.uDetail.value = 1;
    u.uTime.value = compT * 0.3;
    u.uNumCast.value = 0;                       // sin sombras de eclipse en el estudio
    u.uEje.value.copy(COMP_Y).applyQuaternion(it.grupo.quaternion);
    _cq.copy(it.grupo.quaternion).multiply(it.mesh.quaternion).invert();
    u.uSunObj.value.copy(COMP_LUZ).applyQuaternion(_cq);
    if (it.ring){
      it.c.runi.uLight.value = 1.06;
      _cq.copy(it.grupo.quaternion).invert();
      it.c.runi.uSunObj.value.copy(COMP_LUZ).applyQuaternion(_cq);
    }
  }
  etiquetasComp();
  renderer.clear();
  renderer.render(sky.scene, cieloComp);
  renderer.render(escenaComp, camComp);
}

function etiquetasComp(){
  const w = innerWidth, h = innerHeight;
  const puestas = [];
  for (const q of compEtqs){
    _pc.set(q.x, 0, 0).project(camComp);
    const sx = (_pc.x * 0.5 + 0.5) * w;
    const sy = Math.min(h - 76, Math.max(66, (-_pc.y * 0.5 + 0.5) * h + 16));
    const mitad = (q.w || 80) / 2 + 8;
    const fuera = sx < -40 || sx > w + 40;
    const choca = puestas.some(p => sx + mitad > p[0] && sx - mitad < p[1]);
    if (fuera || choca){ q.el.style.display = 'none'; continue; }
    puestas.push([sx - mitad, sx + mitad]);
    q.el.style.display = '';
    q.el.style.transform = `translate(${(sx - (q.w || 80) / 2).toFixed(1)}px, ${sy.toFixed(1)}px)`;
  }
}

/* ---------- entrada y salida ---------- */
function abrirComparacion(ids, nombre){
  cerrarSelector();
  document.body.classList.remove('menu');
  armarComparacion(ids);
  compZ = compZT = 1; compPanX = compPanY = compPanXT = compPanYT = 0;
  compSel = -1; compT = 0;
  compPlayingAntes = state.playing;
  state.playing = false;
  compGammaAntes = sky.starUni.uGamma.value;
  sky.starUni.uGamma.value = Math.min(compGammaAntes, 0.6);   // fondo discreto de estudio
  $('#compNombre').textContent = nombre || (ids.length + ' cuerpos');
  state.comparando = true;
  document.body.classList.add('comparando');
  sincronizar();
}

function cerrarComparar(){
  if (!state.comparando) return;
  state.comparando = false;
  document.body.classList.remove('comparando');
  sky.starUni.uGamma.value = compGammaAntes;
  for (const it of compItems) it.c.uni.uAmb.value = it.amb;
  if (compPlayingAntes !== null){ state.playing = compPlayingAntes; compPlayingAntes = null; }
  while (escenaComp.children.length) escenaComp.remove(escenaComp.children[0]);
  compItems = []; compEtqs = [];
  $('#compEtq').innerHTML = '';
  sincronizar();
}

/* ---------- navegación dentro del estudio ---------- */
let cArr = false, cLX = 0, cLY = 0, cPinch = 0;
const cPtr = new Map();
function cSep(){ const [a, b] = [...cPtr.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }

canvas.addEventListener('pointerdown', e => {
  if (!state.comparando) return;
  cPtr.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (cPtr.size === 2){ cPinch = cSep(); cArr = false; return; }
  cArr = true; cLX = e.clientX; cLY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!state.comparando) return;
  if (cPtr.has(e.pointerId)) cPtr.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (cPtr.size === 2){
    const d = cSep();
    if (cPinch > 0 && d > 0) compZT = Math.max(1, Math.min(compZT * Math.pow(d / cPinch, 1.4), zMaxComp()));
    cPinch = d;
    return;
  }
  if (!cArr) return;
  const v = vistaComp();
  const kx = 2 * v.halfW / innerWidth, ky = 2 * v.halfH / innerHeight;
  compPanX -= (e.clientX - cLX) * kx; compPanXT = compPanX;   // el arrastre es 1:1
  compPanY += (e.clientY - cLY) * ky; compPanYT = compPanY;
  cLX = e.clientX; cLY = e.clientY;
});
function cSoltar(e){
  if (!state.comparando) return;
  cPtr.delete(e.pointerId);
  if (cPtr.size < 2) cPinch = 0;
  cArr = false;
}
canvas.addEventListener('pointerup', cSoltar);
canvas.addEventListener('pointercancel', cSoltar);
canvas.addEventListener('wheel', e => {
  if (!state.comparando) return;
  e.preventDefault();
  const aspect = innerWidth / Math.max(innerHeight, 1);
  const halfH0 = Math.max(compTW * 0.56 / aspect, compMR * 1.6);
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2){
    // swipe lateral del trackpad: paneo directo
    compPanXT += e.deltaX * (2 * halfH0 * aspect / compZT) / innerWidth;
    compPanX = compPanXT;
    return;
  }
  const zAntes = compZT;
  compZT = Math.max(1, Math.min(compZT * Math.exp(-e.deltaY * 0.0011), zMaxComp()));
  // acercar hacia el cursor: el punto bajo el puntero se queda quieto
  const fx = e.clientX / innerWidth - 0.5;
  const fy = 0.5 - e.clientY / innerHeight;
  compPanXT += fx * 2 * aspect * (halfH0 / zAntes - halfH0 / compZT);
  compPanYT += fy * 2 * (halfH0 / zAntes - halfH0 / compZT);
}, { passive: false });

function zMaxComp(){
  const v = vistaComp();
  return Math.max(1, v.halfH0 * 0.8 / Math.max(compMinR, 1e-4));
}

/* ---------- recorrido cuerpo a cuerpo ---------- */
function tourComp(i){
  const it = compItems[i]; if (!it) return;
  compSel = i;
  const v = vistaComp();
  // encuadre de la parada: el cuerpo cómodo en pantalla, y con anillos completos
  compZT = Math.max(1, Math.min(v.halfH0 / Math.max(it.r * 3.6, it.ext * 2.1), zMaxComp()));
  compPanXT = it.x;
  compPanYT = it.r - 0.4 * (v.halfH0 / compZT);
  for (let j = 0; j < compEtqs.length; j++) compEtqs[j].el.classList.toggle('activo', j === i);
}
function pasoComp(dir){
  if (!compItems.length) return;
  const i = Math.max(-1, Math.min(compItems.length - 1, compSel + dir));
  if (i < 0) resetComp(); else tourComp(i);
}
function resetComp(){
  compSel = -1;
  compZT = 1; compPanXT = 0; compPanYT = 0;
  for (const q of compEtqs) q.el.classList.remove('activo');
}

/* ---------- selector ---------- */
function armarListaComp(){
  $('#compLista').innerHTML = COMP_GRUPOS.map(([t, ids]) => `
    <div class="cgrupo"><h4>${t}</h4>${ids.map(id => {
      const c = porId[id]; if (!c) return '';
      return `<label class="crow"><input type="checkbox" value="${id}">
        <i style="background:#${new THREE.Color(c.def.color).getHexString()}"></i>
        <span>${c.def.nombre}</span><em>r ${nf(c.def.r, 0)} km</em></label>`;
    }).join('')}</div>`).join('');
  $('#compLista').addEventListener('change', e => {
    if (seleccionComp().length > COMP_MAX){
      e.target.checked = false;
      aviso('Máximo ' + COMP_MAX + ' cuerpos a la vez.');
    }
    botonComp();
  });
  $('#compChips').innerHTML = COMP_PRESETS.map((p, i) =>
    `<button class="chip" data-i="${i}">${p[0]}</button>`).join('');
  $('#compChips').querySelectorAll('button').forEach(b => b.onclick = () => {
    const [nombre, ids] = COMP_PRESETS[+b.dataset.i];
    marcarChecks(ids);
    abrirComparacion(ids, nombre);
  });
}
const seleccionComp = () =>
  [...document.querySelectorAll('#compLista input:checked')].map(i => i.value);
function marcarChecks(ids){
  document.querySelectorAll('#compLista input').forEach(i => { i.checked = ids.includes(i.value); });
  botonComp();
}
function botonComp(){
  const n = seleccionComp().length;
  const b = $('#btnVerComparar');
  b.textContent = 'Comparar (' + n + ')';
  b.disabled = n < 2;
}
function abrirSelector(){
  document.body.classList.remove('menu');
  botonComp();
  $('#comparar').classList.add('abierto');
}
function cerrarSelector(){ $('#comparar').classList.remove('abierto'); }

armarListaComp();
$('#btnComparar').onclick = abrirSelector;
$('#cerrarSelComp').onclick = cerrarSelector;
$('#comparar').addEventListener('click', e => { if (e.target.id === 'comparar') cerrarSelector(); });
$('#btnVerComparar').onclick = () => {
  const ids = seleccionComp();
  if (ids.length >= 2) abrirComparacion(ids);
};
$('#cerrarComp').onclick = cerrarComparar;
$('#compIzq').onclick = () => pasoComp(-1);
$('#compDer').onclick = () => pasoComp(1);

window.sistemaSolar.comparar = (ids, nombre) => abrirComparacion(ids, nombre);
window.sistemaSolar.cerrarComparar = cerrarComparar;
