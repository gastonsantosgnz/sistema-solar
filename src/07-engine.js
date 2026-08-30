/* ============================================================
   MOTOR
   Unidad de escena = 1 000 km. Todas las posiciones se guardan en
   km como dobles de JS y se convierten a coordenadas de escena
   RELATIVAS A LA CÁMARA (origen flotante). Sin esto, la precisión
   de float32 haría temblar a los planetas a miles de millones de km.
   Marco: eclíptica J2000, Z hacia el norte eclíptico.
   ============================================================ */

const U = 1000;                    // km por unidad de escena
const V3 = (x,y,z) => new THREE.Vector3(x,y,z);

/* Polos norte de rotación (IAU, ascensión recta y declinación J2000) */
const POLOS = {
  sol:[286.13,63.87], mercurio:[281.0103,61.4155], venus:[272.76,67.16],
  tierra:[0,90], marte:[317.681,52.887], jupiter:[268.057,64.495],
  saturno:[40.589,83.537], urano:[257.311,-15.175], neptuno:[299.36,43.46],
  pluton:[132.993,-6.163], luna:[270.0,66.54]
};

function eqToEcl(raDeg, decDeg){
  const OB = 23.4392911 * DEG, r = raDeg * DEG, d = decDeg * DEG;
  const x = Math.cos(d)*Math.cos(r), y = Math.cos(d)*Math.sin(r), z = Math.sin(d);
  return V3(x, y*Math.cos(OB) + z*Math.sin(OB), -y*Math.sin(OB) + z*Math.cos(OB)).normalize();
}

const state = {
  jd: dateToJD(new Date()),
  rate: 1 / 86400,        // días por segundo de reloj
  playing: true,
  focus: 'tierra',
  mode: 'orbit',
  dist: 40000,            // km al centro del objetivo
  distTarget: 40000,
  yaw: 0.9, pitch: 0.28,
  camKm: [0,0,0],
  freeVel: [0,0,0],
  sizeScale: 1,
  luzReal: false,
  verOrbitas: true,
  verEtiquetas: true,
  verConstelaciones: false,
  verViaLactea: true,
  verLunas: true,
  verAsteroides: true,
  verTrans: true,
  verSondas: true,
  viaje: null,
  velFija: null,          // km/s de crucero fijados desde la cinta; null = automática
  vehiculo: 'sonda',      // 'sonda' | 'nave' | null — el vehículo del vuelo libre
  enMomento: false,       // hay un momento guiado en pantalla (banner persistente)
  comparando: false,
  chrome: true
};

/* ---------- escena ---------- */
const canvas = document.getElementById('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, logarithmicDepthBuffer:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x05060a, 1);
renderer.autoClear = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 1e-6, 1e14);
camera.up.set(0,0,1);

const sky = buildSky(THREE, STARDATA);
const skyCam = new THREE.PerspectiveCamera(52, 1, 0.1, 20);

/* ---------- construcción de cuerpos ---------- */
const cuerpos = [];     // {def, pivot, mesh, uni, pos[3], parent, ...}
const porId = {};
const SEG = 96;
const esferaGeo = new THREE.SphereGeometry(1, SEG, SEG/2);

function hexV3(h){ const c = new THREE.Color(h); return V3(c.r, c.g, c.b); }

/* ---------- texturas incrustadas ---------- */
const texCache = {};
let texPendientes = 0, texTotal = 0;
const cargador = new THREE.TextureLoader();
function cargarTex(nombre){
  if (texCache[nombre]) return texCache[nombre];
  texPendientes++; texTotal++;
  const t = cargador.load(TEXTURAS[nombre], () => { texPendientes--; }, undefined, () => { texPendientes--; });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texCache[nombre] = t;
  return t;
}

/* Exposición de cada mapa: las fotos de la NASA vienen bastante oscuras */
const GANANCIA = { tierra:1.46, luna:1.14, marte:1.12, mercurio:0.88, venus:0.94,
                   jupiter:1.08, saturno:1.14, urano:1.02, neptuno:1.08 };

