/* ============================================================
   CÁMARA Y BUCLE DE RENDER
   ============================================================ */

const camQ = new THREE.Quaternion();
const _tA = new THREE.Vector3(), _tB = new THREE.Vector3(), _tC = new THREE.Vector3();
const SOMBRAS = [
  ['tierra', ['luna']],
  ['luna', ['tierra']],
  ['jupiter', ['io','europa','ganimedes','calisto']],
  ['saturno', ['titan','rea','encelado']]
];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const EJE_Y = V3(0,1,0), EJE_Z = V3(0,0,1);

let freeYaw = 0, freePitch = 0, freeRoll = 0;
const teclas = {};

function dirDesde(yaw, pitch){
  const cp = Math.cos(pitch);
  return [Math.cos(yaw)*cp, Math.sin(yaw)*cp, Math.sin(pitch)];
}

/* distancia de encuadre agradable para un cuerpo */
function encuadre(c){
  return Math.max(radioEfectivo(c) * 3.4, c.def.r * 2.6, 60);
}

function enfocar(id, instant){
  const c = porId[id]; if (!c) return;
  const p = c.pos;
  const dx = state.camKm[0]-p[0], dy = state.camKm[1]-p[1], dz = state.camKm[2]-p[2];
  const d = Math.hypot(dx,dy,dz);
  if (d > 1e-6 && !instant){
    state.dist = d;
    state.yaw = Math.atan2(dy, dx);
    state.pitch = Math.asin(Math.max(-1,Math.min(1, dz/d)));
  }
  state.focus = id;
  state.mode = 'orbit';
  state.distTarget = instant ? encuadre(c) : encuadre(c);
  if (instant) state.dist = state.distTarget;
  actualizarPanel();
}

/* distancia a la superficie más cercana (para escalar la velocidad libre) */
function distSuperficieMin(){
  let best = Infinity;
  for (const c of cuerpos){
    const d = Math.hypot(c.pos[0]-state.camKm[0], c.pos[1]-state.camKm[1], c.pos[2]-state.camKm[2]) - radioEfectivo(c);
    if (d < best) best = d;
  }
  return Math.max(best, 0.5);
}

function actualizarCamara(dt){
  if (state.mode === 'orbit'){
    const c = porId[state.focus];
    // aproximación exponencial a la distancia objetivo
    const k = 1 - Math.exp(-dt * 3.2);
    state.dist += (state.distTarget - state.dist) * k;
    const rmin = radioEfectivo(c) * 1.02 + 1;
    if (state.dist < rmin) state.dist = rmin;
    const d = dirDesde(state.yaw, state.pitch);
    state.camKm[0] = c.pos[0] + d[0]*state.dist;
    state.camKm[1] = c.pos[1] + d[1]*state.dist;
    state.camKm[2] = c.pos[2] + d[2]*state.dist;
    // mirar al objetivo
    _v.set(-d[0], -d[1], -d[2]);
    _m.lookAt(V3(0,0,0), _v, EJE_Z);
    camQ.setFromRotationMatrix(_m);
    freeYaw = state.yaw + Math.PI/2; freePitch = -state.pitch; freeRoll = 0;
  } else {
    // vuelo libre
    _q.setFromAxisAngle(EJE_Z, freeYaw);
    const qp = new THREE.Quaternion().setFromAxisAngle(V3(1,0,0), freePitch + Math.PI/2);
    const qr = new THREE.Quaternion().setFromAxisAngle(V3(0,0,1), freeRoll);
    camQ.copy(_q).multiply(qp).multiply(qr);

    const base = distSuperficieMin() * 0.55 + 2;
    let v = Math.min(base, 4e9);
    if (teclas['shift']) v *= 22;
    if (teclas['control']) v *= 0.06;
    const fwd = V3(0,0,-1).applyQuaternion(camQ);
    const right = V3(1,0,0).applyQuaternion(camQ);
    const up = V3(0,1,0).applyQuaternion(camQ);
    let ax = 0, ay = 0, az = 0;
    if (teclas['w']) { ax += fwd.x; ay += fwd.y; az += fwd.z; }
    if (teclas['s']) { ax -= fwd.x; ay -= fwd.y; az -= fwd.z; }
    if (teclas['d']) { ax += right.x; ay += right.y; az += right.z; }
    if (teclas['a']) { ax -= right.x; ay -= right.y; az -= right.z; }
    if (teclas['r'] || teclas[' ']) { ax += up.x; ay += up.y; az += up.z; }
    if (teclas['f']) { ax -= up.x; ay -= up.y; az -= up.z; }
    const L = Math.hypot(ax,ay,az);
    if (L > 0){ state.camKm[0] += ax/L*v*dt; state.camKm[1] += ay/L*v*dt; state.camKm[2] += az/L*v*dt; }
    if (teclas['q']) freeRoll += dt * 1.1;
    if (teclas['e']) freeRoll -= dt * 1.1;
  }
  camera.quaternion.copy(camQ);
  camera.position.set(0,0,0);
  camera.updateMatrixWorld(true);
  skyCam.quaternion.copy(camQ);
  skyCam.updateMatrixWorld(true);
}

