/* ============================================================
   MODO ATMÓSFERA
   Al descender sobre un cuerpo con atmósfera (Tierra, Venus,
   Marte, Titán), un velo de pantalla completa pinta el cielo:
   azul profundo en el cénit, bruma clara en el horizonte real
   (calculado con la altura), crepúsculo cálido hacia el Sol y
   noche estrellada del lado oscuro. Es dispersión atmosférica,
   no terreno: nunca prometemos calles, prometemos cielo.
   Solo actúa a escala real y se desvanece con la altura.
   ============================================================ */

const H_ATM = { tierra: 110, venus: 260, marte: 80, titan: 500 };   // espesor útil, km

const veloUni = {
  uF:     { value: 0 },                        // fuerza global (0 = apagado)
  uZen:   { value: new THREE.Vector3(0, 1, 0) },   // cénit en espacio de cámara
  uSol:   { value: new THREE.Vector3(1, 0, 0) },   // sol en espacio de cámara
  uCol:   { value: new THREE.Color(0x5a9fe0) },
  uTanF:  { value: 0.5 },
  uAsp:   { value: 1 },
  uRh:    { value: 0.99 }                      // R/(R+h): geometría del horizonte
};

const VELO_VERT = `
varying vec2 vUv;
void main(){ vUv = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const VELO_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uF, uTanF, uAsp, uRh;
uniform vec3 uZen, uSol, uCol;
void main(){
  vec3 dir = normalize(vec3(vUv.x * uTanF * uAsp, vUv.y * uTanF, -1.0));
  float sz = dot(dir, uZen);                       // seno de la elevación de la mirada
  float hor = -sqrt(max(0.0, 1.0 - uRh * uRh));    // elevación del horizonte real (baja con la altura)
  float e = sz - hor;                              // altura de la mirada sobre el horizonte

  // densidad: máxima pegada al horizonte, fina hacia el cénit, media hacia el suelo
  float dens = mix(1.0, 0.14, smoothstep(0.0, 0.85, e));
  dens = mix(dens, 0.5, smoothstep(0.0, -0.3, e) * 0.85);

  float selev = dot(uSol, uZen);                   // elevación del sol
  float dia = smoothstep(-0.16, 0.12, selev);
  float haciaSol = max(dot(dir, uSol), 0.0);

  // cielo: horizonte claro que se hunde a azul profundo en el cénit
  vec3 cielo = mix(uCol * 1.15 + vec3(0.28), uCol * 0.5, smoothstep(0.0, 0.75, e));
  // crepúsculo: banda cálida hacia el sol cuando anda cerca del horizonte
  float crep = clamp(1.0 - abs(selev) * 5.0, 0.0, 1.0);
  cielo = mix(cielo, vec3(1.0, 0.52, 0.28), crep * pow(haciaSol, 3.0) * 0.65);
  // resplandor del propio sol a través del aire
  cielo += vec3(1.0, 0.9, 0.72) * pow(haciaSol, 480.0) * 1.6 * dia;

  float alfa = uF * dens * mix(0.10, 1.0, dia);    // de noche apenas un velo: que se vean las estrellas
  gl_FragColor = vec4(cielo * mix(0.06, 1.0, dia), clamp(alfa, 0.0, 1.0));
}`;

const escenaVelo = new THREE.Scene();
{
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: veloUni, vertexShader: VELO_VERT, fragmentShader: VELO_FRAG,
      transparent: true, depthTest: false, depthWrite: false
    })
  );
  m.frustumCulled = false;
  escenaVelo.add(m);
}
const _vq = new THREE.Quaternion();

function renderAtmosfera(){
  // solo tiene sentido a escala real: con cuerpos agrandados la altura miente
  if (state.sizeScale > 1.05){ veloUni.uF.value = 0; return; }

  // el cuerpo con atmósfera más "cerca" en unidades de su propio espesor
  let mejor = null, mf = 0;
  for (const c of cuerpos){
    if (!c.def.atmos) continue;
    const H = H_ATM[c.def.id] || c.def.r * 0.02;
    const h = c.dist - c.def.r;
    const f = 1 - h / (H * 1.6);                 // 1 en superficie, 0 a 1.6 espesores
    if (f > mf){ mf = f; mejor = c; }
  }
  if (!mejor || mf <= 0.005){ veloUni.uF.value = 0; return; }

  veloUni.uF.value = Math.pow(Math.min(mf, 1), 1.35);
  veloUni.uCol.value.set(mejor.def.atmos);
  const h = Math.max(mejor.dist - mejor.def.r, 0.2);
  veloUni.uRh.value = mejor.def.r / (mejor.def.r + h);
  veloUni.uTanF.value = Math.tan(camera.fov * DEG / 2);
  veloUni.uAsp.value = camera.aspect;

  _vq.copy(camQ).invert();
  // cénit: de la superficie hacia arriba (del centro del cuerpo a la cámara)
  veloUni.uZen.value
    .set(state.camKm[0] - mejor.pos[0], state.camKm[1] - mejor.pos[1], state.camKm[2] - mejor.pos[2])
    .normalize().applyQuaternion(_vq);
  // sol visto desde aquí (el Sol vive en el origen)
  veloUni.uSol.value
    .set(-state.camKm[0], -state.camKm[1], -state.camKm[2])
    .normalize().applyQuaternion(_vq);

  renderer.render(escenaVelo, camera);
}