/* Ángulo que hay que aplicar para que el meridiano cero (eje +X del objeto, que
   en la textura equirectangular cae en u = 0.5) apunte a la ascensión recta
   indicada. Así el terminador cae sobre la geografía correcta.            */
function faseMeridiano(q1, raGrados){
  const g = eqToEcl(raGrados, 0);
  const a = V3(1,0,0).applyQuaternion(q1);
  const b = V3(0,0,1).applyQuaternion(q1);
  return Math.atan2(-g.dot(b), g.dot(a));
}

function paleta(def){
  const p = {
    SUN:      [0xfff6dd, 0xffb43c, 0xff7a1e],
    ROCK:     [0x9d9a96, 0x67655f, 0x000000],
    MOON:     [0xb6b1aa, 0x7e776f, 0x000000],
    VENUS:    [0xf5e2b6, 0xd9b271, 0xbf9350],
    EARTH:    [0x2f6ba8, 0x0d2f52, 0x000000],
    MARS:     [0xc9683a, 0x6d3a24, 0x000000],
    JUPITER:  [0xe8d2ad, 0xa9764c, 0xd9b98f],
    SATURN:   [0xeadcb4, 0xc0a271, 0xd8c49a],
    URANUS:   [0xb8e8ea, 0x86c9d4, 0xa8dde0],
    NEPTUNE:  [0x4b74d6, 0x2a439e, 0x6f97e8],
    PLUTO:    [0xd2bda0, 0x6e6154, 0xa38b6e],
    IO:       [0xf0da76, 0xd0932e, 0x7a3b1a],
    EUROPA:   [0xf4efe4, 0xdcd2c0, 0x9a6f52],
    TITAN:    [0xe8ae4b, 0xbe7c26, 0x94601c],
    ICEMOON:  [0xf2f4f5, 0xb9c2c6, 0xffffff]
  }[def.shader] || [0xaaaaaa, 0x555555, 0x000000];
  return p.map(hexV3);
}

/* ---------- formas rocosas ----------
   Los cuerpos chicos no son esferas: se deforma la esfera base con lóbulos
   sinusoidales y rugosidad, con semilla determinista por id (la misma papa
   en cada visita). Ceres e Higía se quedan redondos porque lo son.        */
