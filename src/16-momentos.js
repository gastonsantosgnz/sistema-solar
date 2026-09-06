/* ============================================================
   MOMENTOS
   Escenas curadas: una fecha real, una cámara puesta con
   intención y un banner persistente que explica qué estás viendo
   hasta que decides salir (× o Esc). Mientras un momento está en
   pantalla no hay cabina ni instrumentos: es contemplación.
   Reutilizan la maquinaria del simulador — cada momento es dato,
   no código nuevo — y la URL captura la escena para compartirla.
   ============================================================ */

/* órbita clásica: viajar a la fecha, enfocar y encuadrar */
function momOrbita(iso, foco, dist, extra){
  state.sizeScale = 1; $('#escala').value = 0;
  if (extra) Object.assign(state, extra);
  enfocar(foco);
  viajarEnElTiempo(dateToJD(new Date(iso)), () => {
    state.playing = false;
    state.dist = state.distTarget = dist;
    sincronizar(); actualizarPanel();
  });
}

/* mirada: cámara junto a un cuerpo, apuntando a otro (teleobjetivo) */
function momMirada(iso, desdeId, haciaId, fov){
  state.sizeScale = 1; $('#escala').value = 0;
  enfocar(desdeId);
  viajarEnElTiempo(dateToJD(new Date(iso)), () => {
    actualizarPosiciones(state.jd);
    const A = porId[desdeId], B = porId[haciaId];
    const dx = B.pos[0] - A.pos[0], dy = B.pos[1] - A.pos[1], dz = B.pos[2] - A.pos[2];
    const d = Math.hypot(dx, dy, dz);
    state.mode = 'free';
    const alt = radioEfectivo(A) * 3.5;          // fuera de la atmósfera, del lado del objetivo
    state.camKm[0] = A.pos[0] + dx / d * alt;
    state.camKm[1] = A.pos[1] + dy / d * alt;
    state.camKm[2] = A.pos[2] + dz / d * alt;
    freeYaw = Math.atan2(dy, dx) - Math.PI / 2;
    freePitch = Math.asin(Math.max(-1, Math.min(1, dz / d)));
    freeRoll = 0;
    velVuelo = 0;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    state.playing = false;
    sincronizar(); actualizarPanel();
  });
}

/* Halley: el perihelio que calcula el propio simulador */
function momHalley(){
  state.sizeScale = 1; $('#escala').value = 0;
  const jd = proximoPerihelio(porId.halley.def.el, dateToJD(new Date('2055-01-01T00:00:00Z')));
  enfocar('halley');
  viajarEnElTiempo(jd, () => {
    state.playing = false;
    state.dist = state.distTarget = 2.5e6;
    sincronizar(); actualizarPanel();
  });
}

