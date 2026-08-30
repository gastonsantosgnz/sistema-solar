/* ============================================================
   INTERFAZ
   ============================================================ */

const $ = s => document.querySelector(s);
const capaEtq = $('#etiquetas');
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const nf = (v, d=0) => v.toLocaleString('es-MX', { minimumFractionDigits:d, maximumFractionDigits:d });

function distKm(km){
  if (km < 1) return nf(km*1000, 0) + ' m';
  if (km < 1e6) return nf(km, km<100?1:0) + ' km';
  if (km < 0.02*AU) return nf(km/1e6, 2) + ' millones de km';
  if (km < 2000*AU) return nf(km/AU, km/AU<10?3:2) + ' UA';
  return nf(km/LY, 2) + ' años luz';
}
function tiempoLuz(km){
  const s = km / 299792.458;
  if (s < 90) return nf(s,1) + ' s';
  if (s < 5400) return nf(s/60,1) + ' min';
  if (s < 86400*2) return nf(s/3600,1) + ' h';
  if (s < 86400*800) return nf(s/86400,1) + ' d';
  return nf(s/(86400*365.25),2) + ' años';
}
function fechaTxt(jd){
  const d = jdToDate(jd);
  return `${String(d.getUTCDate()).padStart(2,'0')} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function horaTxt(jd){
  const d = jdToDate(jd);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')} UTC`;
}

const VELOCIDADES = [
  { v:0,            t:'pausa' },
  { v:1/86400,      t:'tiempo real' },
  { v:1/1440,       t:'1 min/s' },
  { v:1/24,         t:'1 hora/s' },
  { v:1,            t:'1 día/s' },
  { v:7,            t:'1 semana/s' },
  { v:30.4375,      t:'1 mes/s' },
  { v:365.25,       t:'1 año/s' },
  { v:3652.5,       t:'10 años/s' }
];
let iVel = 4;

/* ---------- etiquetas ---------- */
const etqs = {};
for (const c of cuerpos){
  const e = document.createElement('button');
  e.className = 'etq' + (c.esLuna ? ' luna' : '') + (c.def.id === 'sol' ? ' sol' : '');
  e.innerHTML = `<i></i><span>${c.def.nombre}</span>`;
  e.onclick = ev => { ev.stopPropagation(); enfocar(c.def.id); };
  capaEtq.appendChild(e);
  etqs[c.def.id] = e;
}
const etqEstrellas = [];
for (const s of sky.named.slice(0, 90)){
  const e = document.createElement('div');
  e.className = 'etq estrella';
  e.innerHTML = `<span>${s.label}</span>`;
  capaEtq.appendChild(e);
  etqEstrellas.push({ el:e, s });
}

const _pv = new THREE.Vector3();
function proyectar(v){
  _pv.copy(v).project(camera);
  return { x:(_pv.x*0.5+0.5)*innerWidth, y:(-_pv.y*0.5+0.5)*innerHeight, z:_pv.z };
}