function azarDe(sem){
  let s = sem | 0;
  return function(){
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function geoRocosa(def){
  const g = esferaGeo.clone();
  let sem = 0;
  for (const ch of def.id) sem = (sem * 31 + ch.charCodeAt(0)) | 0;
  const rnd = azarDe(sem);
  const fuerza = def.r > 150 ? 0.055 : def.r > 20 ? 0.12 : 0.2;
  const alarg = 1 + (def.r < 20 ? 0.45 + rnd() * 0.55 : 0.1 + rnd() * 0.18);
  const K = [], A = [];
  for (let k = 0; k < 6; k++){
    K.push(new THREE.Vector3(rnd()*2 - 1, rnd()*2 - 1, rnd()*2 - 1).normalize()
      .multiplyScalar(1.2 + rnd() * (k < 3 ? 2.2 : 6.5)));
    A.push((k < 3 ? 0.9 : 0.45) * (0.5 + rnd() * 0.5));
  }
  const p = g.attributes.position;
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++){
    v.fromBufferAttribute(p, i);
    n.copy(v).normalize();
    let d = 1;
    for (let k = 0; k < 6; k++)
      d += fuerza * A[k] * Math.sin(n.x*K[k].x + n.y*K[k].y + n.z*K[k].z + k * 1.7);
    p.setXYZ(i, n.x * d * alarg, n.y * d, n.z * d);
  }
  g.computeVertexNormals();
  return g;
}

function crearCuerpo(def, esLuna){
  const pivot = new THREE.Object3D();
  scene.add(pivot);
  const P = paleta(def);
  const uni = {
    uSunDir:{value:V3(1,0,0)}, uSunObj:{value:V3(1,0,0)},
    uCA:{value:P[0]}, uCB:{value:P[1]}, uCC:{value:P[2]},
    uLight:{value:1}, uTime:{value:0}, uAmb:{value:0.022},
    uRing:{value:new THREE.Vector2(0,0)}, uDetail:{value:1}, uCerca:{value:0},
    uGanancia:{value: GANANCIA[def.id] || 1},
    uEje:{value: V3(0,0,1)},
    uNumCast:{value:0},
    uCast:{value:[new THREE.Vector4(),new THREE.Vector4(),new THREE.Vector4(),new THREE.Vector4()]},
    uSunPos:{value:new THREE.Vector3()},
    uSunRad:{value: R_SOL/U}
  };
  const defines = { [def.shader]: '' };
  if (def.id === 'luna') defines.ECLROJO = '';
  if (TEXTURAS[def.id]){
    defines.TEX = '';
    uni.uMapa = { value: cargarTex(def.id) };
    if (def.id === 'tierra'){
      defines.TEX_TIERRA = '';
      uni.uNoche   = { value: cargarTex('tierra_noche') };
      uni.uAgua    = { value: cargarTex('tierra_agua') };
      uni.uRelieve = { value: cargarTex('tierra_relieve') };
    }
  }
  if (def.ring && def.shader === 'SATURN'){
    uni.uRing.value.set(def.ring[0]/def.r, def.ring[1]/def.r);
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, defines
  });
  const rocosa = !def.sonda && def.id !== 'ceres' && def.id !== 'higia' &&
                 ((def.el && def.r <= 270) || (esLuna && def.r < 150));
  const mesh = new THREE.Mesh(rocosa ? geoRocosa(def) : esferaGeo, mat);
  mesh.frustumCulled = false;
  pivot.add(mesh);

  const c = { def, pivot, mesh, uni, esLuna,
    pos:[0,0,0], rel:new THREE.Vector3(), dist:0, pxRad:0,
    axis: eqToEcl(...(POLOS[def.id] || [270, 66.5])) };
  const qEje = new THREE.Quaternion().setFromUnitVectors(V3(0,1,0), c.axis);
  c.fase = def.meridiano !== undefined ? faseMeridiano(qEje, def.meridiano) : 0;

  /* anillos */
  if (def.ring){
    const [ri, ro, op] = def.ring;
    const rg = new THREE.RingGeometry(ri/def.r, ro/def.r, 256, 3);
    rg.rotateX(-Math.PI/2);
    const runi = {
      uSunObj:{value:V3(1,0,0)}, uCA:{value:hexV3(0xefe6cd)}, uCB:{value:hexV3(0xc4b494)},
      uRad:{value:new THREE.Vector2(ri/def.r, ro/def.r)},
      uLight:{value:1}, uOpacity:{value:op}, uDetalle:{value: def.shader==='SATURN'?1:0}
    };
    const ring = new THREE.Mesh(rg, new THREE.ShaderMaterial({
      uniforms:runi, vertexShader:RING_VERT, fragmentShader:RING_FRAG,
      transparent:true, side:THREE.DoubleSide, depthWrite:false
    }));
    ring.frustumCulled = false;
    pivot.add(ring); c.ring = ring; c.runi = runi;
  }

  /* atmósfera */
  if (def.atmos){
    const auni = { uColor:{value:hexV3(def.atmos)}, uSunDir:uni.uSunDir, uLight:uni.uLight, uPow:{value: def.id==='tierra'?3.4:2.4} };
    const atm = new THREE.Mesh(esferaGeo, new THREE.ShaderMaterial({
      uniforms:auni, vertexShader:ATMO_VERT, fragmentShader:ATMO_FRAG,
      transparent:true, blending:THREE.AdditiveBlending, side:THREE.BackSide, depthWrite:false
    }));
    atm.frustumCulled = false;
    atm.scale.setScalar(def.id==='tierra' ? 1.018 : 1.026);
    pivot.add(atm); c.atm = atm;
  }

  /* nubes terrestres */
  if (def.id === 'tierra'){
    const cuni = { uSunDir:uni.uSunDir, uLight:uni.uLight, uCerca:uni.uCerca,
                   uNubes:{ value: cargarTex('tierra_nubes') } };
    const nub = new THREE.Mesh(esferaGeo, new THREE.ShaderMaterial({
      uniforms:cuni, vertexShader:PLANET_VERT, fragmentShader:CLOUD_FRAG,
      transparent:true, depthWrite:false
    }));
    nub.frustumCulled = false; nub.scale.setScalar(1.006);
    pivot.add(nub); c.nubes = nub;
  }

  /* destello: se ve cuando el cuerpo es más pequeño que unos pocos píxeles */
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: def.color, transparent:true,
    blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false,
    sizeAttenuation:true
  }));
  glow.renderOrder = 20; glow.frustumCulled = false;
  pivot.add(glow); c.glow = glow;

  if (def.clase === 'comet'){
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);                      // ancla la cabeza en el origen
    const tail = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: hazCola(), transparent:true, blending:THREE.AdditiveBlending,
      depthWrite:false, side:THREE.DoubleSide, opacity:0
    }));
    tail.frustumCulled = false; tail.matrixAutoUpdate = false;
    scene.add(tail); c.cola = tail;
    const coma = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color:0xcfe2f8, transparent:true,
      blending:THREE.AdditiveBlending, depthWrite:false, opacity:0
    }));
    coma.frustumCulled = false; pivot.add(coma); c.coma = coma;
  }

  if (def.id === 'sol'){
    const cor = new THREE.Sprite(new THREE.SpriteMaterial({
      map: hazCorona(), color:0xffd9a0, transparent:true,
      blending:THREE.AdditiveBlending, depthWrite:false, opacity:0.85
    }));
    cor.frustumCulled = false; pivot.add(cor); c.corona = cor;
  }

  cuerpos.push(c); porId[def.id] = c;
  return c;
}

