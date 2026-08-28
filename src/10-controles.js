/* ============================================================
   CONTROLES Y ARRANQUE
   ============================================================ */

function sincronizar(){
  $('#tOrbitas').classList.toggle('on', state.verOrbitas);
  $('#tEtiquetas').classList.toggle('on', state.verEtiquetas);
  $('#tLunas').classList.toggle('on', state.verLunas);
  $('#tConst').classList.toggle('on', state.verConstelaciones);
  $('#tViaLactea').classList.toggle('on', state.verViaLactea);
  $('#tLuz').classList.toggle('on', state.luzReal);
  $('#tAsteroides').classList.toggle('on', state.verAsteroides);
  $('#tSondas').classList.toggle('on', state.verSondas);
  $('#tVuelo').classList.toggle('on', state.mode === 'free');
  $('#velTxt').textContent = state.playing ? VELOCIDADES[iVel].t : 'pausa';
  $('#btnPlay').textContent = state.playing ? '❙❙' : '▶';
  document.body.classList.toggle('vuelo', state.mode === 'free');
  const s = state.sizeScale;
  $('#escalaTxt').textContent = s <= 1.001 ? 'real' : '×' + nf(s, s<10?1:0);
  const av = $('#avisoEscala');
  av.style.display = s > 1.001 ? 'block' : 'none';
  av.textContent = s >= 25
    ? 'Cuerpos agrandados ' + nf(s,0) + ' veces. Las distancias siguen siendo reales; las lunas quedan ocultas porque a esta escala estarían dentro de su planeta.'
    : 'Los cuerpos están agrandados. Las distancias entre ellos siguen siendo reales.';
}

function montarControles(){
  $('#btnPlay').onclick = () => { state.playing = !state.playing; sincronizar(); };
  $('#btnMas').onclick  = () => { iVel = Math.min(VELOCIDADES.length-1, iVel+1); aplicarVel(); };
  $('#btnMenos').onclick= () => { iVel = Math.max(1, iVel-1); aplicarVel(); };
  $('#btnHoy').onclick  = () => { viajarEnElTiempo(dateToJD(new Date())); $('#fechaIn').value = new Date().toISOString().slice(0,10); };

  $('#fechaIn').value = jdToDate(state.jd).toISOString().slice(0,10);
  $('#fechaIn').onchange = e => {
    const d = new Date(e.target.value + 'T12:00:00Z');
    if (!isNaN(d)) viajarEnElTiempo(dateToJD(d));
  };

  const sl = $('#escala');
  sl.oninput = () => {
    const t = +sl.value / 1000;
    state.sizeScale = Math.pow(10, t * 3);   // 1 … 1000
    sincronizar();
  };

  const toggles = {
    tOrbitas:'verOrbitas', tEtiquetas:'verEtiquetas', tLunas:'verLunas',
    tConst:'verConstelaciones', tViaLactea:'verViaLactea', tLuz:'luzReal',
    tAsteroides:'verAsteroides', tSondas:'verSondas'
  };
  for (const [id, prop] of Object.entries(toggles)){
    $('#'+id).onclick = () => { state[prop] = !state[prop]; sincronizar(); };
  }
  $('#tVuelo').onclick = alternarModo;
  $('#btnAyuda').onclick = () => $('#ayuda').classList.toggle('abierto');
  $('#cerrarAyuda').onclick = () => $('#ayuda').classList.remove('abierto');

  $('#brilloCielo').oninput = e => { sky.starUni.uGamma.value = +e.target.value/100; };
  $('#brilloVL').oninput = e => { sky.mwUni.uInt.value = +e.target.value/100; };

  // atajos de viaje interestelar
  const cont = $('#viajes');
  cont.innerHTML = NEAR_STARS.map((s,i) =>
    `<button data-i="${i}">${s.nombre}<em>${nf(s.ly,2)} al</em></button>`).join('');
  cont.querySelectorAll('button').forEach(b => b.onclick = () => viajarA(NEAR_STARS[+b.dataset.i]));
  $('#btnVolver').onclick = () => { enfocar('tierra'); state.distTarget = encuadre(porId.tierra); };
  $('#btnSistema').onclick = () => { verSistema(); document.body.classList.remove('menu'); };
  $('#btnEventos').onclick = calculaEventos;
  $('#btnPunto').onclick = puntoAzul;

  // menú desplegable en pantallas pequeñas
  $('#btnMenu').onclick = () => document.body.classList.toggle('menu');
  $('#indice').addEventListener('click', e => {
    if (e.target.closest('button') && innerWidth <= 720) document.body.classList.remove('menu');
  });

  // mandos de empuje para vuelo libre táctil
  const empuje = (el, tecla) => {
    const on  = e => { e.preventDefault(); teclas[tecla] = true;  el.setPointerCapture(e.pointerId); };
    const off = e => { e.preventDefault(); teclas[tecla] = false; };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  };
  empuje($('#mAdel'), 'w');
  empuje($('#mAtras'), 's');
}

