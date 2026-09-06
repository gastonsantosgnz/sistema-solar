/* ============================================================
   INSTRUMENTOS DE VUELO
   Velocímetro de cinta logarítmica (14 órdenes de magnitud, con
   hitos reales por el camino), lectura con unidades que escalan
   solas, una línea de contexto que traduce la cifra, y el rumbo:
   si la nariz apunta a un cuerpo, cuánto falta y cuánto tardaría
   la luz. Solo existe en modo vuelo (body.vuelo).
   ============================================================ */

const C_LUZ = 299792.458;                       // km/s
const CINTA_LO = Math.log10(0.25);
const CINTA_HI = Math.log10(9.2e10);            // tope real del motor con Shift
const posCinta = v =>
  (Math.log10(Math.max(v, 0.25)) - CINTA_LO) / (CINTA_HI - CINTA_LO) * 100;

/* los hitos: marcas de la cinta (instrumento) y presets de crucero (botones) */
const HITOS_V = [
  [0.343,      'SONIDO',    'ini'],
  [17,         'VOYAGER',   ''],
  [29.8,       'TIERRA',    'abajo'],
  [192,        'PARKER',    ''],
  [C_LUZ,      'LUZ',       'luz'],
  [C_LUZ*100,  '×100 c',    ''],
  [C_LUZ*1e4,  '×10 000 c', 'abajo']
];

(function construirCinta(){
  let html = '<div class="cintaEje"></div>';
  for (let e = 0; e <= 10; e++)
    html += `<i class="ctick" style="left:${posCinta(Math.pow(10, e)).toFixed(2)}%"></i>`;
  for (const [v, t, cls] of HITOS_V)
    html += `<b class="chito ${cls}" data-v="${v}" style="left:${posCinta(v).toFixed(2)}%"><i></i><span>${t}</span></b>`;
  html += '<div id="cintaFill"></div><div id="cintaAguja"></div>';
  $('#instCinta').innerHTML = html;

  // fila de crucero: AUTO + un chip por hito; tocar el activo vuelve a AUTO
  const chips = $('#instChips');
  chips.innerHTML = '<button class="chipV on" data-v="0" title="Velocidad automática: escala con la distancia">Auto</button>'
    + HITOS_V.map(([v, t]) => `<button class="chipV" data-v="${v}" title="Fijar crucero: ${t}">${t}</button>`).join('');
  chips.querySelectorAll('button').forEach(b => b.onclick = () => {
    const v = +b.dataset.v;
    fijarVel(v === 0 || state.velFija === v ? null : v);
  });
})();

/* velocidad de crucero: null = automática (escala con la distancia) */
function fijarVel(v){
  state.velFija = v;
  document.querySelectorAll('#instChips button').forEach(b =>
    b.classList.toggle('on', v ? +b.dataset.v === v : +b.dataset.v === 0));
  document.querySelectorAll('#instCinta .chito').forEach(b =>
    b.classList.toggle('fija', !!v && +b.dataset.v === v));
}

function fmtTiempoV(s){
  if (!isFinite(s) || s < 0) return '—';
  if (s < 1) return '<1 s';
  if (s < 90) return nf(s, s < 10 ? 1 : 0) + ' s';
  if (s < 5400) return nf(s / 60, s < 600 ? 1 : 0) + ' min';
  if (s < 172800) return nf(s / 3600, 1) + ' h';
  if (s < 86400 * 365) return nf(s / 86400, 1) + ' días';
  return nf(s / 31557600, 1) + ' años';
}

/* la comparación que hace la cifra imaginable: razones a baja velocidad,
   trayectos conocidos cuando el tiempo cae en una ventana humana */
const TRAYECTOS = [
  [384400,     'de la Tierra a la Luna en '],
  [AU,         'del Sol a la Tierra en '],
  [60 * AU,    'de punta a punta del sistema solar en '],
  [4.246 * LY, 'hasta Alfa Centauri en ']
];
function contextoVel(v){
  if (v < 60)  return '×' + nf(v / 7.66, 1) + ' la Estación Espacial Internacional';
  if (v < 640) return '×' + nf(v / 192, 1) + ' la sonda solar Parker, lo más rápido que hemos lanzado';
  for (const [d, txt] of TRAYECTOS){
    const t = d / v;
    if (t >= 2 && t <= 5400) return txt + fmtTiempoV(t);
  }
  return 'hasta Alfa Centauri en ' + fmtTiempoV(4.246 * LY / v);
}

/* ¿a qué cuerpo apunta la nariz? (dentro de ~3.4°, o de su disco) */
const _fwV = new THREE.Vector3(), _dV = new THREE.Vector3();
function rumboVuelo(){
  _fwV.set(0, 0, -1).applyQuaternion(camQ);
  let mejor = null, mejorAng = 0.06;
  for (const c of cuerpos){
    if (c.def.sonda) continue;
    if (c.esLuna && !lunasVisibles()) continue;
    if (c.dist < radioEfectivo(c) * 1.05) continue;      // estás encima
    _dV.copy(c.rel).normalize();
    const holgura = _fwV.angleTo(_dV) - Math.asin(Math.min(1, radioEfectivo(c) / c.dist));
    if (holgura < mejorAng){ mejorAng = holgura; mejor = c; }
  }
  return mejor;
}

function actualizarInstrumentos(){
  if (state.mode !== 'free') return;
  const v = velVuelo;
  const elV = $('#instVel'), tag = $('#instTag');
  const aguja = $('#cintaAguja'), fill = $('#cintaFill');

  if (v < 0.26){
    elV.textContent = 'EN REPOSO';
    elV.classList.remove('c');
    tag.classList.remove('on');
    aguja.style.display = 'none';
    fill.style.width = '0';
    $('#instCtx').textContent = '';
  } else {
    if (v < 0.01 * C_LUZ) elV.textContent = nf(v, v < 10 ? 1 : 0) + ' km/s';
    else if (v < C_LUZ)   elV.textContent = nf(v, 0) + ' km/s · ' + nf(v / C_LUZ, 2) + ' c';
    else {
      const xc = v / C_LUZ;
      elV.textContent = nf(xc, xc < 10 ? 2 : xc < 1000 ? 1 : 0) + ' c';
    }
    elV.classList.toggle('c', v >= C_LUZ);
    tag.classList.toggle('on', v >= C_LUZ);
    const p = Math.min(posCinta(v), 100);
    aguja.style.display = 'block';
    aguja.style.left = p + '%';
    fill.style.width = p + '%';
    $('#instCtx').textContent = contextoVel(v);
  }

  const b = rumboVuelo();
  const R = $('#instRumbo');
  if (b){
    const dSup = Math.max(b.dist - radioEfectivo(b), 1);
    R.style.opacity = 1;
    R.innerHTML = 'RUMBO <b>' + b.def.nombre.toUpperCase() + '</b> · ' + distKm(dSup)
      + (v > 0.26 ? ' · llegas en ' + fmtTiempoV(dSup / v) : '')
      + ' · la luz: ' + tiempoLuz(dSup);
  } else {
    R.style.opacity = 0;
  }
}