function hazGlow(){
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.10, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.28, 'rgba(255,255,255,0.22)');
  gr.addColorStop(0.60, 'rgba(255,255,255,0.045)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0,0,s,s);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function hazCola(){
  const w = 128, h = 256, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const lg = g.createLinearGradient(0, h, 0, 0);   // brillante en la cabeza (v=0, abajo)
  lg.addColorStop(0.00, 'rgba(215,230,255,0.90)');
  lg.addColorStop(0.10, 'rgba(195,215,248,0.50)');
  lg.addColorStop(0.40, 'rgba(172,198,240,0.18)');
  lg.addColorStop(1.00, 'rgba(150,180,230,0)');
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
  // atenuación lateral gaussiana: cola fina, no reflector
  const img = g.getImageData(0, 0, w, h), px = img.data;
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      const u = (x - w/2) / (w/2);
      const k = Math.exp(-u*u*4.2);
      px[(y*w + x)*4 + 3] *= k;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function hazCorona(){
  const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  gr.addColorStop(0.00, 'rgba(255,250,235,0.95)');
  gr.addColorStop(0.16, 'rgba(255,228,175,0.55)');
  gr.addColorStop(0.34, 'rgba(255,190,120,0.16)');
  gr.addColorStop(0.62, 'rgba(255,170,100,0.045)');
  gr.addColorStop(1.00, 'rgba(255,160,90,0)');
  g.fillStyle = gr; g.fillRect(0,0,s,s);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- órbitas ---------- */
const glowTex = hazGlow();
const orbitGroup = new THREE.Group(); scene.add(orbitGroup);
const orbitas = {};
function crearOrbitas(){
  for (const def of BODIES){
    if (!ELEM[def.id]) continue;
    const pts = orbitPath(def.id, state.jd, 512);
    const arr = new Float32Array(pts.length);
    for (let i = 0; i < pts.length; i++) arr[i] = pts[i] / U;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const col = new THREE.Color(def.color).lerp(new THREE.Color(0xffffff), 0.15);
    const line = new THREE.LineLoop(g, new THREE.LineBasicMaterial({
      color: col, transparent:true, opacity:0.20, depthWrite:false
    }));
    line.frustumCulled = false;
    orbitGroup.add(line); orbitas[def.id] = line;
  }
  // órbitas de cuerpos menores (elipses reales)
  for (const m of MENORES){
    const pts = orbitPathEls(m.el, 512);
    const arr = new Float32Array(pts.length);
    for (let i = 0; i < pts.length; i++) arr[i] = pts[i] / U;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const col = new THREE.Color(m.color).lerp(new THREE.Color(0xffffff), 0.1);
    const line = new THREE.LineLoop(g, new THREE.LineBasicMaterial({
      color: col, transparent:true, opacity: m.clase === 'comet' ? 0.22 : 0.15, depthWrite:false
    }));
    line.frustumCulled = false;
    orbitGroup.add(line); orbitas[m.id] = line;
  }
  // órbitas de lunas (círculos en el plano de la eclíptica, inclinados)
  for (const m of MOONS){
    if (m.id === 'luna'){
      // la Luna lleva una línea dinámica muestreada de la efeméride real
      const n = 160, g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n*3), 3));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({
        color: 0x9fb4c8, transparent:true, opacity:0.16, depthWrite:false
      }));
      line.frustumCulled = false;
      orbitGroup.add(line); orbitas.luna = line;
      continue;
    }
    const n = 128, arr = new Float32Array(n*3);
    const i = m.inc * DEG;
    for (let k = 0; k < n; k++){
      const th = k/n * Math.PI*2;
      const x = m.a*Math.cos(th), y = m.a*Math.sin(th);
      arr[k*3] = x/U; arr[k*3+1] = y*Math.cos(i)/U; arr[k*3+2] = y*Math.sin(i)/U;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr,3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const line = new THREE.LineLoop(g, new THREE.LineBasicMaterial({
      color: 0x9fb4c8, transparent:true, opacity:0.16, depthWrite:false
    }));
    line.frustumCulled = false;
    orbitGroup.add(line); orbitas[m.id] = line;
  }
}