const MOMENTOS = [
  { nombre: 'Punto azul pálido', fecha: '14 feb 1990', accion: puntoAzul,
    desc: 'Recreación de la foto de la Voyager 1: mirar atrás desde 40 UA y encontrar '
        + 'la Tierra convertida en un punto pálido. Todo lo que existe para nosotros cabe ahí. '
        + 'La señal de esa foto tardó 5 horas y media en llegar.' },
  { nombre: 'Voyager 2 sobre Neptuno', fecha: '25 ago 1989',
    accion: () => momOrbita('1989-08-25T04:00:00Z', 'neptuno', 210000, { verSondas: true }),
    desc: 'La única visita que hemos hecho a Neptuno: la Voyager 2 rozó sus nubes a 4 950 km '
        + 'tras doce años de viaje. Busca su punto junto al planeta. Nadie ha vuelto.' },
  { nombre: 'La Gran Conjunción', fecha: '21 dic 2020',
    accion: () => momMirada('2020-12-21T18:00:00Z', 'tierra', 'jupiter', 3.2),
    desc: 'Vista con teleobjetivo desde la Tierra: Júpiter y Saturno a una décima de grado, '
        + 'su mayor acercamiento aparente en casi cuatro siglos. Dos mundos gigantes '
        + 'compartiendo el mismo pedazo de cielo.' },
  { nombre: 'Eclipse total en España', fecha: '12 ago 2026',
    accion: () => irAEclipse({ jd: dateToJD(new Date('2026-08-12T17:46:00Z')), clase: 'solar', tipo: 'total' }, true),
    desc: 'La sombra de la Luna cruza la península al atardecer. El reloj corre a un minuto '
        + 'por segundo: mira la mancha oscura avanzar sobre la Tierra.' },
  { nombre: 'El regreso de Halley', fecha: '2061', accion: momHalley,
    desc: 'El cometa vuelve al perihelio con su coma y su cola desplegadas. Aquí se propaga '
        + 'como problema de dos cuerpos, así que el reloj marca unos meses después del valor '
        + 'real (julio de 2061): los tirones de los planetas no están incluidos.' },
  { nombre: 'New Horizons sobre Plutón', fecha: '14 jul 2015',
    accion: () => momOrbita('2015-07-14T11:49:00Z', 'pluton', 90000, { verSondas: true, verLunas: true }),
    desc: 'Nueve años y medio de viaje para un sobrevuelo de horas: New Horizons pasó a 12 500 km '
        + 'de Plutón y nos mostró un corazón de hielo de nitrógeno. Busca su punto junto al planeta y a Caronte.' },
  { nombre: 'Parker toca el Sol', fecha: '24 dic 2024',
    accion: () => momOrbita('2024-12-24T11:53:00Z', 'parker', 2.5e6, { verSondas: true }),
    desc: 'El perihelio récord de la sonda solar Parker: a 6.1 millones de km de la superficie del Sol, '
        + 'dentro de la corona, a 192 km/s: el objeto humano más rápido de la historia.' },
  { nombre: 'Voyager 1 cruza la heliopausa', fecha: '25 ago 2012',
    accion: () => momOrbita('2012-08-25T12:00:00Z', 'voyager1', 8e5, { verSondas: true }),
    desc: 'A 121 UA del Sol, el viento solar cede ante el medio interestelar y la Voyager 1 se '
        + 'convierte en el primer objeto humano fuera de la burbuja del Sol. Aquí no hay nada que ver, y esa es la noticia.' },
  { nombre: 'Los siete mundos de TRAPPIST-1', fecha: '40 años luz',
    accion: () => irASistema('trappist1', true),
    desc: 'Siete planetas rocosos apretados alrededor de una estrella apenas mayor que Júpiter, todos más '
        + 'cerca de ella que Mercurio del Sol; tres en la zona templada. Corre el tiempo y míralos girar en días.' },
  { nombre: 'La nebulosa de Orión', fecha: '1 344 años luz',
    accion: () => irANebulosa(NEBULOSAS.find(n => n.id === 'orion'), true),
    desc: 'La guardería estelar más cercana: una nube de gas de 24 años luz de ancho donde nacen estrellas '
        + 'ahora mismo. Su forma aquí es procedural; su posición, tamaño y distancia, reales.' }
];

function abrirMomento(i){
  const m = MOMENTOS[i];
  cerrarMomento();                             // resetea lente y modo antes de la escena
  document.body.classList.remove('menu');
  state.enMomento = true;
  document.body.classList.add('momento');
  $('#momTitulo').textContent = m.nombre + ' · ' + m.fecha;
  $('#momTexto').textContent = m.desc;
  $('#momBanner').classList.add('visible');
  m.accion();
}

function cerrarMomento(){
  if (!state.enMomento) return;
  state.enMomento = false;
  document.body.classList.remove('momento');
  $('#momBanner').classList.remove('visible');
  camera.fov = 52;
  camera.updateProjectionMatrix();
  if (state.mode === 'free'){ state.mode = 'orbit'; enfocar(state.focus, true); }
  sincronizar(); actualizarPanel();
}

(function construirMomentos(){
  const cont = $('#momentos');
  cont.innerHTML = MOMENTOS.map((m, i) =>
    `<button data-i="${i}">${m.nombre}<em>${m.fecha}</em></button>`).join('');
  cont.querySelectorAll('button').forEach(b =>
    b.onclick = () => abrirMomento(+b.dataset.i));
  $('#momCerrar').onclick = cerrarMomento;
})();

window.sistemaSolar.momento = abrirMomento;