let panelCuadros = 0;
function actualizarHUD(){
  if (++panelCuadros >= 30){ panelCuadros = 0; actualizarPanel(); }
  const w = innerWidth, h = innerHeight;

  /* Etiquetas de cuerpos, con descarte por solapamiento: primero los grandes
     y el objetivo actual; una etiqueta que chocaría con otra ya colocada
     simplemente no se dibuja.                                              */
  const candidatos = [];
  for (const c of cuerpos){
    const e = etqs[c.def.id];
    if (!state.verEtiquetas || (c.esLuna && !lunasVisibles())){ e.style.display = 'none'; continue; }
    const p = proyectar(c.rel);
    const dentro = p.z > -1 && p.z < 1 && p.x > 4 && p.x < w - 8 && p.y > 8 && p.y < h - 8;
    let umbral = true;
    if (c.esLuna) umbral = porId[c.def.padre].dist < c.def.a * 130 && c.pxRad > 0.35;
    if (c.def.el && !state.verAsteroides && c.def.id !== state.focus) umbral = false;
    if (c.def.sonda && (!state.verSondas || !c.lanzada)) umbral = false;
    if (!dentro || !umbral){ e.style.display = 'none'; continue; }
    candidatos.push({ c, e, p });
  }
  const rango = c => c.def.id === state.focus ? 0
                   : c.def.id === 'sol'        ? 1
                   : c.def.sonda               ? 2
                   : c.def.el                  ? 4
                   : c.esLuna                  ? 3 : 2;
  candidatos.sort((a, b) => {
    const d = rango(a.c) - rango(b.c);
    if (d !== 0) return d;
    if (Math.abs(a.c.pxRad - b.c.pxRad) > 0.5) return b.c.pxRad - a.c.pxRad;
    return b.c.def.r - a.c.def.r;          // a igual tamaño en pantalla, el cuerpo mayor
  });

  // cuerpos suficientemente grandes en pantalla como para tapar a otros
  const tapan = candidatos.filter(x => x.c.pxRad > 3);
  const oculto = (c, p) => tapan.some(t =>
    t.c !== c && t.c.dist < c.dist &&
    Math.hypot(p.x - t.p.x, p.y - t.p.y) < t.c.pxRad * 0.94);

  const puestas = [];
  for (const { c, e, p } of candidatos){
    if (c.def.id !== state.focus && oculto(c, p)){ e.style.display = 'none'; continue; }
    const off = Math.max(7, Math.min(c.pxRad + 8, 260));
    const anchoTxt = c.def.nombre.length * (c.esLuna ? 6.2 : 7.4) + off + 14;
    const haciaIzq = p.x + anchoTxt > w - 10 && p.x - anchoTxt > 8;
    const caja = haciaIzq
      ? { x1: p.x - anchoTxt, y1: p.y - 11, x2: p.x + 4, y2: p.y + 11 }
      : { x1: p.x - 4, y1: p.y - 11, x2: p.x + anchoTxt, y2: p.y + 11 };
    const choca = puestas.some(q => !(caja.x2 < q.x1 || caja.x1 > q.x2 || caja.y2 < q.y1 || caja.y1 > q.y2));
    if (choca){ e.style.display = 'none'; continue; }
    puestas.push(caja);
    e.style.display = 'flex';
    const izq = haciaIzq;
    e.classList.toggle('izq', izq);
    e.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
                      + (izq ? ' translateX(-100%)' : '');
    e.classList.toggle('activo', c.def.id === state.focus);
    e.style.setProperty('--off', off.toFixed(1) + 'px');
  }

  for (const {el, s} of etqEstrellas){
    if (!state.verEtiquetas || !state.verConstelaciones){ el.style.display='none'; continue; }
    const p = proyectar(V3(s.dir.x*1e9, s.dir.y*1e9, s.dir.z*1e9));
    if (p.z > 1 || p.z < -1 || p.x < 40 || p.x > w - 40 || p.y < 20 || p.y > h - 20){ el.style.display='none'; continue; }
    const caja = { x1:p.x-4, y1:p.y-9, x2:p.x + s.label.length*6.4 + 8, y2:p.y+9 };
    if (puestas.some(q => !(caja.x2<q.x1||caja.x1>q.x2||caja.y2<q.y1||caja.y1>q.y2))){ el.style.display='none'; continue; }
    puestas.push(caja);
    el.style.display = 'flex';
    el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
  }

  // retícula sobre el objetivo
  const c = porId[state.focus];
  const p = proyectar(c.rel);
  const ret = $('#reticula');
  if (state.mode === 'orbit' && p.z > -1 && p.z < 1){
    const r = Math.max(16, Math.min(c.pxRad * 1.5 + 12, 220));
    ret.style.display = 'block';
    ret.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    ret.style.width = ret.style.height = (r*2) + 'px';
    ret.style.marginLeft = ret.style.marginTop = (-r) + 'px';
  } else ret.style.display = 'none';

  $('#fecha').textContent = fechaTxt(state.jd);
  $('#hora').textContent  = horaTxt(state.jd);
  $('#velTxt').textContent = state.playing ? VELOCIDADES[iVel].t : 'pausa';
  $('#lecturaDist').textContent = distKm(c.dist - radioEfectivo(c));
  $('#fps').textContent = Math.round(fps);
}