/* Encuadra el sistema completo desde arriba del plano de la eclíptica */
function verSistema(){
  state.mode = 'orbit';
  enfocar('sol');
  state.pitch = 1.12;
  state.distTarget = 78 * AU;
  state.verOrbitas = true;
  sincronizar();
}

/* El 14 de febrero de 1990 la Voyager 1 giró la cámara y fotografió la Tierra
   desde 40 UA. Esto reconstruye ese encuadre: cámara en la sonda, teleobjetivo
   y la Tierra como el punto que era.                                        */
function puntoAzul(){
  state.sizeScale = 1; $('#escala').value = 0;
  state.playing = false;
  state.verSondas = true;
  state.verAsteroides = false;      // el momento pide silencio alrededor
  state.verOrbitas = false;
  document.body.classList.remove('menu');
  enfocar('tierra');
  viajarEnElTiempo(dateToJD(new Date('1990-02-14T00:00:00Z')), () => {
    actualizarPosiciones(state.jd);
    const v = porId.voyager1, t = porId.tierra;
    const dx = t.pos[0]-v.pos[0], dy = t.pos[1]-v.pos[1], dz = t.pos[2]-v.pos[2];
    const d = Math.hypot(dx, dy, dz);
    state.mode = 'free';
    state.camKm[0] = v.pos[0]; state.camKm[1] = v.pos[1]; state.camKm[2] = v.pos[2];
    freeYaw = Math.atan2(dy, dx) - Math.PI/2;
    freePitch = Math.asin(Math.max(-1, Math.min(1, dz/d)));
    freeRoll = 0;
    camera.fov = 11;                       // teleobjetivo, como el de la sonda
    camera.updateProjectionMatrix();
    sincronizar(); actualizarPanel();
    aviso('Est\u00e1s en la Voyager 1, a ' + nf(d/AU, 1) + ' UA de casa. Ese punto es la Tierra: '
        + 'todo lo que existe para nosotros cabe en \u00e9l. La se\u00f1al de esta foto tard\u00f3 '
        + tiempoLuz(d) + ' en llegar.');
  });
}

/* Lleva la cámara a una estrella cercana (modo libre, mirando al Sol) */
function viajarA(s){
  const OB = 23.4392911*DEG, r = s.ra*Math.PI/12, d = s.dec*DEG;
  const x = Math.cos(d)*Math.cos(r), y = Math.cos(d)*Math.sin(r), z = Math.sin(d);
  const ex = x, ey = y*Math.cos(OB)+z*Math.sin(OB), ez = -y*Math.sin(OB)+z*Math.cos(OB);
  const D = s.ly * LY * 0.985;
  state.mode = 'free';
  state.camKm[0] = ex*D; state.camKm[1] = ey*D; state.camKm[2] = ez*D;
  // mirar de vuelta al Sol
  freeYaw = Math.atan2(-ey, -ex) - Math.PI/2;
  freePitch = Math.asin(Math.max(-1, Math.min(1, -ez)));
  freeRoll = 0;
  camera.fov = 52; camera.updateProjectionMatrix();
  sincronizar();
  aviso(`Estás junto a ${s.nombre}, a ${nf(s.ly,2)} años luz de casa. Desde aquí el Sol es una estrella más: su luz tardó ${nf(s.ly,1)} años en llegar hasta ti.`);
}

/* Salta a otra fecha barriendo el tiempo: duración logarítmica con el tramo */
function viajarEnElTiempo(jdDestino, alTerminar){
  const delta = Math.abs(jdDestino - state.jd);
  if (state.viaje){                    // ya en viaje: redirigirlo al nuevo destino
    state.viaje.hasta = jdDestino;
    state.viaje.alTerminar = alTerminar;
    return;
  }
  if (delta < 0.02){
    state.jd = jdDestino;
    if (alTerminar) alTerminar();
    return;
  }
  state.viaje = {
    desde: state.jd, hasta: jdDestino,
    t0: performance.now(),
    dur: 700 + 380 * Math.log10(1 + delta),
    alTerminar
  };
}

