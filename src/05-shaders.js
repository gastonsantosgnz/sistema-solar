/* ============================================================
   SHADERS PROCEDURALES DE SUPERFICIE
   Sin texturas externas: todo se genera con ruido simplex 3D en
   espacio objeto, así que no hay costuras ni deformación polar.
   ============================================================ */

const GLSL_NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))
        +i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p,int oct,float lac,float gain){
  float s=0.0,a=0.5,n=0.0;
  for(int i=0;i<8;i++){ if(i>=oct) break; s+=a*snoise(p); n+=a; p*=lac; a*=gain; }
  return s/max(n,1e-4);
}
float ridge(vec3 p,int oct){
  float s=0.0,a=0.5,n=0.0;
  for(int i=0;i<8;i++){ if(i>=oct) break; s+=a*(1.0-abs(snoise(p))); n+=a; p*=2.03; a*=0.5; }
  return s/max(n,1e-4);
}
`;

const PLANET_VERT = `
varying vec3 vObj; varying vec3 vNrm; varying vec3 vWorld; varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vObj = normalize(position);
  vUv = uv;
  vNrm = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position,1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

const PLANET_FRAG = GLSL_NOISE + `
uniform vec3 uSunDir;     // dirección al Sol, espacio mundo
uniform vec3 uSunObj;     // dirección al Sol, espacio objeto
uniform vec3 uCA, uCB, uCC;
uniform float uLight;     // irradiancia relativa
uniform float uTime;      // días desde J2000
uniform float uAmb;
uniform vec2 uRing;       // radios de anillo en radios planetarios (0 = sin anillo)
uniform float uDetail;    // 0..1 según cercanía de la cámara
uniform float uGanancia;  // ajuste de exposición del mapa
uniform vec3 uEje;        // eje de rotación del cuerpo, espacio mundo
uniform int uNumCast;     // cuerpos que pueden eclipsar al Sol vistos desde aquí
uniform vec4 uCast[4];    // xyz = posición rel. cámara (unidades de escena) · w = radio
uniform vec3 uSunPos;     // Sol rel. cámara
uniform float uSunRad;
varying vec3 vObj; varying vec3 vNrm; varying vec3 vWorld; varying vec2 vUv;
#ifdef TEX
uniform sampler2D uMapa;
#endif
#ifdef TEX_TIERRA
uniform sampler2D uNoche; uniform sampler2D uAgua; uniform sampler2D uRelieve;
#endif
#include <common>
#include <logdepthbuf_pars_fragment>

float franja(float u, float a, float b, float f){
  return smoothstep(a, a+f, u) * (1.0 - smoothstep(b-f, b, u));
}

/* Fracción del disco solar tapada por un disco de radio angular b a separación d */
float solape(float a, float b, float d){
  if(d >= a + b) return 0.0;
  if(d <= b - a) return 1.0;
  if(d <= a - b) return (b*b)/(a*a);
  float a2 = a*a, b2 = b*b;
  float x = (d*d + a2 - b2) / (2.0*d);
  float y = sqrt(max(a2 - x*x, 0.0));
  float A = a2*acos(clamp(x/a,-1.0,1.0)) + b2*acos(clamp((d-x)/b,-1.0,1.0)) - d*y;
  return clamp(A / (3.14159265*a2), 0.0, 1.0);
}

/* Eclipse real: cuánto Sol pierde este punto de la superficie */
float ocultacion(vec3 X){
  vec3 S = uSunPos - X;
  float dS = length(S);
  float rs = asin(clamp(uSunRad/dS, 0.0, 1.0));
  vec3 sn = S / dS;
  float occ = 0.0;
  for(int k = 0; k < 4; k++){
    if(k >= uNumCast) break;
    vec3 C = uCast[k].xyz - X;
    float dC = length(C);
    if(dC >= dS || dC < uCast[k].w) continue;
    float rc = asin(clamp(uCast[k].w/dC, 0.0, 1.0));
    float sep = acos(clamp(dot(sn, C/dC), -1.0, 1.0));
    occ += solape(rs, rc, sep);
  }
  return clamp(occ, 0.0, 1.0);
}

// sombra proyectada por los anillos sobre el planeta
float ringShadow(vec3 P){
  if(uRing.y <= 0.0) return 1.0;
  vec3 S = uSunObj;
  if(abs(S.y) < 1e-4) return 1.0;
  float t = -P.y / S.y;
  if(t <= 0.0) return 1.0;
  vec3 H = P + t * S;
  float r = length(H.xz);
  if(r < uRing.x || r > uRing.y) return 1.0;
  float u = (r - uRing.x) / (uRing.y - uRing.x);
  float dens = 0.17 * franja(u, 0.000, 0.266, 0.020)     // anillo C
             + 0.98 * franja(u, 0.266, 0.656, 0.010)     // anillo B
             + 0.66 * franja(u, 0.726, 0.949, 0.013)     // anillo A
             + 0.30 * franja(u, 0.958, 0.998, 0.005);    // anillo F
  dens *= 1.0 - 0.88 * franja(u, 0.896, 0.904, 0.0015);  // división de Encke
  dens = clamp(dens, 0.0, 1.0) * 0.86;
  return 1.0 - dens;
}

void main(){
  vec3 P = vObj;
  vec3 N = normalize(vNrm);
  vec3 V = normalize(-vWorld);
  float lat = P.y;                       // -1..1
  vec3 col; float spec = 0.0; float shine = 40.0; float tierraFirme = 0.0;

#if defined(TEX)
  /* Mapa fotográfico real, proyección equirectangular.
     Se usa el atributo uv de la esfera (no atan2) para que no haya costura. */
  col = texture2D(uMapa, vUv).rgb * uGanancia;
  #if defined(TEX_TIERRA)
    float agua = texture2D(uAgua, vUv).r;
    tierraFirme = 1.0 - agua;
    spec = agua * 0.95; shine = 120.0;
    /* Relieve del terreno. La base tangente se arma en espacio mundo a partir
       del eje del planeta: T apunta al este y B al norte.                   */
    vec3 nm = texture2D(uRelieve, vUv).rgb * 2.0 - 1.0;
    nm.xy *= 0.85 * uDetail;
    vec3 este = cross(uEje, N);
    float le = length(este);
    if(le > 0.02){
      este /= le;
      vec3 norte = cross(N, este);
      N = normalize(este*nm.x + norte*nm.y + N*max(nm.z, 0.25));
    }
  #endif

#elif defined(SUN)
  float gran = fbm(P*26.0 + vec3(uTime*0.35), 4, 2.1, 0.55);
  float cell = ridge(P*9.0 - vec3(uTime*0.12), 3);
  float limb = pow(max(dot(N,V),0.0), 0.62);
  col = mix(uCB*0.72, uCA, limb);
  col *= 0.82 + 0.34*gran + 0.16*cell;
  col += uCC * pow(1.0-limb, 2.4) * 0.85;
  vec3 fc = col * 1.55;
  gl_FragColor = vec4(fc,1.0);
  #include <logdepthbuf_fragment>
  return;

#elif defined(EARTH)
  vec3 q = P*1.55;
  float warp = fbm(q*2.4,3,2.0,0.5);
  float h = fbm(q + warp*0.35, 6, 2.15, 0.52);
  h += 0.20*fbm(P*7.0,4,2.0,0.5);
  float land = smoothstep(0.012, 0.075, h);
  float alt = smoothstep(0.05,0.30,h);
  vec3 ocean = mix(uCA*0.55, uCA, smoothstep(-0.35,0.02,h));
  float band = abs(lat);
  vec3 verde = mix(vec3(0.16,0.30,0.11), vec3(0.31,0.36,0.15), fbm(q*4.0,3,2.0,0.5)*0.5+0.5);
  vec3 desierto = vec3(0.52,0.42,0.24);
  vec3 tierra = mix(verde, desierto, smoothstep(0.14,0.36,band)*(1.0-smoothstep(0.45,0.62,band)));
  tierra = mix(tierra, vec3(0.42,0.40,0.36), alt*0.5);
  float hielo = smoothstep(0.74,0.86,band + fbm(P*6.0,3,2.0,0.5)*0.09);
  tierra = mix(tierra, vec3(0.90,0.92,0.95), hielo);
  ocean  = mix(ocean, vec3(0.82,0.87,0.92), smoothstep(0.80,0.90,band));
  col = mix(ocean, tierra, land);
  tierraFirme = land;
  spec = (1.0-land)*(1.0-hielo)*0.85; shine = 90.0;

#elif defined(MARS)
  float h   = fbm(P*2.3, 6, 2.1, 0.53);
  float alb = fbm(P*1.6 + vec3(3.1), 5, 2.0, 0.50);     // regiones claras y oscuras
  col = mix(uCB, uCA, smoothstep(-0.30, 0.30, alb));
  col *= 0.93 + 0.15*h;
  col *= 0.90 + 0.24*(ridge(P*16.0, 4) - 0.45)*uDetail;
  float polo = smoothstep(0.905, 0.978, abs(lat) + fbm(P*8.0,3,2.0,0.5)*0.030);
  col = mix(col, vec3(0.94,0.94,0.91), polo * (lat > 0.0 ? 0.88 : 1.0));

#elif defined(JUPITER) || defined(SATURN) || defined(URANUS) || defined(NEPTUNE)
  /* Las bandas son ZONALES: la turbulencia se estira muchísimo en longitud
     y muy poco en latitud, si no el ruido destruye las bandas.            */
  #if defined(JUPITER)
    float nb = 13.0, amp = 0.030, contraste = 1.00, drift = 0.020;
  #elif defined(SATURN)
    float nb = 11.0, amp = 0.024, contraste = 0.62, drift = 0.014;
  #elif defined(URANUS)
    float nb =  7.0, amp = 0.010, contraste = 0.15, drift = 0.004;
  #else
    float nb =  8.0, amp = 0.017, contraste = 0.36, drift = 0.008;
  #endif
  float t = uTime * drift;
  float warp  = fbm(vec3(P.x*3.0 + t,       P.y*1.10, P.z*3.0 + t),       5, 2.15, 0.55);
  float warp2 = fbm(vec3(P.x*9.0 - t*1.6,   P.y*2.60, P.z*9.0 - t*1.6),   4, 2.20, 0.50);
  float phi = asin(clamp(P.y, -1.0, 1.0)) / 1.5707963;   // latitud normalizada
  float y = phi + warp*amp + warp2*amp*0.45;

  float b = smoothstep(-0.52, 0.52, sin(y * nb * 3.14159));
  float sel = fbm(vec3(0.0, y*nb*0.55, 0.0), 3, 2.0, 0.5);      // unas franjas más oscuras
  vec3 zona = mix(uCA, uCB, clamp(0.5 + sel*0.95, 0.0, 1.0));
  col = mix(uCA, zona, b*contraste + 0.10);

  float hilos = fbm(vec3(P.x*7.0 + t*2.2, P.y*44.0, P.z*7.0 + t*2.2), 3, 2.1, 0.5);
  col *= 1.0 + hilos * 0.10 * contraste * uDetail;
  float rem = fbm(vec3(P.x*12.0 + t*3.0, P.y*4.5, P.z*12.0 + t*3.0), 4, 2.3, 0.55);
  col += uCC * rem * 0.11 * contraste;
  float polar = smoothstep(0.60, 0.97, abs(phi));         // capucha polar
  col = mix(col, mix(uCA, uCB, 0.55) * 0.80, polar * 0.62 * contraste);
  #if defined(JUPITER)
    // Gran Mancha Roja: óvalo achatado a 22° sur
    vec3 gm = normalize(vec3(cos(-t*1.9), -0.375, sin(-t*1.9)));
    float d = distance(vec3(P.x, P.y*3.1, P.z), vec3(gm.x, gm.y*3.1, gm.z));
    float mancha = 1.0 - smoothstep(0.11, 0.34, d + fbm(P*13.0,3,2.0,0.5)*0.035);
    col = mix(col, vec3(0.66,0.30,0.18), mancha*0.92);
    col = mix(col, vec3(0.86,0.66,0.48), mancha*(1.0-mancha)*0.7);
  #endif
  #if defined(NEPTUNE)
    vec3 dm = normalize(vec3(cos(t*2.3+1.0), 0.40, sin(t*2.3+1.0)));
    float d2 = distance(vec3(P.x, P.y*2.6, P.z), vec3(dm.x, dm.y*2.6, dm.z));
    col = mix(col, vec3(0.08,0.12,0.34), (1.0-smoothstep(0.10,0.28,d2))*0.80);
  #endif

#elif defined(VENUS)
  vec3 w = vec3(P.x*2.4 + uTime*0.010, P.y*4.0, P.z*2.4 + uTime*0.010);
  float warp = fbm(w*2.0, 4, 2.1, 0.55);
  float n = fbm(w + warp*0.7, 6, 2.2, 0.55);
  float bandas = sin((lat + n*0.5) * 9.0) * 0.5 + 0.5;
  col = mix(uCA, uCB, clamp(bandas*0.26 + n*0.24 + 0.38, 0.0, 1.0));
  col = mix(col, uCC, smoothstep(0.62,0.97,abs(lat))*0.30);

#elif defined(IO)
  float n = fbm(P*3.0, 5, 2.1, 0.53);
  col = mix(uCA, uCB, clamp(n*1.15 + 0.5, 0.0, 1.0));
  float manchas = smoothstep(0.36, 0.66, fbm(P*5.5 + vec3(9.0), 4, 2.2, 0.50)*0.5 + 0.5);
  col = mix(col, uCC, manchas*0.72);                    // depósitos de azufre oscuros
  float calderas = smoothstep(0.80, 0.94, fbm(P*13.0 + vec3(2.0), 3, 2.1, 0.5)*0.5 + 0.5);
  col = mix(col, uCC*0.55, calderas*0.8*uDetail);
  col *= 0.93 + 0.13*fbm(P*20.0,3,2.0,0.5);

#elif defined(EUROPA)
  float n = fbm(P*4.0, 4, 2.0, 0.5);
  col = mix(uCA, uCB, n*0.32 + 0.5);
  /* Lineae: se dibuja la curva de nivel cero de un campo de ruido, que da
     grietas largas y sinuosas en vez de manchas.                         */
  float g = 0.0;
  for(int k = 0; k < 3; k++){
    float f = 2.4 + float(k)*2.3;
    float w = fbm(P*f + vec3(float(k)*23.0), 4, 2.15, 0.55);
    g = max(g, 1.0 - smoothstep(0.0, 0.050 - float(k)*0.010, abs(w)));
  }
  col = mix(col, uCC, g*0.40*uDetail);
  col *= 0.95 + 0.10*fbm(P*22.0, 3, 2.0, 0.5);

#elif defined(TITAN)
  float n = fbm(P*2.6, 5, 2.1, 0.55);
  col = mix(uCA, uCB, n*0.5+0.5);
  col = mix(col, uCC, smoothstep(0.6,0.95,abs(lat))*0.35);

#elif defined(ICEMOON)
  float n = fbm(P*3.4, 5, 2.1, 0.52);
  float cr = ridge(P*10.0, 4);
  col = mix(uCA, uCB, n*0.5+0.5);
  col *= 0.90 + 0.18*cr*uDetail;
  spec = 0.25; shine = 60.0;

#elif defined(PLUTO)
  float n = fbm(P*2.4, 6, 2.1, 0.53);
  float m = fbm(P*1.3+vec3(5.0), 4, 2.0, 0.5);
  col = mix(uCB, uCA, smoothstep(-0.25,0.30,n));
  col = mix(col, uCC, smoothstep(0.10,0.45,m)*0.7);
  col *= 0.88 + 0.22*ridge(P*13.0,3)*uDetail;

#else /* ROCK / MOON: superficie craterizada */
  float maria = smoothstep(-0.16, 0.40, fbm(P*1.8, 5, 2.0, 0.5));
  col = mix(uCB, uCA, maria);
  col *= 0.88 + 0.26*(ridge(P*11.0, 4) - 0.45);
  col *= 0.94 + 0.16*(ridge(P*38.0, 3) - 0.48)*uDetail;
  col *= 0.96 + 0.08*fbm(P*4.0 + vec3(7.0), 3, 2.0, 0.5);

#endif

  /* ---- iluminación ---- */
  float ndl = dot(N, uSunDir);
  float lam = smoothstep(-0.06, 0.14, ndl);
  float ndv = max(dot(N, V), 0.0);
#ifdef TEX
  float limbo = 0.68 + 0.32 * pow(ndv, 0.45);
#else
  float limbo = 0.50 + 0.50 * pow(ndv, 0.42);     // oscurecimiento hacia el borde
#endif
  float sombra = ringShadow(P);
  float ecl = uNumCast > 0 ? ocultacion(vWorld) : 0.0;
  vec3 lit = col * (uAmb + lam * uLight * sombra * limbo * pow(1.0 - ecl, 2.4));
#ifdef ECLROJO
  /* luz refractada por la atmósfera terrestre: la Luna eclipsada se pone roja */
  lit += col * vec3(0.62, 0.135, 0.030) * (ecl*ecl) * uLight * lam;
#endif

#if defined(TEX_TIERRA)
  float noche = smoothstep(0.12, -0.10, ndl);
  if(noche > 0.002){
    vec3 luces = texture2D(uNoche, vUv).rgb;
    // el mapa trae un fondo tenue no negro: se recorta para que solo brillen ciudades
    float L = max(luces.r, max(luces.g, luces.b));
    luces *= smoothstep(0.07, 0.24, L) * 1.6;
    lit += luces * vec3(1.0, 0.84, 0.55) * noche;
  }
#elif defined(EARTH)
  float noche = smoothstep(0.10, -0.12, ndl);
  if(noche > 0.002){
    float ciudad = smoothstep(0.55, 0.92, fbm(P*22.0, 4, 2.1, 0.5)*0.5+0.5);
    lit += vec3(1.0,0.80,0.46) * tierraFirme * ciudad * noche * 0.30
         * (1.0 - smoothstep(0.62, 0.82, abs(lat)));
  }
#endif

#ifdef TEX
  float mx = max(lit.r, max(lit.g, lit.b));
  if(mx > 0.86) lit *= (0.86 + (mx - 0.86) / (1.0 + (mx - 0.86) * 2.6)) / mx;
#endif

  if(spec > 0.0){
    vec3 H = normalize(uSunDir + V);
    lit += vec3(1.0,0.97,0.90) * pow(max(dot(N,H),0.0), shine) * spec * lam * uLight * 0.55 * (1.0 - ecl);
  }
  gl_FragColor = vec4(lit, 1.0);
  #include <logdepthbuf_fragment>
}`;

