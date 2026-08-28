/* ============================================================
   CIELO: 8 920 estrellas reales (catálogo HYG v4.1, mag ≤ 6.5),
   674 trazos de constelaciones (Stellarium) y Vía Láctea procedural.
   Las estrellas se colocan a su distancia real, así que al alejarse
   del Sol el cielo cambia de verdad.
   ============================================================ */

function b64(s){
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

// Índice de color B-V -> RGB aproximado
function bvToRGB(bv){
  bv = Math.max(-0.4, Math.min(2.0, bv));
  let t, r, g, b;
  if (bv < 0.0){ t = (bv + 0.4) / 0.4; r = 0.61 + 0.11*t + 0.1*t*t; g = 0.70 + 0.07*t + 0.1*t*t; b = 1.0; }
  else if (bv < 0.4){ t = bv / 0.4; r = 0.83 + 0.17*t; g = 0.87 + 0.11*t; b = 1.0; }
  else if (bv < 1.6){ t = (bv - 0.4) / 1.2; r = 1.0; g = 0.98 - 0.16*t; b = 1.0 - 0.5*t - 0.3*t*t; }
  else { t = (bv - 1.6) / 0.4; r = 1.0; g = 0.82 - 0.5*t; b = 0.20 - 0.1*t; }
  return [r, g, b];
}

const STAR_VERT = `
attribute vec3 aDir; attribute float aMag; attribute vec3 aCol; attribute float aDist;
uniform vec3 uCamKm; uniform float uPix; uniform float uGamma; uniform float uLimit;
varying vec3 vCol; varying float vInt;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vec3 p = aDir * aDist - uCamKm;
  float d = length(p);
  float m = aMag + 5.0 * (log(d / max(aDist,1.0)) / 2.302585) ;
  float b = pow(10.0, -0.4 * (m - uLimit));
  float s = uPix * (0.55 + 0.75 * pow(clamp(b,0.0,4000.0), 0.20));
  gl_PointSize = clamp(s, 1.0, 26.0);
  vInt = clamp(pow(b, 0.42), 0.02, 14.0) * uGamma;
  vCol = aCol;
  vec4 mv = viewMatrix * vec4(normalize(p) * 4.0, 1.0);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;

const STAR_FRAG = `
varying vec3 vCol; varying float vInt;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if(r > 1.0) discard;
  float core = pow(1.0 - r, 2.6);
  float halo = pow(1.0 - r, 7.0) * 0.55;
  float a = clamp(core + halo, 0.0, 1.0);
  vec3 col = mix(vCol, vec3(1.0), clamp(vInt*0.30,0.0,0.7) * core);
  gl_FragColor = vec4(col * clamp(vInt,0.0,3.0), a);
  #include <logdepthbuf_fragment>
}`;

const LINE_VERT = `
attribute vec3 aDir; attribute float aDist;
uniform vec3 uCamKm;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vec3 p = aDir * aDist - uCamKm;
  gl_Position = projectionMatrix * viewMatrix * vec4(normalize(p) * 4.0, 1.0);
  #include <logdepthbuf_vertex>
}`;

const MW_FRAG = `
${GLSL_NOISE}
uniform vec3 uPole, uCenter; uniform float uInt;
varying vec3 vDir;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  vec3 d = normalize(vDir);
  float lat = asin(clamp(dot(d, uPole), -1.0, 1.0));       // latitud galáctica
  float toC = dot(d, uCenter);
  float ancho = 0.105 + 0.085 * smoothstep(-0.3, 1.0, toC);
  float banda = exp(-(lat*lat) / (2.0 * ancho * ancho));
  float grano  = fbm(d * 42.0, 4, 2.3, 0.55) * 0.5 + 0.5;
  float nubes  = fbm(d * 14.0, 5, 2.2, 0.55) * 0.5 + 0.5;
  float rifts  = smoothstep(0.34, 0.86, fbm(d * 9.0 + vec3(4.0), 4, 2.1, 0.5) * 0.5 + 0.5);
  float bulbo  = pow(max(toC, 0.0), 40.0);
  float i = banda * (0.42 + 0.58 * nubes) * (0.55 + 0.45 * grano);
  i *= (1.0 - rifts * 0.70 * banda);
  i += bulbo * banda * 0.55;
  i *= 0.155;
  vec3 col = mix(vec3(0.52,0.57,0.76), vec3(0.98,0.93,0.80), pow(max(toC,0.0), 6.0)*0.6 + bulbo*0.5);
  gl_FragColor = vec4(col * i * uInt, 1.0);
  #include <logdepthbuf_fragment>
}`;

const MW_VERT = `
varying vec3 vDir;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

