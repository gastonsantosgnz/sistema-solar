/* ============================================================
   SONIDO HONESTO — todo sintetizado con WebAudio, cero archivos.
   Solo suena lo que físicamente podría oírse: el empuje de la
   propia nave (vibración estructural: ruido grave filtrado que
   sigue la rampa de empuje) y la sonificación de magnetosferas
   al acercarse a los cuerpos con campo — pares de osciladores
   graves con batidos lentos, al estilo de las sonificaciones de
   la NASA. Apagado por defecto; el contexto nace en el primer
   gesto (política de autoplay). Toda ganancia cambia con rampas:
   sin pops. En momentos y en el comparador, silencio.
   ============================================================ */

const CAMPOS_SND = [
  { id: 'jupiter', f: 34, bat: 1.7, alcance: 90, nivel: 0.42 },
  { id: 'saturno', f: 46, bat: 1.1, alcance: 60, nivel: 0.34 },
  { id: 'tierra',  f: 62, bat: 2.3, alcance: 30, nivel: 0.30 },
  { id: 'sol',     f: 23, bat: 0.6, alcance: 45, nivel: 0.40 }
];
let sndCtx = null, sndMaster = null, sndEmpGain = null, sndEmpFiltro = null;
const sndCampos = [];

function crearAudio(){
  if (sndCtx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  sndCtx = new AC();
  const comp = sndCtx.createDynamicsCompressor();   // seguro contra saturación
  comp.connect(sndCtx.destination);
  sndMaster = sndCtx.createGain();
  sndMaster.gain.value = 0;
  sndMaster.connect(comp);

  // empuje: ruido en bucle → paso-bajas → ganancia
  const buf = sndCtx.createBuffer(1, sndCtx.sampleRate * 2, sndCtx.sampleRate);
  const datos = buf.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  const fuente = sndCtx.createBufferSource();
  fuente.buffer = buf;
  fuente.loop = true;
  sndEmpFiltro = sndCtx.createBiquadFilter();
  sndEmpFiltro.type = 'lowpass';
  sndEmpFiltro.frequency.value = 80;
  sndEmpFiltro.Q.value = 0.8;
  sndEmpGain = sndCtx.createGain();
  sndEmpGain.gain.value = 0;
  fuente.connect(sndEmpFiltro);
  sndEmpFiltro.connect(sndEmpGain);
  sndEmpGain.connect(sndMaster);
  fuente.start();

  // sonificación: dos senos desafinados (el batido es la voz) + respiración lenta
  for (const c of CAMPOS_SND){
    const g = sndCtx.createGain();
    g.gain.value = 0;
    g.connect(sndMaster);
    const sub = sndCtx.createGain();
    sub.gain.value = 0.72;
    sub.connect(g);
    const o1 = sndCtx.createOscillator();
    const o2 = sndCtx.createOscillator();
    o1.frequency.value = c.f;
    o2.frequency.value = c.f + c.bat;
    o1.connect(sub); o2.connect(sub);
    const lfo = sndCtx.createOscillator();
    lfo.frequency.value = 0.05 + c.bat * 0.03;
    const lfoG = sndCtx.createGain();
    lfoG.gain.value = 0.26;
    lfo.connect(lfoG);
    lfoG.connect(sub.gain);
    o1.start(); o2.start(); lfo.start();
    sndCampos.push({ c, g });
  }
  return true;
}

function alternarSonido(){
  state.sonido = !state.sonido;
  if (state.sonido && !crearAudio()) state.sonido = false;
  if (sndCtx){
    if (state.sonido && sndCtx.state === 'suspended') sndCtx.resume();
    sndMaster.gain.setTargetAtTime(state.sonido ? 0.8 : 0, sndCtx.currentTime, 0.15);
  }
  sincronizar();
}

/* llamado cada cuadro desde paso(): fija los objetivos de las rampas */
function actualizarSonido(){
  if (!sndCtx || !state.sonido) return;
  const t = sndCtx.currentTime;
  const callar = state.enMomento || state.comparando;

  // empuje de la nave: sigue la rampa real; Shift lo engorda
  const emp = (!callar && state.mode === 'free')
    ? Math.min(1, intEmpuje * (teclas['shift'] ? 1.5 : 1)) : 0;
  sndEmpGain.gain.setTargetAtTime(emp * 0.5, t, 0.09);
  sndEmpFiltro.frequency.setTargetAtTime(70 + 170 * emp, t, 0.18);

  // magnetosferas: cada campo sube al acercarse a su cuerpo
  for (const s of sndCampos){
    const cu = porId[s.c.id];
    let p = 0;
    if (!callar){
      const x = (cu.dist / radioEfectivo(cu) - 1) / s.c.alcance;
      p = Math.max(0, 1 - x);
    }
    s.g.gain.setTargetAtTime(p * p * s.c.nivel, t, 0.35);
  }
}

$('#tSonido').onclick = alternarSonido;
window.sistemaSolar.sonido = alternarSonido;
