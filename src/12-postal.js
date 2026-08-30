/* ============================================================
   POSTAL DESCARGABLE
   Imagen del sistema visto desde el norte de la eclíptica en la
   fecha del reloj: dos renders reales del motor (sistema completo
   y detalle interior) compuestos con rotulación en un canvas 2D.
   Todo ocurre en el navegador; no hay servidor.
   ============================================================ */

const POSTAL_DIM = { h: { w: 2560, h: 1440 }, v: { w: 1440, h: 2560 }, c: { w: 2048, h: 2048 } };
const POSTAL_MITAD = 33;     // UA del Sol al borde corto: hasta Neptuno, con aire para su rótulo
const POSTAL_INT = 1.9;      // UA del detalle interior: de Mercurio a Marte
const POSTAL_BRILLO = 1.45;  // brillo estelar propio de la postal (el slider queda para la vista)
const POSTAL_MAG = 6.3;      // magnitud límite: más estrellas débiles que en el cielo interactivo
const POSTAL_VL = 1.0;       // intensidad de la Vía Láctea en la postal
let postalFmt = 'h';
let postalPlayingAntes = null;
let postalGen = 0;           // invalida vistas previas obsoletas

const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio',
                     'julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_POSTAL = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
function fechaLarga(jd){
  const d = jdToDate(jd);
  return d.getUTCDate() + ' de ' + MESES_LARGO[d.getUTCMonth()] + ' de ' + d.getUTCFullYear();
}

/* Render cenital fuera del ciclo. Centrado en el Sol, con capas curadas y
   escala real; devuelve el frame como dataURL y las posiciones proyectadas
   de `ids`. Restaura el simulador y repinta en la misma tarea: sin parpadeo. */
function renderCenital(w, h, mitadAU, ids){
  const s = state;
  const prev = {
    mode:s.mode, focus:s.focus, yaw:s.yaw, pitch:s.pitch,
    dist:s.dist, distTarget:s.distTarget, cam:[s.camKm[0], s.camKm[1], s.camKm[2]],
    fYaw:freeYaw, fPitch:freePitch, fRoll:freeRoll,
    sizeScale:s.sizeScale, verOrbitas:s.verOrbitas, verAsteroides:s.verAsteroides,
    verTrans:s.verTrans,
    verSondas:s.verSondas, verLunas:s.verLunas, verConstelaciones:s.verConstelaciones,
    verViaLactea:s.verViaLactea, luzReal:s.luzReal,
    fov:camera.fov, pr:renderer.getPixelRatio(),
    nubePix:nubeBelt.material.uniforms.uPix.value,
    gamma:sky.starUni.uGamma.value, mag:sky.starUni.uLimit.value, mw:sky.mwUni.uInt.value
  };

  s.mode = 'orbit'; s.focus = 'sol';
  s.yaw = -Math.PI / 2;        // equinoccio (+X) a la derecha; giro antihorario, como en los atlas
  s.pitch = 1.5533;            // el mismo tope cenital que permite el arrastre
  s.sizeScale = 1;
  s.verOrbitas = true;
  s.verAsteroides = false; s.verTrans = true;     // sin cinturón interior ni cometas; Kuiper sí
  s.verSondas = false; s.verLunas = false; s.verConstelaciones = false;
  s.verViaLactea = true; s.luzReal = false;
  sky.starUni.uGamma.value = POSTAL_BRILLO;
  sky.starUni.uLimit.value = POSTAL_MAG;
  sky.mwUni.uInt.value = POSTAL_VL;
  camera.fov = 30;
  camera.aspect = w / h;
  // el lado corto del encuadre abarca mitadAU
  const corto = Math.min(1, camera.aspect);
  s.dist = s.distTarget = mitadAU * AU / (Math.tan(camera.fov / 2 * DEG) * corto);

  // Plutón queda fuera del encuadre de la postal: ni su punto ni su órbita
  scene.remove(porId.pluton.pivot);
  if (orbitas.pluton) scene.remove(orbitas.pluton);

  renderer.setPixelRatio(1);
  // los puntos de la nube van en píxeles físicos: con ratio 1 el factor sobra
  nubeBelt.material.uniforms.uPix.value = 1;
  nubeTno.material.uniforms.uPix.value = 1;
  renderer.setSize(w, h, false);
  camera.updateProjectionMatrix();
  renderCuadro(0);
  const url = canvas.toDataURL('image/png');

  const marcas = {};
  for (const id of ids){
    const c = porId[id];
    _pv.copy(c.rel).project(camera);
    marcas[id] = { x:(_pv.x * 0.5 + 0.5) * w, y:(-_pv.y * 0.5 + 0.5) * h, nombre:c.def.nombre };
  }

  scene.add(porId.pluton.pivot);
  if (orbitas.pluton) scene.add(orbitas.pluton);

  s.mode = prev.mode; s.focus = prev.focus; s.yaw = prev.yaw; s.pitch = prev.pitch;
  s.dist = prev.dist; s.distTarget = prev.distTarget;
  s.camKm[0] = prev.cam[0]; s.camKm[1] = prev.cam[1]; s.camKm[2] = prev.cam[2];
  freeYaw = prev.fYaw; freePitch = prev.fPitch; freeRoll = prev.fRoll;
  s.sizeScale = prev.sizeScale; s.verOrbitas = prev.verOrbitas; s.verAsteroides = prev.verAsteroides;
  s.verTrans = prev.verTrans;
  s.verSondas = prev.verSondas; s.verLunas = prev.verLunas; s.verConstelaciones = prev.verConstelaciones;
  s.verViaLactea = prev.verViaLactea; s.luzReal = prev.luzReal;
  camera.fov = prev.fov;
  sky.starUni.uGamma.value = prev.gamma;
  sky.starUni.uLimit.value = prev.mag;
  sky.mwUni.uInt.value = prev.mw;
  renderer.setPixelRatio(prev.pr);
  nubeBelt.material.uniforms.uPix.value = prev.nubePix;
  nubeTno.material.uniforms.uPix.value = prev.nubePix;
  redimensionar();
  renderCuadro(0);
  return { url, marcas };
}