/* ---------- ciclo ---------- */
const sunDirW = new THREE.Vector3();
const invQ = new THREE.Quaternion();
let ultimo = performance.now();
let fps = 60, fpsAcc = 0, fpsN = 0;

function paso(ahora){
  requestAnimationFrame(paso);
  let dt = (ahora - ultimo) / 1000; ultimo = ahora;
  if (dt > 0.25) dt = 0.25;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5){ fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }

  if (state.viaje){
    /* viaje en el tiempo: el reloj barre de una fecha a otra con easing,
       y los planetas recorren sus órbitas reales por el camino          */
    const v = state.viaje;
    const u = Math.min(1, (ahora - v.t0) / v.dur);
    const e = u < 0.5 ? 4*u*u*u : 1 - Math.pow(-2*u + 2, 3) / 2;
    state.jd = v.desde + (v.hasta - v.desde) * e;
    if (u >= 1){
      state.jd = v.hasta;
      const fin = v.alTerminar;
      state.viaje = null;
      if (fin) fin();
    }
  } else if (state.playing) state.jd += state.rate * dt;
  renderCuadro(dt);
  actualizarHUD();
}

/* Un cuadro completo: posiciones, cámara, escena y render. Separado de
   paso() para poder renderizar fuera del ciclo rAF (p. ej. la postal). */