/* ---------- eclipses ---------- */
let eventosLista = [];
function calculaEventos(){
  $('#eventos').innerHTML = '<p class="calc">calculando\u2026</p>';
  setTimeout(() => {
    eventosLista = buscarEclipses(state.jd - 0.5, 6);
    const cont = $('#eventos');
    if (!eventosLista.length){ cont.innerHTML = '<p class="calc">sin eclipses pr\u00f3ximos</p>'; return; }
    cont.innerHTML = eventosLista.map((e, i) =>
      `<button data-i="${i}">${fechaTxt(e.jd)}<em>${e.clase === 'solar' ? 'Sol' : 'Luna'} \u00b7 ${e.tipo}</em></button>`
    ).join('');
    cont.querySelectorAll('button').forEach(b => b.onclick = () => irAEclipse(eventosLista[+b.dataset.i]));
  }, 30);
}

function irAEclipse(e){
  state.sizeScale = 1; $('#escala').value = 0;
  state.verLunas = true;
  state.playing = false;
  document.body.classList.remove('menu');
  const foco = e.clase === 'solar' ? 'tierra' : 'luna';
  enfocar(foco);
  viajarEnElTiempo(e.jd - 35/1440, () => {
    actualizarPosiciones(state.jd);
    const b = porId[foco], sol = porId.sol;
    const dx = sol.pos[0]-b.pos[0], dy = sol.pos[1]-b.pos[1], dz = sol.pos[2]-b.pos[2];
    const dd = Math.hypot(dx, dy, dz);
    state.yaw = Math.atan2(dy, dx);            // cámara del lado del Sol: ve la cara iluminada
    state.pitch = Math.asin(dz/dd);
    state.dist = state.distTarget = e.clase === 'solar' ? 30000 : 5600;
    iVel = 2; state.rate = VELOCIDADES[2].v;   // 1 minuto por segundo
    state.playing = true;
    sincronizar(); actualizarPanel();
    aviso(e.clase === 'solar'
      ? `Eclipse ${e.tipo} de Sol: la sombra de la Luna est\u00e1 a punto de cruzar la Tierra. El reloj corre a 1 minuto por segundo.`
      : `Eclipse ${e.tipo} de Luna: la Luna entra en la sombra de la Tierra y se oscurece. El reloj corre a 1 minuto por segundo.`);
  });
}

let avisoT = null;
function aviso(txt){
  const el = $('#aviso');
  el.textContent = txt;
  el.classList.add('visible');
  clearTimeout(avisoT);
  avisoT = setTimeout(() => el.classList.remove('visible'), 8000);
}

/* ---------- arranque ---------- */
construirIndice();
montarControles();
calculaEventos();
redimensionar();
actualizarPosiciones(state.jd);
enfocar('tierra', true);
state.distTarget = state.dist = porId.tierra.def.r * 4.2;
sincronizar();
actualizarPanel();
requestAnimationFrame(paso);

// quitar la pantalla de carga cuando las texturas estén decodificadas
(function esperar(intentos){
  if (texPendientes > 0 && intentos < 400){
    const listas = texTotal - texPendientes;
    const txt = $('#cargaTxt'), barra = $('#barraProg');
    if (txt) txt.textContent = 'TEXTURAS ' + listas + ' / ' + texTotal;
    if (barra) barra.style.width = (listas / Math.max(texTotal, 1) * 100).toFixed(0) + '%';
    return setTimeout(() => esperar(intentos+1), 40);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.add('listo');
    setTimeout(() => { const c = $('#carga'); if (c) c.remove(); }, 900);
  }));
})(0);

/* API pública: permite guionizar la vista desde la consola del navegador */
window.sistemaSolar = {
  state, porId, cuerpos, camera, renderer, sky, sincronizar, actualizarPanel,
  enfocar, viajarA, alternarModo, aviso, verSistema, viajarEnElTiempo, irAEclipse, puntoAzul,
  velocidad(i){ iVel = Math.max(0, Math.min(VELOCIDADES.length-1, i)); aplicarVel(); },
  escala(k){ state.sizeScale = k; $('#escala').value = Math.log10(k)/3*1000; sincronizar(); },
  distancia(km){ state.distTarget = state.dist = km; },
  fecha(iso){ state.jd = dateToJD(new Date(iso)); }
};