/* ---------- panel del objetivo ---------- */
function periodoOrbital(id){
  if (!ELEM[id]) return null;
  const a = ELEM[id][0];
  const y = Math.pow(a, 1.5);
  return y < 1 ? nf(y*365.25,1) + ' días' : nf(y,y<100?2:0) + ' años';
}

function actualizarPanel(){
  const c = porId[state.focus], d = c.def;
  const rSol = Math.hypot(c.pos[0], c.pos[1], c.pos[2]);
  const filas = [];
  const F = (k,v) => filas.push(`<div class="fila"><dt>${k}</dt><dd>${v}</dd></div>`);

  if (!d.sonda) F('Radio', nf(d.r, d.r<100?2:0) + ' km');
  if (d.mass) F('Masa', d.mass.toExponential(3).replace('e+',' × 10<sup>')+'</sup>' + ' kg');
  if (d.grav) F('Gravedad', nf(d.grav,2) + ' m/s²');
  if (d.temp !== undefined) F('Temperatura', (d.temp>0?'':'') + nf(d.temp,0) + ' °C');

  if (d.id !== 'sol' && !d.sonda){
    F('Distancia al Sol', distKm(rSol));
    F('Luz del Sol', tiempoLuz(rSol));
  }
  if (ELEM[d.id]){
    F('Año orbital', periodoOrbital(d.id));
    F('Velocidad orbital', nf(orbitalSpeed(d.id, rSol),2) + ' km/s');
    F('Excentricidad', nf(ELEM[d.id][2], 4));
    F('Inclinación orbital', nf(Math.abs(ELEM[d.id][4]), 3) + '°');
  }
  if (d.sonda){
    const s = d.sonda;
    const tierra = porId.tierra.pos;
    const dTierra = Math.hypot(c.pos[0]-tierra[0], c.pos[1]-tierra[1], c.pos[2]-tierra[2]);
    F('Lanzamiento', s.lanzamiento.split('-').reverse().join('/'));
    F('En vuelo', nf((state.jd - s.jd0) / 365.25, 1) + ' años');
    F('Distancia al Sol', nf(rSol / AU, 2) + ' UA');
    F('Distancia a la Tierra', nf(dTierra / AU, 2) + ' UA');
    F('Se\u00f1al de ida', tiempoLuz(dTierra));
    F('Velocidad', nf(sondaVel(s, state.jd), 2) + ' km/s');
    if (state.jd > s.jdFin) F('Trayectoria', 'extrapolada');
  }
  if (d.el){
    const Pd = 365.256898326 * Math.pow(d.el.a, 1.5);
    F('Semieje', nf(d.el.a, 3) + ' UA');
    F('Periodo', Pd < 700 ? nf(Pd,0) + ' días' : nf(Pd/365.25, Pd/365.25 < 100 ? 2 : 0) + ' años');
    F('Perihelio', nf(d.el.a*(1-d.el.e), 2) + ' UA');
    F('Afelio', nf(d.el.a*(1+d.el.e), 2) + ' UA');
    F('Excentricidad', nf(d.el.e, 3));
    F('Inclinación orbital', nf(d.el.i, 1) + '°');
    const GM = 1.32712440018e11;
    F('Velocidad orbital', nf(Math.sqrt(GM*(2/rSol - 1/(d.el.a*AU))), 2) + ' km/s');
    if (d.clase === 'comet') F('Próximo perihelio', fechaTxt(proximoPerihelio(d.el, state.jd)));
  }
  if (c.esLuna){
    F('Órbita', nf(d.a,0) + ' km de ' + porId[d.padre].def.nombre);
    F('Periodo', nf(Math.abs(d.per),4) + ' días' + (d.per<0?' (retrógrado)':''));
  }
  if (!d.sonda){
    F('Día (rotación)', nf(Math.abs(d.rot), Math.abs(d.rot)<10?3:1) + ' días' + (d.rot<0?' · retrógrado':''));
    if (d.tilt !== undefined) F('Inclinación axial', nf(d.tilt,2) + '°');
    if (d.lunas !== undefined) F('Lunas', d.lunas);
  }

  $('#objNombre').textContent = d.nombre;
  $('#objTipo').textContent = d.tipo || (c.esLuna ? 'Luna de ' + porId[d.padre].def.nombre : '');
  $('#objDatos').innerHTML = filas.join('');
  $('#objNota').textContent = d.nota || '';
  $('#objNota').style.display = d.nota ? 'block' : 'none';

  document.querySelectorAll('#indice button').forEach(b =>
    b.classList.toggle('activo', b.dataset.id === state.focus));
}

