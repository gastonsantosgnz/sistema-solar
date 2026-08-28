/* ============================================================
   URLS COMPARTIBLES
   La dirección refleja la vista actual (fecha, cuerpo, cámara,
   capas) y al abrir un enlace se restaura todo. Se aceptan dos
   formas de entrada:
     ?f=2026-11-28T09:52&foco=saturno&d=350000...
     /fecha/2026-11-28 · /date/28-11-2026 · /cuerpo/saturno[/fecha]
   Siempre se ESCRIBE la forma de consulta (?…), que funciona en
   cualquier hosting; las rutas bonitas requieren rewrites.
   ============================================================ */

let urlBase = null;          // pathname sin el sufijo bonito reconocido
let urlUltima = '';
let urlActiva = true;        // se apaga si el host no permite replaceState

function parseFechaURL(txt){
  if (!txt) return null;
  txt = txt.trim();
  let m = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
  let d;
  if (m) d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3], m[4]!==undefined?+m[4]:12, m[5]!==undefined?+m[5]:0));
  else {
    m = txt.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);          // DD-MM-YYYY
    if (!m) return null;
    d = new Date(Date.UTC(+m[3], +m[2]-1, +m[1], 12, 0));
  }
  return isNaN(d) ? null : dateToJD(d);
}

const CAPAS_URL = [
  ['o','verOrbitas',true], ['e','verEtiquetas',true], ['m','verLunas',true],
  ['a','verAsteroides',true], ['c','verConstelaciones',false],
  ['g','verViaLactea',true], ['z','luzReal',false]
];

function aplicarURL(){
  let ruta = location.pathname;
  urlBase = ruta;
  const fin = () => { if (!urlBase.endsWith('/')) urlBase += '/'; };
  const q = new URLSearchParams(location.search);
  let jd = null, foco = null;

  // rutas bonitas: /fecha/... /date/... /cuerpo/<id>[/<fecha>]
  let m = ruta.match(/\/(?:fecha|date)\/([^/]+)\/?$/);
  if (m){ jd = parseFechaURL(decodeURIComponent(m[1])); urlBase = ruta.slice(0, m.index) || '/'; fin(); }
  m = ruta.match(/\/cuerpo\/([a-z0-9-]+)(?:\/([^/]+))?\/?$/);
  if (m){
    if (porId[m[1]]) foco = m[1];
    if (m[2]) jd = parseFechaURL(decodeURIComponent(m[2]));
    urlBase = ruta.slice(0, m.index) || '/';
    fin();
  }

  if (q.get('f')) jd = parseFechaURL(q.get('f')) ?? jd;
  if (q.get('foco') && porId[q.get('foco')]) foco = q.get('foco');

  if (jd !== null) state.jd = jd;
  if (foco) enfocar(foco, true);
  if (jd !== null || foco) actualizarPosiciones(state.jd);

  if (q.get('d')){ const d = +q.get('d'); if (d > 0) state.dist = state.distTarget = Math.min(d, 4e10); }
  if (q.get('yaw')) state.yaw = +q.get('yaw') * DEG;
  if (q.get('pit')) state.pitch = Math.max(-1.55, Math.min(1.55, +q.get('pit') * DEG));
  if (q.get('esc')){ const k = Math.max(1, Math.min(1000, +q.get('esc'))); state.sizeScale = k; $('#escala').value = Math.log10(k)/3*1000; }
  if (q.get('vel')){ const i = +q.get('vel'); if (i >= 0 && i < VELOCIDADES.length){ iVel = i; state.rate = VELOCIDADES[i].v; } }
  if (q.get('play') === '0') state.playing = false;
  if (q.get('capas')){
    for (const tok of q.get('capas').split(',')){
      const off = tok.startsWith('-');
      const c = CAPAS_URL.find(x => x[0] === (off ? tok.slice(1) : tok));
      if (c) state[c[1]] = !off;
    }
  }
  if (jd !== null) $('#fechaIn').value = jdToDate(state.jd).toISOString().slice(0,10);
  sincronizar(); actualizarPanel();
}

function serializarURL(){
  const q = new URLSearchParams();
  // fecha: solo si el reloj no está en "ahora" (±12 h)
  const jdAhora = dateToJD(new Date());
  if (Math.abs(state.jd - jdAhora) > 0.5){
    const iso = jdToDate(state.jd).toISOString();
    q.set('f', iso.slice(0,10) + 'T' + iso.slice(11,16));
  }
  if (state.focus !== 'tierra') q.set('foco', state.focus);
  if (state.mode === 'orbit'){
    const c = porId[state.focus];
    if (Math.abs(state.distTarget - encuadre(c)) / encuadre(c) > 0.08)
      q.set('d', Math.round(state.distTarget).toString());
    q.set('yaw', (state.yaw / DEG).toFixed(1));
    q.set('pit', (state.pitch / DEG).toFixed(1));
  }
  if (state.sizeScale > 1.001) q.set('esc', state.sizeScale.toFixed(state.sizeScale < 10 ? 1 : 0));
  if (iVel !== 4) q.set('vel', iVel);
  if (!state.playing) q.set('play', '0');
  const capas = [];
  for (const [letra, prop, def] of CAPAS_URL){
    if (state[prop] !== def) capas.push(state[prop] ? letra : '-' + letra);
  }
  if (capas.length) q.set('capas', capas.join(','));
  const qs = q.toString();
  return urlBase + (qs ? '?' + qs.replace(/%2C/g, ',').replace(/%3A/g, ':') : '');
}

function escribirURL(){
  if (!ES_SITIO || !urlActiva || state.viaje) return;
  const nueva = serializarURL();
  if (nueva === urlUltima) return;
  urlUltima = nueva;
  try { history.replaceState(null, '', nueva); }
  catch (e){ urlActiva = false; }
  const c = porId[state.focus];
  document.title = `${c.def.nombre} — ${fechaTxt(state.jd)} · Sistema Solar 3D`;
}

function copiarEnlace(){
  const url = ES_SITIO
    ? (escribirURL(), location.href)
    : location.origin + location.pathname + serializarURL().replace(urlBase, '');
  const listo = () => aviso('Enlace copiado. Al abrirlo se restaura esta vista: fecha, cuerpo, cámara y capas.');
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(listo, () => aviso(url));
  } else aviso(url);
}

/* arranque: aplicar la URL de entrada y mantenerla al día.
   ES_SITIO distingue el sitio publicado del archivo suelto: fuera del sitio no
   hay rutas hermanas, así que no se reescribe la barra ni se ofrece el índice. */
try { aplicarURL(); } catch (e) { /* una URL malformada nunca debe romper la app */ }
if (ES_SITIO){
  $('#enlaceExplorar').style.display = '';
  setInterval(escribirURL, 1000);
} else {
  $('#btnCompartir').textContent = 'Copiar enlace a esta vista';
}
$('#btnCompartir').onclick = copiarEnlace;
