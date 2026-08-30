/* ============================================================
   VEHÍCULOS DEL VUELO LIBRE
   Registro escalable: cada vehículo es una función constructora
   que devuelve su malla (primitivas de Three, cero assets) y sus
   toberas. Se dibujan en una escena overlay con el depth limpio
   —nunca se hunden en un planeta— e iluminados desde donde está
   el Sol de verdad. Los propulsores siguen la rampa de empuje.
   El adorno es la nave; la física del vuelo no cambia.
   ============================================================ */

const escenaNave = new THREE.Scene();
const luzNave = new THREE.DirectionalLight(0xffffff, 1.35);
const luzNaveAmb = new THREE.AmbientLight(0xa8b0c4, 0.55);
escenaNave.add(luzNave, luzNaveAmb);

const NAVE_OFF = V3(0, -0.30, -1.55);        // posición en el encuadre (unidades de escena)
const naveCache = {};                         // id -> rig construido
let intEmpuje = 0;
const navQ = new THREE.Quaternion();
const _nv = new THREE.Vector3(), _nq = new THREE.Quaternion();

/* ---------- materiales y efectos compartidos ---------- */
const matLam = (c) => new THREE.MeshLambertMaterial({ color: c });
const matPho = (c, s) => new THREE.MeshPhongMaterial({ color: c, shininess: s });