/* ---------- trayectorias reales de las sondas ---------- */
const rutas = {};
function crearRutas(){
  for (const s of SONDAS){
    const arr = new Float32Array(s.n * 3);
    for (let i = 0; i < s.n * 3; i++) arr[i] = s.xyz[i] / U;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    g.setDrawRange(0, 1);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({
      color: new THREE.Color(s.color), transparent:true, opacity:0.30, depthWrite:false
    }));
    line.frustumCulled = false;
    orbitGroup.add(line);
    rutas[s.id] = line;
  }
}

/* ---------- inicialización ---------- */
BODIES.forEach(d => crearCuerpo(d, false));
MOONS.forEach(d => crearCuerpo(d, true));
MENORES.forEach(d => crearCuerpo(d, false));
/* Las sondas miden metros: nunca son un disco, siempre un destello con etiqueta.
   Se les da un radio simbólico para que el resto del motor las trate igual.   */
SONDAS.forEach(s => crearCuerpo({
  id:s.id, nombre:s.nombre, tipo:s.tipo, clase:'sonda', r:0.004, rot:1,
  color:s.color, shader:'ROCK', nota:s.nota, sonda:s
}, false));
crearOrbitas();
crearRutas();

/* ---------- nube de asteroides (GPU) ---------- */
function b64bytes(str){
  const bin = atob(str), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const nubeCamKm = { value: new THREE.Vector3() };
const nubeJD = { value: 0 };
const TAU = Math.PI * 2;
function crearNube(datos, c1, c2, tam){
  const n = datos.n;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n*3), 3));
  // desempaqueta los elementos cuantizados a float32
  const f32 = k => new Float32Array(b64bytes(datos[k]).buffer);
  const u16 = k => new Uint16Array(b64bytes(datos[k]).buffer);
  const des = (arr, esc) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = arr[i] * esc; return o; };
  const attrs = {
    aA: f32('a'), aN: f32('nn'),
    aE: des(u16('e'), 0.7/65535),
    aI: des(u16('i'), Math.PI/65535),
    aOm: des(u16('om'), TAU/65535),
    aW: des(u16('w'), TAU/65535),
    aM0: des(u16('m0'), TAU/65535),
    aS: des(b64bytes(datos.s), 1/8)      // sqrt(diámetro km)
  };
  for (const [attr, arr] of Object.entries(attrs)){
    g.setAttribute(attr, new THREE.BufferAttribute(arr, 1));
  }
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e12);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uJD: nubeJD, uCamKm: nubeCamKm, uPix: { value: Math.min(devicePixelRatio, 2) },
                uC1: { value: hexV3(c1) }, uC2: { value: hexV3(c2) }, uTam: { value: tam } },
    vertexShader: AST_VERT, fragmentShader: AST_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = -2;
  scene.add(pts);
  return pts;
}
const nubeBelt = crearNube(ASTDATA.belt, 0xd6bd97, 0xeadec0, 1.0);
const nubeTno  = crearNube(ASTDATA.tno,  0x9db1cf, 0xc3cede, 1.9);