/* Fase lunar en tres capas: disco en sombra, mitad iluminada y elipse del
   terminador. Convención del hemisferio norte: creciente ilumina la derecha. */
function dibujarFaseLunar(ctx, x, y, r, f, creciente){
  const SOMBRA = '#1a1e27', LUZ = '#e9e3d6';
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = SOMBRA;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = LUZ;
  ctx.fillRect(creciente ? x : x - r, y - r, r, r * 2);
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(r * Math.abs(2 * f - 1), 0.01), r, 0, 0, Math.PI * 2);
  ctx.fillStyle = f >= 0.5 ? LUZ : SOMBRA;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(140,150,166,.45)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

const cargarImg = url => new Promise((ok, mal) => {
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = mal;
  im.src = url;
});

/* Composición editorial: render + penumbras + rótulos + escala + créditos. */
async function componerPostal(W, H){
  const jd = state.jd;
  try {
    if (document.fonts && document.fonts.load) await Promise.all([
      '400 10px "IBM Plex Serif"', '500 10px "IBM Plex Sans Condensed"',
      '600 10px "IBM Plex Sans Condensed"', '400 10px "IBM Plex Mono"'
    ].map(f => document.fonts.load(f)));
  } catch (e) { /* sin fuentes web queda la pila de respaldo */ }

  const u = Math.min(W, H) / 1000;
  const R = Math.round(180 * u);   // radio del detalle interior
  const ext = renderCenital(W, H, POSTAL_MITAD, ['jupiter','saturno','urano','neptuno']);
  const inte = renderCenital(R * 2, R * 2, POSTAL_INT, ['sol','mercurio','venus','tierra','marte']);
  const [imX, imI] = await Promise.all([cargarImg(ext.url), cargarImg(inte.url)]);

  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');

  const SERIF = '"IBM Plex Serif",Georgia,serif';
  const COND  = '"IBM Plex Sans Condensed","Helvetica Neue",Arial,sans-serif';
  const MONO  = '"IBM Plex Mono",ui-monospace,Menlo,monospace';
  const INK = '#ece6da', INK2 = 'rgba(226,232,240,.78)', MUTED = 'rgba(150,158,172,.85)',
        SIGNAL = '#ff5b41', RULE = 'rgba(140,150,166,.38)';
  const esp = (px, em) => { ctx.letterSpacing = (px * em).toFixed(2) + 'px'; };
  const sinEsp = () => { ctx.letterSpacing = '0px'; };

  ctx.drawImage(imX, 0, 0, W, H);

  // penumbras arriba y abajo para asegurar la lectura
  let g = ctx.createLinearGradient(0, 0, 0, 250 * u);
  g.addColorStop(0, 'rgba(5,6,10,.62)'); g.addColorStop(1, 'rgba(5,6,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 250 * u);
  g = ctx.createLinearGradient(0, H, 0, H - 300 * u);
  g.addColorStop(0, 'rgba(5,6,10,.66)'); g.addColorStop(1, 'rgba(5,6,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, H - 300 * u, W, 300 * u);

  // marcas de esquina, como los paneles del simulador
  const me = 30 * u, brazo = 22 * u;
  ctx.strokeStyle = RULE; ctx.lineWidth = Math.max(1, 1.3 * u);
  for (const [cx, cy, sx, sy] of [[me, me, 1, 1], [W - me, me, -1, 1], [W - me, H - me, -1, -1], [me, H - me, 1, -1]]){
    ctx.beginPath();
    ctx.moveTo(cx + sx * brazo, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * brazo);
    ctx.stroke();
  }

  // cabecera
  const x0 = 64 * u;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MUTED; ctx.font = '600 ' + (21 * u) + 'px ' + COND;
  esp(21 * u, .3);
  ctx.fillText('SISTEMA SOLAR · VISTA CENITAL', x0, 97 * u);
  sinEsp();
  ctx.fillStyle = INK; ctx.font = '400 ' + (58 * u) + 'px ' + SERIF;
  ctx.fillText(fechaLarga(jd), x0, 161 * u);
  ctx.fillStyle = MUTED; ctx.font = '400 ' + (15 * u) + 'px ' + MONO;
  esp(15 * u, .1);
  ctx.fillText(DIAS_POSTAL[jdToDate(jd).getUTCDay()] + '  ·  ' + horaTxt(jd), x0, 196 * u);
  sinEsp();

  // dedicatoria opcional bajo la fecha
  const campoDedic = $('#postalDedic');
  const dedicatoria = ((campoDedic && campoDedic.value) || '').trim();
  const yCabecera = (dedicatoria ? 268 : 232) * u;   // zona reservada para los rótulos
  if (dedicatoria){
    let fs = 26 * u;
    ctx.font = 'italic 400 ' + fs + 'px ' + SERIF;
    while (ctx.measureText(dedicatoria).width > W - 2 * x0 && fs > 13 * u){
      fs -= 1.5 * u;
      ctx.font = 'italic 400 ' + fs + 'px ' + SERIF;
    }
    ctx.fillStyle = 'rgba(226,232,240,.85)';
    ctx.fillText(dedicatoria, x0, 242 * u);
  }

  // fase lunar del día, con la geometría real Sol–Tierra–Luna del simulador
  const pE = porId.tierra.pos, pM = porId.luna.pos;
  const vs = [-pM[0], -pM[1], -pM[2]], vt = [pE[0] - pM[0], pE[1] - pM[1], pE[2] - pM[2]];
  const cosF = (vs[0]*vt[0] + vs[1]*vt[1] + vs[2]*vt[2]) /
               ((Math.hypot(vs[0], vs[1], vs[2]) * Math.hypot(vt[0], vt[1], vt[2])) || 1);
  const fl = (1 + Math.max(-1, Math.min(1, cosF))) / 2;
  let elong = Math.atan2(pM[1] - pE[1], pM[0] - pE[0]) - Math.atan2(-pE[1], -pE[0]);
  elong = ((elong % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const creciente = elong < Math.PI;
  const nombreFase = fl < .03 ? 'LUNA NUEVA'
    : fl > .97 ? 'LUNA LLENA'
    : Math.abs(fl - .5) < .035 ? (creciente ? 'CUARTO CRECIENTE' : 'CUARTO MENGUANTE')
    : creciente ? 'LUNA CRECIENTE' : 'LUNA MENGUANTE';
  ctx.lineWidth = Math.max(1, 1.1 * u);
  dibujarFaseLunar(ctx, W - 89 * u, 108 * u, 24 * u, fl, creciente);
  ctx.fillStyle = MUTED; ctx.font = '400 ' + (12.5 * u) + 'px ' + MONO;
  ctx.textAlign = 'right';
  esp(12.5 * u, .12);
  ctx.fillText(nombreFase + ' · ' + Math.round(fl * 100) + '%', W - 64 * u, 162 * u);
  sinEsp();
  ctx.textAlign = 'left';

  // geometría del detalle interior (los rótulos también la usan para esquivarlo)
  const rInt = POSTAL_INT / POSTAL_MITAD * Math.min(W, H) / 2;
  const icx = W - 64 * u - R, icy = H - 92 * u - R;

  // etiquetas de los planetas exteriores, radiales desde el centro; si el
  // rótulo cae sobre un bloque de texto o fuera del marco, se voltea hacia dentro
  const cx0 = W / 2, cy0 = H / 2;
  ctx.font = '500 ' + (15 * u) + 'px ' + COND;
  esp(15 * u, .14);
  const cabe = (x1, x2, ty) => {
    if (x1 < 42 * u || x2 > W - 42 * u || ty < 48 * u || ty > H - 48 * u) return false;
    if (x2 > W - 320 * u && ty < 212 * u) return false;      // fase lunar
    if (x1 < 750 * u && ty < yCabecera) return false;        // cabecera y dedicatoria
    if (x1 < 760 * u && ty > H - 152 * u) return false;      // pie y barra de escala
    const px = Math.max(x1, Math.min(icx, x2));
    return Math.hypot(px - icx, ty - icy) > R + 34 * u;      // detalle interior
  };
  for (const id of ['jupiter','saturno','urano','neptuno']){
    const m = ext.marcas[id];
    const nombre = m.nombre.toUpperCase();
    const tw = ctx.measureText(nombre).width;
    let ux = m.x - cx0, uy = m.y - cy0;
    const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
    const ancla = (ax, ay) => {
      const tx = m.x + ax * 27 * u, ty = m.y + ay * 27 * u;
      const x1 = ax > .35 ? tx : ax < -.35 ? tx - tw : tx - tw / 2;
      return { tx, ty, x1, x2: x1 + tw };
    };
    let a = ancla(ux, uy);
    if (!cabe(a.x1, a.x2, a.ty)){ ux = -ux; uy = -uy; a = ancla(ux, uy); }
    ctx.strokeStyle = 'rgba(190,200,215,.4)'; ctx.lineWidth = Math.max(1, u);
    ctx.beginPath();
    ctx.moveTo(m.x + ux * 7 * u, m.y + uy * 7 * u);
    ctx.lineTo(m.x + ux * 21 * u, m.y + uy * 21 * u);
    ctx.stroke();
    ctx.fillStyle = INK2;
    ctx.textAlign = ux > .35 ? 'left' : ux < -.35 ? 'right' : 'center';
    ctx.textBaseline = uy > .35 ? 'top' : uy < -.35 ? 'bottom' : 'middle';
    ctx.fillText(nombre, a.tx, a.ty);
  }
  sinEsp();

  // marcador del sistema interior en la vista principal + conector al detalle
  ctx.strokeStyle = RULE; ctx.lineWidth = Math.max(1, u);
  ctx.beginPath(); ctx.arc(cx0, cy0, rInt + 4 * u, 0, Math.PI * 2); ctx.stroke();
  {
    let vx = icx - cx0, vy = icy - cy0;
    const L = Math.hypot(vx, vy) || 1; vx /= L; vy /= L;
    ctx.setLineDash([2 * u, 6 * u]);
    ctx.beginPath();
    ctx.moveTo(cx0 + vx * (rInt + 10 * u), cy0 + vy * (rInt + 10 * u));
    ctx.lineTo(icx - vx * (R + 9 * u), icy - vy * (R + 9 * u));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // detalle circular del sistema interior
  ctx.save();
  ctx.beginPath(); ctx.arc(icx, icy, R, 0, Math.PI * 2); ctx.clip();
  ctx.drawImage(imI, icx - R, icy - R, R * 2, R * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(150,160,175,.6)'; ctx.lineWidth = Math.max(1, 1.2 * u);
  ctx.beginPath(); ctx.arc(icx, icy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = MUTED; ctx.font = '400 ' + (12.5 * u) + 'px ' + MONO;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  esp(12.5 * u, .14);
  ctx.fillText('SISTEMA INTERIOR', icx, icy + R + 13 * u);
  sinEsp();

  // etiquetas del detalle; la Tierra lleva el acento
  ctx.font = '500 ' + (13.5 * u) + 'px ' + COND;
  for (const id of ['sol','mercurio','venus','tierra','marte']){
    const m = inte.marcas[id];
    const X = icx - R + m.x, Y = icy - R + m.y;
    let ux = m.x - R, uy = m.y - R;
    let L = Math.hypot(ux, uy);
    if (L < 1){ ux = 0; uy = 1; L = 1; }          // el Sol: etiqueta hacia abajo
    ux /= L; uy /= L;
    if (L + 30 * u > R - 14 * u){ ux = -ux; uy = -uy; }   // cerca del borde, rótulo hacia dentro
    const tierra = id === 'tierra';
    if (tierra){
      ctx.strokeStyle = 'rgba(255,91,65,.75)'; ctx.lineWidth = Math.max(1, 1.1 * u);
      ctx.beginPath(); ctx.arc(X, Y, 6.5 * u, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = tierra ? SIGNAL : INK2;
    ctx.textAlign = ux > .35 ? 'left' : ux < -.35 ? 'right' : 'center';
    ctx.textBaseline = uy > .35 ? 'top' : uy < -.35 ? 'bottom' : 'middle';
    esp(13.5 * u, .12);
    ctx.fillText(m.nombre.toUpperCase(), X + ux * (tierra ? 13 : 10) * u, Y + uy * (tierra ? 13 : 10) * u);
    sinEsp();
  }

  // barra de escala: 10 UA medidas sobre el propio render
  const pxAU = Math.min(W, H) / 2 / POSTAL_MITAD;
  const bx = x0, by = H - 122 * u, bl = 10 * pxAU;
  ctx.strokeStyle = RULE; ctx.lineWidth = Math.max(1, u);
  ctx.beginPath();
  ctx.moveTo(bx, by - 6 * u); ctx.lineTo(bx, by);
  ctx.lineTo(bx + bl, by); ctx.lineTo(bx + bl, by - 6 * u);
  ctx.stroke();
  ctx.fillStyle = MUTED; ctx.font = '400 ' + (12.5 * u) + 'px ' + MONO;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  esp(12.5 * u, .1);
  ctx.fillText('10 UA', bx + bl + 12 * u, by - 3 * u);

  // pie: método y, en el sitio, el enlace que restaura esta fecha
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('DISTANCIAS Y POSICIONES REALES · DATOS: NASA · JPL', x0, H - 86 * u);
  sinEsp();
  if (typeof ES_SITIO !== 'undefined' && ES_SITIO){
    ctx.fillStyle = 'rgba(232,177,92,.9)';
    ctx.font = '400 ' + (12.5 * u) + 'px ' + MONO;
    esp(12.5 * u, .06);
    const ruta = (urlBase || '/').replace(/index\.html$/, '');
    ctx.fillText(location.host + ruta + 'fecha/' + jdToDate(jd).toISOString().slice(0, 10), x0, H - 62 * u);
    sinEsp();
  }

  return out;
}

/* ---------- modal ---------- */
function previsualizarPostal(){
  const gen = ++postalGen;
  const img = $('#postalImg');
  img.classList.remove('lista');
  $('#postalCarga').style.display = '';
  const d = POSTAL_DIM[postalFmt];
  const k = 760 / Math.max(d.w, d.h);
  componerPostal(Math.round(d.w * k), Math.round(d.h * k)).then(cv => {
    if (gen !== postalGen) return;
    img.onload = () => {
      if (gen !== postalGen) return;
      img.classList.add('lista');
      $('#postalCarga').style.display = 'none';
    };
    img.src = cv.toDataURL('image/png');
  }).catch(() => {
    if (gen === postalGen) $('#postalCarga').textContent = 'no se pudo generar';
  });
}

function elegirFormato(f){
  if (postalFmt === f) return;
  postalFmt = f;
  $('#fmtH').classList.toggle('activo', f === 'h');
  $('#fmtV').classList.toggle('activo', f === 'v');
  $('#fmtC').classList.toggle('activo', f === 'c');
  previsualizarPostal();
}

function abrirPostal(){
  postalPlayingAntes = state.playing;
  state.playing = false;                 // el reloj se detiene mientras se elige
  sincronizar();
  document.body.classList.remove('menu');
  $('#postalTitulo').textContent = fechaLarga(state.jd);
  $('#postalCarga').textContent = 'componiendo…';
  $('#postal').classList.add('abierto');
  previsualizarPostal();
}

function cerrarPostal(){
  const p = $('#postal');
  if (!p.classList.contains('abierto')) return;
  postalGen++;
  p.classList.remove('abierto');
  if (postalPlayingAntes !== null){
    state.playing = postalPlayingAntes;
    postalPlayingAntes = null;
    sincronizar();
  }
}

function descargarPostal(){
  const btn = $('#btnDescargarPostal');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'componiendo…';
  const cap = (renderer.capabilities && renderer.capabilities.maxTextureSize) || 4096;
  const d = POSTAL_DIM[postalFmt];
  const k = Math.min(1, cap / Math.max(d.w, d.h));
  const fin = () => { btn.disabled = false; btn.textContent = 'Descargar PNG'; };
  componerPostal(Math.round(d.w * k), Math.round(d.h * k)).then(cv => {
    cv.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'sistema-solar-' + jdToDate(state.jd).toISOString().slice(0, 10) + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      fin();
    }, 'image/png');
  }).catch(() => { fin(); aviso('No se pudo generar la postal en este navegador.'); });
}

$('#btnPostal').onclick = abrirPostal;
$('#btnPostal2').onclick = abrirPostal;
$('#cerrarPostal').onclick = cerrarPostal;
$('#fmtH').onclick = () => elegirFormato('h');
$('#fmtV').onclick = () => elegirFormato('v');
$('#fmtC').onclick = () => elegirFormato('c');
let dedicT = null;
$('#postalDedic').addEventListener('input', () => {
  clearTimeout(dedicT);
  dedicT = setTimeout(() => {
    if ($('#postal').classList.contains('abierto')) previsualizarPostal();
  }, 650);
});
$('#btnDescargarPostal').onclick = descargarPostal;
$('#postal').addEventListener('click', e => { if (e.target.id === 'postal') cerrarPostal(); });

window.sistemaSolar.abrirPostal = abrirPostal;
window.sistemaSolar.componerPostal = componerPostal;