function hazPluma(){
  const w = 64, h = 128, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  lg.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  lg.addColorStop(0.65, 'rgba(255,255,255,0.14)');
  lg.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h), px = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++){
      const u = (x - w/2) / (w/2);
      px[(y*w + x)*4 + 3] *= Math.exp(-u*u*3.4);
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const plumaTex = hazPluma();
const plumaGeo = new THREE.PlaneGeometry(1, 1);
plumaGeo.translate(0, -0.5, 0);              // ancla en la tobera, se alarga hacia atrás
plumaGeo.rotateX(-Math.PI / 2);              // el largo apunta a +z (popa)

/* una tobera: dos planos cruzados con gradiente + un núcleo brillante */
function toberaFX(color, ancho){
  const grp = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    map: plumaTex, color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const a = new THREE.Mesh(plumaGeo, mat);
  const b = new THREE.Mesh(plumaGeo, mat);
  b.rotation.z = Math.PI / 2;
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  core.scale.setScalar(ancho * 2.4);
  grp.add(a, b, core);
  grp.userData = { mat, core: core.material, ancho };
  return grp;
}

function pieza(padre, geo, mat, x, y, z, rx, ry, rz){
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.rotation.set(rx || 0, ry || 0, rz || 0);
  padre.add(m);
  return m;
}

/* ---------- la sonda (homenaje a las Voyager): plato, bus, brazos ---------- */
function construirSonda(){
  const g = new THREE.Group();
  const blanco = matLam(0xd9d5cb), oro = matLam(0x9c7b3c),
        gris = matLam(0x8b929e), oscuro = matLam(0x3a3f4a);

  // plato parabólico mirando al frente
  const perfil = [];
  for (let i = 0; i <= 10; i++){
    const t = i / 10;
    perfil.push(new THREE.Vector2(0.035 + 0.30 * t, 0.105 * t * t));
  }
  const plato = new THREE.LatheGeometry(perfil, 28);
  plato.rotateX(-Math.PI / 2);
  pieza(g, plato, blanco, 0, 0, -0.04);
  pieza(g, new THREE.ConeGeometry(0.02, 0.09, 10), gris, 0, 0, -0.12, Math.PI / 2);

  // bus decagonal forrado de kapton
  const bus = new THREE.CylinderGeometry(0.085, 0.085, 0.075, 10);
  bus.rotateX(Math.PI / 2);
  pieza(g, bus, oro, 0, 0, 0.065);

  // brazo del RTG (abajo-izquierda) con sus aletas
  pieza(g, new THREE.CylinderGeometry(0.007, 0.007, 0.30, 6), gris,
        -0.13, -0.08, 0.10, 0, 0, 1.05);
  for (let i = 0; i < 3; i++)
    pieza(g, new THREE.BoxGeometry(0.045, 0.02, 0.045), oscuro,
          -0.245 - i * 0.001, -0.155 - i * 0.024, 0.115);

  // brazo del magnetómetro (largo, al lado contrario)
  pieza(g, new THREE.CylinderGeometry(0.005, 0.005, 0.55, 6), gris,
        0.28, 0.05, 0.10, 0, 0, -1.35);
  // plataforma de instrumentos
  pieza(g, new THREE.BoxGeometry(0.05, 0.04, 0.06), gris, 0.10, 0.09, 0.09);

  // el disco de oro, en el costado del bus
  const disco = pieza(g, new THREE.CylinderGeometry(0.032, 0.032, 0.004, 20),
                      matLam(0xd7b25a), 0, 0.088, 0.065);
  disco.rotation.x = 0;                      // el eje del cilindro ya es +y: plano hacia afuera

  const fx = toberaFX(0x9fc4ff, 0.07);       // propulsión iónica: azul
  fx.position.set(0, 0, 0.115);
  g.add(fx);
  g.scale.setScalar(0.8);
  return { grupo: g, toberas: [fx], escala: 0.8 };
}

/* ---------- la nave: aluminio claro, alas en flecha, luces de navegación ---------- */
function construirNave(){
  const g = new THREE.Group();
  const casco = matPho(0xccd1d9, 30),        // aluminio claro: destaca sobre el vacío
        panelC = matLam(0x99a0ac),
        acento = matLam(0xff5b41),
        metal = matPho(0x5a6172, 45),
        vidrio = matPho(0x101823, 95),
        oscuro = matLam(0x2e3440);

  const perfil = [
    new THREE.Vector2(0.001, -0.50),
    new THREE.Vector2(0.050, -0.26),
    new THREE.Vector2(0.072, 0.02),
    new THREE.Vector2(0.050, 0.34),
    new THREE.Vector2(0.001, 0.46)
  ];
  const fus = new THREE.LatheGeometry(perfil, 22);
  fus.rotateX(Math.PI / 2);                  // la nariz (y+) apunta a -z
  pieza(g, fus, casco);

  // cabina y espina dorsal
  const cab = pieza(g, new THREE.SphereGeometry(0.045, 14, 10), vidrio, 0, 0.048, -0.14);
  cab.scale.set(1, 0.55, 1.5);
  pieza(g, new THREE.BoxGeometry(0.016, 0.012, 0.46), panelC, 0, 0.058, 0.12);

  // franjas laterales de acento a lo largo del fuselaje
  for (const s of [1, -1])
    pieza(g, new THREE.BoxGeometry(0.006, 0.02, 0.5), acento, s * 0.066, 0, 0.06);

  // toberas de maniobra (RCS) junto a la nariz
  for (const sx of [1, -1]) for (const sy of [1, -1])
    pieza(g, new THREE.BoxGeometry(0.02, 0.016, 0.03), oscuro, sx * 0.042, sy * 0.036, -0.3);

  // antena dorsal
  pieza(g, new THREE.CylinderGeometry(0.0028, 0.0028, 0.09, 6), panelC, 0, 0.1, 0.03);
  pieza(g, new THREE.SphereGeometry(0.007, 8, 6), acento, 0, 0.148, 0.03);

  // alas en flecha claras, borde y winglets
  for (const s of [1, -1]){
    pieza(g, new THREE.BoxGeometry(0.4, 0.007, 0.15), casco, s * 0.21, -0.012, 0.17, 0, s * 0.48, s * 0.06);
    pieza(g, new THREE.BoxGeometry(0.02, 0.009, 0.132), acento, s * 0.385, -0.012, 0.255, 0, s * 0.48, s * 0.06);
    pieza(g, new THREE.BoxGeometry(0.006, 0.055, 0.1), panelC, s * 0.398, 0.018, 0.26, 0, s * 0.48, 0);
    // motores gemelos con garganta oscura
    pieza(g, new THREE.CylinderGeometry(0.03, 0.036, 0.16, 12), metal, s * 0.058, -0.006, 0.4, Math.PI / 2);
    pieza(g, new THREE.CylinderGeometry(0.023, 0.03, 0.03, 12), oscuro, s * 0.058, -0.006, 0.472, Math.PI / 2);
  }
  // timón vertical
  pieza(g, new THREE.BoxGeometry(0.007, 0.11, 0.13), casco, 0, 0.065, 0.37, -0.18);
  pieza(g, new THREE.BoxGeometry(0.009, 0.03, 0.11), acento, 0, 0.115, 0.36, -0.18);

  // luces de navegación: rojo a babor, verde a estribor, blanca en la cola
  const luces = [];
  const foco = (color, x, y, z) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.scale.setScalar(0.055);
    s.position.set(x, y, z);
    g.add(s); luces.push(s);
    return s;
  };
  foco(0xff5050, -0.385, -0.012, 0.255);
  foco(0x46e08a,  0.385, -0.012, 0.255);
  foco(0xfff2d0,  0, 0.125, 0.4);

  const toberas = [];
  for (const s of [1, -1]){
    const fx = toberaFX(0xffa15e, 0.06);     // química: naranja
    fx.position.set(s * 0.058, -0.006, 0.485);
    g.add(fx); toberas.push(fx);
  }
  g.scale.setScalar(0.72);
  return { grupo: g, toberas, luces, escala: 0.72 };
}