/* ---------- índice de cuerpos ---------- */
function construirIndice(){
  const cont = $('#indice');
  const grupos = [
    ['Estrella',   ['sol']],
    ['Planetas',   BODIES.filter(b=>b.clase==='planet').map(b=>b.id)],
    ['Enanos',     ['pluton','ceres']],
    ['Asteroides', ['vesta','palas','higia','eros','apofis']],
    ['Cometas',    ['halley','encke','churyumov','halebopp']],
    ['Sondas',     SONDAS.map(s => s.id)],
    ['Lunas',      MOONS.map(m=>m.id)]
  ];
  cont.insertAdjacentHTML('beforeend', grupos.map(([t, ids]) => `
    <div class="grupo"><h4>${t}</h4>${ids.map(id => {
      const c = porId[id];
      return `<button data-id="${id}"><i style="background:#${new THREE.Color(c.def.color).getHexString()}"></i>${c.def.nombre}</button>`;
    }).join('')}</div>`).join(''));
  cont.querySelectorAll('button').forEach(b => b.onclick = () => enfocar(b.dataset.id));
}

/* ---------- interacción ---------- */
let arrastrando = false, movido = 0, lx = 0, ly = 0;
const punteros = new Map();
let pellizco = 0;

canvas.addEventListener('pointerdown', e => {
  punteros.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (punteros.size === 2){ pellizco = sepPunteros(); arrastrando = false; return; }
  arrastrando = true; movido = 0; lx = e.clientX; ly = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
function sepPunteros(){
  const [a, b] = [...punteros.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
canvas.addEventListener('pointermove', e => {
  if (punteros.has(e.pointerId)) punteros.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (punteros.size === 2){
    const d = sepPunteros();
    if (pellizco > 0 && d > 0){
      const f = pellizco / d;
      if (state.mode === 'orbit'){
        state.distTarget = Math.max(radioEfectivo(porId[state.focus])*1.02 + 1,
                           Math.min(state.distTarget * Math.pow(f, 1.6), 4e10));
      }
    }
    pellizco = d;
    return;
  }
  if (!arrastrando) return;
  const dx = e.clientX - lx, dy = e.clientY - ly;
  lx = e.clientX; ly = e.clientY;
  movido += Math.abs(dx) + Math.abs(dy);
  const k = 0.0042;
  if (state.mode === 'orbit'){
    state.yaw -= dx * k;
    state.pitch = Math.max(-1.5533, Math.min(1.5533, state.pitch + dy * k));
  } else {
    freeYaw -= dx * k; freePitch = Math.max(-1.5533, Math.min(1.5533, freePitch - dy * k));
  }
});
function soltar(e){
  punteros.delete(e.pointerId);
  if (punteros.size < 2) pellizco = 0;
  if (!arrastrando) return;
  arrastrando = false;
  if (movido < 5) elegirEn(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', soltar);
canvas.addEventListener('pointercancel', soltar);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const f = Math.exp(e.deltaY * 0.0011);
  if (state.mode === 'orbit'){
    state.distTarget = Math.max(radioEfectivo(porId[state.focus])*1.02 + 1,
                       Math.min(state.distTarget * f, 4e10));
  } else {
    camera.fov = Math.max(12, Math.min(78, camera.fov * (e.deltaY>0?1.05:0.952)));
    camera.updateProjectionMatrix();
  }
}, { passive:false });

const ray = new THREE.Raycaster();
function elegirEn(px, py){
  // 1) el cuerpo más cercano al puntero en pantalla (funciona con puntos diminutos)
  let mejor = null, mejorD = 46;
  for (const c of cuerpos){
    if (c.esLuna && !lunasVisibles()) continue;
    const p = proyectar(c.rel);
    if (p.z < -1 || p.z > 1) continue;
    const d = Math.hypot(p.x - px, p.y - py) - Math.min(c.pxRad, 40);
    if (d < mejorD){ mejorD = d; mejor = c; }
  }
  if (mejor) enfocar(mejor.def.id);
}

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if ($('#postal').classList.contains('abierto')){
    if (k === 'escape') cerrarPostal();
    return;                       // con el modal abierto, los atajos no tocan la escena
  }
  teclas[k] = true;
  if (e.shiftKey) teclas['shift'] = true;
  if (e.ctrlKey)  teclas['control'] = true;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

  if (k === ' '){ e.preventDefault(); state.playing = !state.playing; }
  else if (k === ']'){ iVel = Math.min(VELOCIDADES.length-1, iVel+1); aplicarVel(); }
  else if (k === '['){ iVel = Math.max(1, iVel-1); aplicarVel(); }
  else if (k === 'l'){ state.verEtiquetas = !state.verEtiquetas; sincronizar(); }
  else if (k === 'o'){ state.verOrbitas = !state.verOrbitas; sincronizar(); }
  else if (k === 'c'){ state.verConstelaciones = !state.verConstelaciones; sincronizar(); }
  else if (k === 'm'){ state.verLunas = !state.verLunas; sincronizar(); }
  else if (k === 'k'){ state.verTrans = !state.verTrans; sincronizar(); }
  else if (k === 'h'){ state.chrome = !state.chrome; document.body.classList.toggle('sin-hud', !state.chrome); }
  else if (k === 'v'){ alternarModo(); }
  else if (k === 'g'){ state.verViaLactea = !state.verViaLactea; sincronizar(); }
  else if (k === '?'){ $('#ayuda').classList.toggle('abierto'); }
  else if (k === 'escape'){ $('#ayuda').classList.remove('abierto'); }
  else if (k >= '0' && k <= '9'){
    const orden = ['sol','mercurio','venus','tierra','marte','jupiter','saturno','urano','neptuno','pluton'];
    enfocar(orden[+k]);
  }
});
addEventListener('keyup', e => {
  teclas[e.key.toLowerCase()] = false;
  if (!e.shiftKey) teclas['shift'] = false;
  if (!e.ctrlKey)  teclas['control'] = false;
});
addEventListener('blur', () => { for (const k in teclas) teclas[k] = false; });

function alternarModo(){
  if (state.mode === 'orbit'){
    state.mode = 'free';
    freeYaw = state.yaw + Math.PI/2; freePitch = -state.pitch; freeRoll = 0;
  } else {
    state.mode = 'orbit';
    enfocar(state.focus);
  }
  sincronizar();
}

function aplicarVel(){
  state.rate = VELOCIDADES[iVel].v;
  state.playing = true;
  sincronizar();
}