function renderCuadro(dt){
  actualizarPosiciones(state.jd);
  actualizarCamara(dt);

  const cam = state.camKm;
  const sol = porId.sol.pos;
  const T = state.jd - J2000;

  for (const c of cuerpos){
    if (c.esLuna && !lunasVisibles()){ c.pivot.visible = false; continue; }
    if (c.def.sonda && (!state.verSondas || !c.lanzada)){ c.pivot.visible = false; continue; }
    c.pivot.visible = true;

    const dx = c.pos[0]-cam[0], dy = c.pos[1]-cam[1], dz = c.pos[2]-cam[2];
    const dist = Math.hypot(dx,dy,dz);
    c.dist = dist;
    c.rel.set(dx/U, dy/U, dz/U);
    c.pivot.position.copy(c.rel);

    const rEf = radioEfectivo(c);
    c.mesh.scale.setScalar(rEf/U);
    if (c.atm)   c.atm.scale.setScalar(rEf/U * (c.def.id==='tierra'?1.018:1.026));
    if (c.nubes) c.nubes.scale.setScalar(rEf/U * 1.006);
    if (c.ring)  c.ring.scale.setScalar(rEf/U);

    // orientación del eje + rotación propia
    _q.setFromUnitVectors(EJE_Y, c.axis);
    c.pivot.quaternion.copy(_q);
    c.uni.uEje.value.copy(c.axis);
    const per = c.def.rot || 1;
    let spin = c.fase + (T / per) * Math.PI * 2;
    if (c.def.id === 'luna'){
      // amarre de marea real: el mismo hemisferio siempre mira a la Tierra
      const tp = porId.tierra.pos;
      _tA.set(tp[0]-c.pos[0], tp[1]-c.pos[1], tp[2]-c.pos[2]).normalize();
      const qi = c.pivot.quaternion.clone().invert();
      _tA.applyQuaternion(qi);
      spin = Math.atan2(-_tA.z, _tA.x);
    }
    c.mesh.quaternion.setFromAxisAngle(EJE_Y, spin);
    if (c.nubes) c.nubes.quaternion.setFromAxisAngle(EJE_Y, spin + T * 0.11);  // las nubes derivan

    // iluminación
    const rSol = c.def.id === 'sol' ? 1 : Math.hypot(c.pos[0]-sol[0], c.pos[1]-sol[1], c.pos[2]-sol[2]);
    sunDirW.set(sol[0]-c.pos[0], sol[1]-c.pos[1], sol[2]-c.pos[2]).normalize();
    c.uni.uSunDir.value.copy(sunDirW);
    const rel = AU / Math.max(rSol, 1);
    c.uni.uLight.value = state.luzReal ? Math.min(rel*rel, 12)
                       : Math.min(Math.pow(rel, 0.32) * 1.05, 1.22);   // sin quemar a Mercurio
    c.uni.uTime.value = T;
    // nivel de detalle procedural según el tamaño en pantalla
    c.uni.uDetail.value = Math.min(1, Math.max(0, (rEf/dist) * 900));

    if (c.ring){
      c.runi.uLight.value = c.uni.uLight.value;
      c.ring.getWorldQuaternion(invQ).invert();
      c.runi.uSunObj.value.copy(sunDirW).applyQuaternion(invQ);
    }
    c.mesh.getWorldQuaternion(invQ).invert();
    c.uni.uSunObj.value.copy(sunDirW).applyQuaternion(invQ);

    /* destello para cuerpos que quedan por debajo de unos píxeles */
    const pxRad = (rEf/dist) / Math.tan(camera.fov*DEG/2) * (renderer.domElement.height/renderer.getPixelRatio()) / 2;
    c.pxRad = pxRad;
    const mostrar = pxRad < 9 && dist > rEf*1.2;
    c.glow.visible = mostrar;
    if (mostrar){
      const pxDeseado = Math.max(2.6, pxRad*2.0) * 5.2;
      const mundo = pxDeseado * 2 * Math.tan(camera.fov*DEG/2) / (renderer.domElement.height/renderer.getPixelRatio()) * (dist/U);
      c.glow.scale.setScalar(mundo);
      let br = c.def.sonda ? 0.85
             : c.def.id === 'sol' ? 1
             : Math.min(1, (c.def.r*c.def.r) / (rSol/AU) / (dist/AU) / 4e6);
      br = Math.max(br, 0.05);
      c.glow.material.opacity = Math.min(1, br) * Math.min(1, 1.2 - pxRad/9);
    }
    if (c.corona){
      const cor = Math.max(rEf*7.5, dist*0.006);
      c.corona.scale.setScalar(cor/U);
      c.corona.material.opacity = 0.9;
    }
  }

  /* sombras de eclipse: qué cuerpos pueden tapar el Sol desde cada superficie */
  for (const [bid, cids] of SOMBRAS){
    const b = porId[bid];
    let nc = 0;
    for (const cid of cids){
      const cc = porId[cid];
      b.uni.uCast.value[nc].set(cc.rel.x, cc.rel.y, cc.rel.z, cc.def.r/U);
      nc++;
    }
    b.uni.uNumCast.value = nc;
    b.uni.uSunPos.value.copy(porId.sol.rel);
  }

  /* colas de cometa: crecen al acercarse al Sol, siempre antisolares */
  for (const c of cuerpos){
    if (!c.cola) continue;
    if (!state.verAsteroides && state.focus !== c.def.id){ c.cola.visible = false; c.coma.visible = false; continue; }
    const rAU = Math.hypot(c.pos[0]-sol[0], c.pos[1]-sol[1], c.pos[2]-sol[2]) / AU;
    const act = Math.max(0, Math.min(1, 1.15/(rAU*rAU) - 0.05));
    if (act < 0.012){ c.cola.visible = false; c.coma.visible = false; continue; }
    const L = Math.min(0.34*AU, 0.26*AU*act) / U;
    const W = L * 0.085;
    _tA.set(c.pos[0]-sol[0], c.pos[1]-sol[1], c.pos[2]-sol[2]).normalize(); // antisolar
    _tB.copy(c.rel).normalize();                                            // hacia el cometa
    _tC.crossVectors(_tA, _tB);
    if (_tC.lengthSq() < 1e-8) _tC.set(0,0,1); else _tC.normalize();        // "derecha"
    _tB.crossVectors(_tC, _tA);                                             // normal hacia cámara
    const M = c.cola.matrix;
    M.set(_tC.x*W, _tA.x*L, _tB.x, c.rel.x,
          _tC.y*W, _tA.y*L, _tB.y, c.rel.y,
          _tC.z*W, _tA.z*L, _tB.z, c.rel.z,
          0, 0, 0, 1);
    c.cola.visible = true;
    // dentro de la cola no hay pared: desvanecer cuando la cámara está más
    // cerca que la longitud de la cola
    const dentro = Math.max(0, Math.min(1, c.dist / (L*U*1.6) - 0.12));
    c.cola.material.opacity = (0.22 + act*0.42) * dentro;
    c.coma.visible = true;
    const rEfC = radioEfectivo(c);
    c.coma.scale.setScalar(Math.max(rEfC*20, L*0.028));
    c.coma.material.opacity = 0.16 + act*0.30;
  }

  /* nube de asteroides */
  nubeJD.value = T;
  nubeCamKm.value.set(cam[0], cam[1], cam[2]);
  nubeBelt.visible = state.verAsteroides;
  nubeTno.visible = state.verTrans;

  // órbitas: las heliocéntricas viven en el Sol, las lunares en su planeta.
  // Se desvanecen al acercarse a un cuerpo para no ensuciar la vista.
  const solRel = V3(-cam[0]/U, -cam[1]/U, -cam[2]/U);
  const cf = porId[state.focus];
  const rf = Math.max(radioEfectivo(cf), 1);
  const vista = state.mode === 'orbit' ? state.dist : distSuperficieMin();
  const fade = Math.min(1, Math.max(0, Math.log(vista / (rf * 14)) / Math.log(60)));
  for (const def of BODIES){
    const l = orbitas[def.id]; if (!l) continue;
    l.position.copy(solRel);
    l.visible = state.verOrbitas && fade > 0.01;
    l.material.opacity = 0.22 * fade * (def.id === state.focus ? 2.4 : 1);
  }
  for (const m of MENORES){
    const l = orbitas[m.id]; if (!l) continue;
    l.position.copy(solRel);
    const activa = state.focus === m.id;
    l.visible = state.verOrbitas && fade > 0.01 && (state.verAsteroides || activa);
    l.material.opacity = (m.clase === 'comet' ? 0.22 : 0.15) * fade * (activa ? 2.2 : 1);
  }
  if (state.verOrbitas && state.verLunas && porId.tierra.dist < 384400*260) regeneraOrbitaLuna(state.jd);
  for (const m of MOONS){
    const l = orbitas[m.id]; if (!l) continue;
    const pa = porId[m.padre].pos;
    l.position.set((pa[0]-cam[0])/U, (pa[1]-cam[1])/U, (pa[2]-cam[2])/U);
    const dpa = porId[m.padre].dist;
    const f2 = Math.min(1, Math.max(0, Math.log(dpa / (m.a * 0.25)) / Math.log(24)))
             * Math.min(1, Math.max(0, 1 - Math.log(dpa / (m.a * 90)) / Math.log(14)));
    l.visible = state.verOrbitas && lunasVisibles() && f2 > 0.02;
    l.material.opacity = 0.30 * f2;
  }

  /* rutas de las sondas: se dibuja solo el tramo ya recorrido */
  for (const s of SONDAS){
    const l = rutas[s.id];
    const vis = state.verSondas && state.verOrbitas && state.jd > s.jd0;
    l.visible = vis;
    if (!vis) continue;
    l.position.copy(solRel);
    const hasta = Math.min(s.n, Math.max(2, Math.ceil((state.jd - s.jd0) / s.paso) + 1));
    l.geometry.setDrawRange(0, hasta);
    l.material.opacity = 0.30 * fade;
  }

  sky.uCamKm.value.set(cam[0], cam[1], cam[2]);
  sky.cons.visible = state.verConstelaciones;
  sky.mw.visible = state.verViaLactea;
  skyCam.fov = camera.fov; skyCam.aspect = camera.aspect; skyCam.updateProjectionMatrix();

  renderer.clear();
  renderer.render(sky.scene, skyCam);
  renderer.render(scene, camera);
}

function redimensionar(){
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w/h; camera.updateProjectionMatrix();
  skyCam.aspect = w/h; skyCam.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