/* ---------- atmósfera (halo en el borde) ---------- */
const ATMO_VERT = `
varying vec3 vNrm; varying vec3 vWorld;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vNrm = normalize(mat3(modelMatrix)*normal);
  vec4 wp = modelMatrix * vec4(position,1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const ATMO_FRAG = `
uniform vec3 uColor; uniform vec3 uSunDir; uniform float uLight; uniform float uPow;
varying vec3 vNrm; varying vec3 vWorld;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  vec3 N = normalize(vNrm); vec3 V = normalize(-vWorld);
  float rim = pow(1.0 - max(dot(N,V),0.0), uPow);
  float lam = smoothstep(-0.12, 0.42, dot(N,uSunDir));
  float disp = pow(max(dot(V,-uSunDir),0.0),2.0)*0.55 + 0.45;   // dispersión hacia delante
  gl_FragColor = vec4(uColor, rim * lam * uLight * disp * 0.72);
  #include <logdepthbuf_fragment>
}`;

/* ---------- nubes terrestres (mapa real, deriva lenta) ---------- */
const CLOUD_FRAG = `
uniform sampler2D uNubes;
uniform vec3 uSunDir; uniform float uLight;
varying vec3 vNrm; varying vec3 vWorld; varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  float a = texture2D(uNubes, vUv).r;
  a = smoothstep(0.05, 0.62, a);
  if(a < 0.004) discard;
  vec3 N = normalize(vNrm);
  float lam = smoothstep(-0.09, 0.20, dot(N, uSunDir));
  float ndv = max(dot(N, normalize(-vWorld)), 0.0);
  gl_FragColor = vec4(vec3(1.0, 0.995, 0.985) * (0.045 + lam * uLight * (0.72 + 0.28*ndv)), a * 0.94);
  #include <logdepthbuf_fragment>
}`;

/* ---------- anillos ---------- */
const RING_VERT = `
varying vec3 vObj; varying vec3 vWorld;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vObj = position;
  vec4 wp = modelMatrix * vec4(position,1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const RING_FRAG = GLSL_NOISE + `
uniform vec3 uSunObj; uniform vec3 uCA, uCB;
uniform vec2 uRad;         // radio interior / exterior en radios planetarios
uniform float uLight; uniform float uOpacity; uniform float uDetalle;
varying vec3 vObj; varying vec3 vWorld;
float franja(float u, float a, float b, float f){
  return smoothstep(a, a+f, u) * (1.0 - smoothstep(b-f, b, u));
}
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  float r = length(vObj.xz);
  float u = (r - uRad.x) / (uRad.y - uRad.x);
  if(u < 0.0 || u > 1.0) discard;

  float dens;
  if(uDetalle > 0.5){
    /* Radios reales normalizados sobre 74 500 – 140 220 km:
       C 74.5–92.0k · B 92.0–117.6k · Cassini 117.6–122.2k
       A 122.2–136.8k · Encke 133.6k · F 140.2k                     */
    dens  = 0.17 * franja(u, 0.000, 0.266, 0.020);
    dens += 0.98 * franja(u, 0.266, 0.656, 0.010);
    dens += 0.66 * franja(u, 0.726, 0.949, 0.013);
    dens += 0.30 * franja(u, 0.958, 0.998, 0.005);
    dens *= 1.0 - 0.88 * franja(u, 0.896, 0.904, 0.0015);          // división de Encke
    dens *= 0.86 + 0.28 * fbm(vec3(r*160.0, 0.0, 0.0), 4, 2.2, 0.55);
    dens *= 0.90 + 0.20 * snoise(vec3(vObj.x*0.9, r*52.0, vObj.z*0.9));
  } else {
    dens = 0.55 * franja(u, 0.0, 1.0, 0.12);
    dens *= 0.70 + 0.45 * fbm(vec3(r*90.0,0.0,0.0),3,2.1,0.5);
  }
  dens = clamp(dens, 0.0, 1.0);

  // sombra del planeta sobre el anillo
  vec3 S = uSunObj;
  float t = -dot(vObj, S);
  vec3 H = vObj + t * S;
  float sombra = 1.0;
  if(t > 0.0 && length(H) < 1.0){
    sombra = smoothstep(0.965, 1.0, length(H)) * 0.94 + 0.06;
  }

  vec3 col = mix(uCA, uCB, fbm(vec3(r*22.0, 1.0, 0.0), 3, 2.0, 0.5)*0.5+0.5);
  float a = dens * uOpacity;
  gl_FragColor = vec4(col * uLight * sombra * 1.45, a);
  #include <logdepthbuf_fragment>
}`;


/* ---------- nube de asteroides: Kepler resuelto en la GPU ---------- */
const AST_VERT = `
attribute float aA; attribute float aE; attribute float aI; attribute float aOm;
attribute float aW; attribute float aM0; attribute float aN; attribute float aS;
uniform float uJD;        // días desde J2000
uniform vec3 uCamKm;
uniform float uPix; uniform float uTam;
varying float vHash; varying float vLejos;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  float M = mod(aM0 + aN * uJD, 6.28318530718);
  float E = M + aE * sin(M);
  for(int k = 0; k < 5; k++){
    E -= (E - aE*sin(E) - M) / (1.0 - aE*cos(E));
  }
  float xp = aA * (cos(E) - aE);
  float yp = aA * sqrt(1.0 - aE*aE) * sin(E);
  float cw = cos(aW), sw = sin(aW), co = cos(aOm), so = sin(aOm), ci = cos(aI), si = sin(aI);
  vec3 P = vec3((cw*co - sw*so*ci)*xp + (-sw*co - cw*so*ci)*yp,
                (cw*so + sw*co*ci)*xp + (-sw*so + cw*co*ci)*yp,
                (sw*si)*xp + (cw*si)*yp);
  vec3 rel = (P - uCamKm) / 1000.0;
  float d = length(rel);
  gl_Position = projectionMatrix * viewMatrix * vec4(rel, 1.0);
  float px = uTam * aS * aS / max(d, 1.0) * 3000.0;
  vHash = fract(aM0 * 21.73 + aW * 7.91);
  gl_PointSize = clamp(px + 2.1 + vHash*0.9, 2.1, 7.0) * uPix;
  vLejos = clamp(px * 2.2 + 0.62, 0.75, 1.0);
  #include <logdepthbuf_vertex>
}`;

const AST_FRAG = `
uniform vec3 uC1; uniform vec3 uC2;
varying float vHash; varying float vLejos;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if(r > 1.0) discard;
  float a = pow(1.0 - r, 0.9);
  vec3 col = mix(uC1, uC2, vHash);
  gl_FragColor = vec4(col, a * vLejos);
  #include <logdepthbuf_fragment>
}`;