/* Construye la escena del cielo. Devuelve { scene, cam, update() } */
function buildSky(THREE, data){
  const n = data.n;
  const ra = new Uint16Array(b64(data.ra).buffer);
  const de = new Int16Array(b64(data.de).buffer);
  const mg = new Int16Array(b64(data.mg).buffer);
  const ci = new Int8Array(b64(data.ci).buffer);
  const di = new Float32Array(b64(data.di).buffer);
  const seg = new Uint16Array(b64(data.lines).buffer);

  const dir = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const mag = new Float32Array(n);
  const dst = new Float32Array(n);
  for (let i = 0; i < n; i++){
    const lam = ra[i] / 65535 * Math.PI * 2;
    const bet = de[i] / 32767 * Math.PI / 2;
    const cb = Math.cos(bet);
    dir[i*3] = cb * Math.cos(lam); dir[i*3+1] = cb * Math.sin(lam); dir[i*3+2] = Math.sin(bet);
    const c = bvToRGB(ci[i] / 50);
    col[i*3] = c[0]; col[i*3+1] = c[1]; col[i*3+2] = c[2];
    mag[i] = mg[i] / 20;
    dst[i] = di[i] * PC;
  }

  const scene = new THREE.Scene();
  const uCamKm = { value: new THREE.Vector3(0,0,0) };

  // --- Vía Láctea ---
  const eq2ec = (raDeg, decDeg) => {
    const OB = 23.4392911 * DEG, r = raDeg * DEG, d = decDeg * DEG;
    const x = Math.cos(d)*Math.cos(r), y = Math.cos(d)*Math.sin(r), z = Math.sin(d);
    return new THREE.Vector3(x, y*Math.cos(OB) + z*Math.sin(OB), -y*Math.sin(OB) + z*Math.cos(OB));
  };
  const mwUni = {
    uPole:   { value: eq2ec(192.85948, 27.12825) },
    uCenter: { value: eq2ec(266.40510, -28.93617) },
    uInt:    { value: 1.0 }
  };
  const mw = new THREE.Mesh(
    new THREE.SphereGeometry(4.6, 96, 64),
    new THREE.ShaderMaterial({ uniforms: mwUni, vertexShader: MW_VERT, fragmentShader: MW_FRAG,
      side: THREE.BackSide, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  mw.renderOrder = -10; scene.add(mw);

  // --- estrellas ---
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(dir, 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
  g.setAttribute('aDist', new THREE.BufferAttribute(dst, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const starUni = {
    uCamKm: uCamKm, uPix: { value: 2.9 }, uGamma: { value: 1.0 }, uLimit: { value: 5.7 }
  };
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: starUni, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  stars.renderOrder = -5; scene.add(stars);

  // --- constelaciones ---
  const m = seg.length;
  const ldir = new Float32Array(m * 3), ldst = new Float32Array(m);
  for (let i = 0; i < m; i++){
    const s = seg[i];
    ldir[i*3] = dir[s*3]; ldir[i*3+1] = dir[s*3+1]; ldir[i*3+2] = dir[s*3+2];
    ldst[i] = dst[s];
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(ldir, 3));
  lg.setAttribute('aDir', new THREE.BufferAttribute(ldir, 3));
  lg.setAttribute('aDist', new THREE.BufferAttribute(ldst, 1));
  lg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const conMat = new THREE.ShaderMaterial({
    uniforms: { uCamKm: uCamKm },
    vertexShader: LINE_VERT,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){ gl_FragColor = vec4(0.34,0.46,0.66,0.22);
      #include <logdepthbuf_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false
  });
  const cons = new THREE.LineSegments(lg, conMat);
  cons.renderOrder = -4; cons.visible = false; scene.add(cons);

  // nombres de estrellas notables
  const named = data.named.map(([i, label]) => ({
    label,
    dir: new THREE.Vector3(dir[i*3], dir[i*3+1], dir[i*3+2]),
    mag: mag[i]
  }));

  return { scene, stars, cons, mw, uCamKm, starUni, mwUni, named };
}