const VEHICULOS = { sonda: construirSonda, nave: construirNave };

/* ---------- selección ---------- */
function elegirVehiculo(v){
  state.vehiculo = v;
  sincronizar();
}
document.querySelectorAll('#naveSeg button').forEach(b =>
  b.onclick = () => elegirVehiculo(b.dataset.n === '0' ? null : b.dataset.n));

/* ---------- pase de render por cuadro ---------- */
function renderNave(dt){
  const id = state.vehiculo;
  if (!id || !VEHICULOS[id]) return;
  let rig = naveCache[id];
  if (!rig){
    rig = naveCache[id] = VEHICULOS[id]();
    escenaNave.add(rig.grupo);
    navQ.copy(camQ);
  }
  for (const k in naveCache) naveCache[k].grupo.visible = k === id;

  // el morro reacciona con un pelo de retardo: sensación de masa
  navQ.slerp(camQ, 1 - Math.exp(-dt * 8));
  rig.grupo.quaternion.copy(navQ);
  rig.grupo.position.copy(NAVE_OFF).applyQuaternion(camQ);

  // luz desde el Sol real (el Sol vive en el origen)
  _nv.set(-state.camKm[0], -state.camKm[1], -state.camKm[2]).normalize();
  luzNave.position.copy(_nv).multiplyScalar(10);

  // empuje: sigue a las teclas con la misma lógica de rampa
  const empujando = teclas['w'] || teclas['s'] || teclas['a'] || teclas['d'] ||
                    teclas['r'] || teclas['f'] || teclas[' '];
  intEmpuje += ((empujando ? 1 : 0) - intEmpuje) * (1 - Math.exp(-dt / 0.16));
  const turbo = teclas['shift'] ? 1.75 : 1;
  const chispa = 0.92 + 0.16 * Math.random();

  // las luces de navegación laten despacio
  if (rig.luces){
    const tl = performance.now() * 0.0024;
    rig.luces.forEach((s, i) => { s.material.opacity = 0.5 + 0.38 * (0.5 + 0.5 * Math.sin(tl * 2 + i * 2.1)); });
  }

  for (const t of rig.toberas){
    const L = intEmpuje * turbo;
    const vis = L > 0.03;
    t.visible = vis;
    if (!vis) continue;
    const u = t.userData;
    t.scale.set(u.ancho * (0.8 + 0.4 * L), u.ancho * (0.8 + 0.4 * L), (0.16 + 0.62 * L) * chispa);
    u.mat.opacity = Math.min(1, 0.25 + 0.75 * L) * chispa;
    u.core.opacity = Math.min(1, 0.3 + 0.7 * L);
  }

  renderer.clearDepth();
  renderer.render(escenaNave, camera);
}

window.sistemaSolar.vehiculo = elegirVehiculo;