let lunaOrbJD = -1e9;
function regeneraOrbitaLuna(jd){
  if (Math.abs(jd - lunaOrbJD) < (state.viaje ? 6 : 0.25)) return;
  lunaOrbJD = jd;
  const attr = orbitas.luna.geometry.attributes.position;
  const o = [0,0,0], n = attr.count;
  for (let k = 0; k < n; k++){
    lunaGeo(jd - 13.66 + 27.322 * k/(n-1), o);
    attr.array[k*3] = o[0]/U; attr.array[k*3+1] = o[1]/U; attr.array[k*3+2] = o[2]/U;
  }
  attr.needsUpdate = true;
}

/* ---------- posiciones ---------- */
const _p = [0,0,0];
function actualizarPosiciones(jd){
  porId.sol.pos[0] = porId.sol.pos[1] = porId.sol.pos[2] = 0;
  for (const def of BODIES){
    if (!ELEM[def.id]) continue;
    planetPos(def.id, jd, _p);
    const c = porId[def.id];
    c.pos[0] = _p[0]; c.pos[1] = _p[1]; c.pos[2] = _p[2];
  }
  for (const m of MOONS){
    if (m.id === 'luna') lunaGeo(jd, _p);      // efeméride real (Meeus/ELP)
    else moonPos(m, jd, _p);
    const c = porId[m.id], pa = porId[m.padre];
    c.pos[0] = pa.pos[0] + _p[0]; c.pos[1] = pa.pos[1] + _p[1]; c.pos[2] = pa.pos[2] + _p[2];
  }
  for (const m of MENORES){
    menorPos(m.el, jd, _p);
    const c = porId[m.id];
    c.pos[0] = _p[0]; c.pos[1] = _p[1]; c.pos[2] = _p[2];
  }
  for (const s of SONDAS){
    const c = porId[s.id];
    c.lanzada = sondaPos(s, jd, _p);
    if (c.lanzada){ c.pos[0] = _p[0]; c.pos[1] = _p[1]; c.pos[2] = _p[2]; }
  }
}

function posDe(id){ return porId[id].pos; }

/* radio efectivo en km después de la exageración de tamaño */
function radioEfectivo(c){
  const k = state.sizeScale;
  if (k <= 1.001) return c.def.r;
  const dPadre = c.esLuna ? c.def.a
    : (c.def.id === 'sol' ? 0.387 * AU
       : (Math.hypot(c.pos[0], c.pos[1], c.pos[2]) || AU));
  return Math.min(c.def.r * k, Math.max(dPadre * 0.22, c.def.r));
}
function lunasVisibles(){ return state.verLunas && state.sizeScale < 25; }
