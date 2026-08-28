/* ============================================================
   Generador del sitio estático: páginas con contenido real
   calculado (no plantillas vacías) para que sean indexables.
   ============================================================ */
import fs from 'node:fs';

const dir = new URL('.', import.meta.url).pathname;
const R = p => fs.readFileSync(dir + p, 'utf8');
const SRC = ['00-data.js','01-kepler.js','02-menores.js','03-luna.js','04-eclipses.js']
  .map(f => R('src/' + f)).join('\n');
// eval() en un módulo ESM no expone sus bindings: se extraen con new Function
const API = new Function(SRC + `
  return { DEG, AU, J2000, PC, LY, R_SOL, R_TIERRA, R_LUNA,
    dateToJD, jdToDate, planetPos, lunaGeo, buscarEclipses,
    BODIES, MOONS, MENORES, ELEM, menorPos };
`)();
const { DEG, AU, J2000, R_SOL, R_TIERRA, R_LUNA, dateToJD, jdToDate,
        planetPos, lunaGeo, buscarEclipses, BODIES, MOONS, MENORES, ELEM } = API;

const SITIO = (process.env.SITIO_URL || 'https://sistemasolar.example').replace(/\/+$/, '');
const BASE = process.env.BASE_URL
  || (new URL(SITIO).pathname.replace(/\/+$/, '') + '/');
const OUT = dir + 'publicar/';

const MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function fechaLarga(jd){
  const d = jdToDate(jd);
  return `${d.getUTCDate()} de ${MES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
function horaUTC(jd){
  const d = jdToDate(jd);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`;
}
function isoCorto(jd){
  const d = jdToDate(jd);
  return d.toISOString().slice(0,10);
}
function isoMin(jd){
  const d = jdToDate(jd);
  return d.toISOString().slice(0,16);
}

/* ---------- región geográfica de un punto ---------- */
function region(lat, lon){
  if (lat > 66) return 'el Ártico';
  if (lat < -60) return 'la Antártida';
  if (lon > -170 && lon < -30){
    if (lat > 15) return 'América del Norte';
    if (lat > -15) return lon < -80 ? 'el Pacífico oriental' : 'América Central y el Caribe';
    return 'América del Sur';
  }
  if (lon >= -30 && lon < 40){
    if (lat > 35) return lon < -12 ? 'el Atlántico Norte e Islandia' : 'Europa';
    if (lat > 12) return lon > 22 ? 'Egipto y el mar Rojo' : 'el norte de África';
    if (lat > -10) return lon < -5 ? 'el golfo de Guinea' : 'África central';
    return 'el sur de África';
  }
  if (lon >= 40 && lon < 100){
    if (lat > 40) return 'Rusia y Asia central';
    if (lat > 12) return 'Oriente Medio y el sur de Asia';
    return 'el océano Índico';
  }
  if (lon >= 100 && lon < 155){
    if (lat > 20) return 'Asia oriental';
    if (lat > -8) return 'el sureste asiático';
    return 'Australia';
  }
  return 'el océano Pacífico';
}

const OB = 23.4392911 * DEG;
function eclToGeo(P, jd){          // P relativo al centro de la Tierra, marco eclíptico
  const d = Math.hypot(P[0], P[1], P[2]);
  const q = [P[0], P[1]*Math.cos(OB) - P[2]*Math.sin(OB), P[1]*Math.sin(OB) + P[2]*Math.cos(OB)];
  const lat = Math.asin(q[2]/d) / DEG;
  const ra = Math.atan2(q[1], q[0]) / DEG;
  const T = (jd - J2000) / 36525;
  const gmst = ((280.46061837 + 360.98564736629*(jd - J2000) + 0.000387933*T*T) % 360 + 360) % 360;
  let lon = (ra - gmst) % 360;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

/* Punto de la Tierra donde el eclipse solar es máximo: intersección del eje de
   sombra con la superficie (raíz cercana al Sol). Si el eje no llega a cortar el
   globo (eclipse solo parcial), se usa el punto de superficie más próximo.     */
function puntoMaximoSolar(jd){
  const E = [0,0,0], L = [0,0,0];
  planetPos('tierra', jd, E); lunaGeo(jd, L);
  const M = [E[0]+L[0], E[1]+L[1], E[2]+L[2]];
  const dSM = Math.hypot(M[0], M[1], M[2]);
  const u = [M[0]/dSM, M[1]/dSM, M[2]/dSM];
  const w = [-L[0], -L[1], -L[2]];                   // Luna -> centro de la Tierra
  const b = w[0]*u[0] + w[1]*u[1] + w[2]*u[2];
  const c = w[0]*w[0] + w[1]*w[1] + w[2]*w[2] - R_TIERRA*R_TIERRA;
  const disc = b*b - c;
  let P;
  if (disc >= 0){
    const s = b - Math.sqrt(disc);                   // primera intersección (cara al Sol)
    P = [-w[0] + s*u[0], -w[1] + s*u[1], -w[2] + s*u[2]];
  } else {
    const t = b;
    const q = [w[0]-t*u[0], w[1]-t*u[1], w[2]-t*u[2]];
    const d = Math.hypot(q[0], q[1], q[2]);
    P = [-q[0]/d*R_TIERRA, -q[1]/d*R_TIERRA, -q[2]/d*R_TIERRA];
  }
  return eclToGeo(P, jd);
}
/* punto donde la Luna está en el cenit (mejor visión de un eclipse lunar) */
function puntoSubLunar(jd){
  const L = [0,0,0]; lunaGeo(jd, L);
  const d = Math.hypot(L[0], L[1], L[2]);
  return eclToGeo([L[0]/d*R_TIERRA, L[1]/d*R_TIERRA, L[2]/d*R_TIERRA], jd);
}

/* ---------- catálogo de eclipses ---------- */
const desde = dateToJD(new Date(Date.UTC(2026, 0, 1)));
const eclipses = buscarEclipses(desde, 130).filter(e => jdToDate(e.jd).getUTCFullYear() <= 2040);
console.log('eclipses calculados:', eclipses.length,
  '· de', isoCorto(eclipses[0].jd), 'a', isoCorto(eclipses[eclipses.length-1].jd));

for (const e of eclipses){
  const g = e.clase === 'solar' ? puntoMaximoSolar(e.jd) : puntoSubLunar(e.jd);
  e.geo = g;
  e.region = region(g.lat, g.lon);
  e.titulo = `Eclipse ${e.tipo} de ${e.clase === 'solar' ? 'Sol' : 'Luna'} del ${fechaLarga(e.jd)}`;
  e.slug = `eclipse-${e.tipo}-${e.clase === 'solar' ? 'sol' : 'luna'}-${isoCorto(e.jd)}`;
}

/* ---------- plantilla ---------- */
const CSS = `
:root{--void:#05060a;--panel:#0b0e14;--rule:#1b202a;--rule-alta:#2b3341;
--ink:#ece6da;--ink-2:#b9b3a8;--muted:#727a88;--signal:#ff5b41;--solar:#e8b15c;
--serif:"IBM Plex Serif",Georgia,serif;--cond:"IBM Plex Sans Condensed",Arial,sans-serif;
--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--void);color:var(--ink);font-family:var(--cond);
-webkit-font-smoothing:antialiased;line-height:1.6}
.env{max-width:760px;margin:0 auto;padding:48px 22px 80px}
a{color:var(--signal);text-decoration:none}a:hover{text-decoration:underline}
a:focus-visible{outline:1px solid var(--signal);outline-offset:3px}
.migas{font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.04em;margin-bottom:28px}
.migas a{color:var(--muted)}
.eyebrow{font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--signal);margin-bottom:8px}
h1{font-family:var(--serif);font-weight:400;font-size:clamp(26px,4.4vw,40px);line-height:1.15;
margin:0 0 18px;letter-spacing:-.01em;text-wrap:balance}
h2{font-family:var(--serif);font-weight:500;font-size:20px;margin:38px 0 12px}
p{max-width:65ch;color:var(--ink-2)}
.datos{margin:26px 0;border-top:1px solid var(--rule);font-family:var(--mono);font-size:12.5px;
font-variant-numeric:tabular-nums}
.datos div{display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid var(--rule)}
.datos dt{color:var(--muted);font-family:var(--cond);font-size:12.5px}
.datos dd{margin:0;text-align:right;color:var(--ink)}
.cta{display:inline-block;margin:22px 0 8px;padding:11px 20px;border:1px solid var(--signal);
color:var(--signal);font-size:12px;letter-spacing:.12em;text-transform:uppercase;transition:.15s}
.cta:hover{background:var(--signal);color:var(--void);text-decoration:none}
.nav{display:flex;justify-content:space-between;gap:16px;margin-top:52px;padding-top:20px;
border-top:1px solid var(--rule);font-size:13px}
footer{margin-top:64px;padding-top:22px;border-top:1px solid var(--rule);
font-family:var(--mono);font-size:10.5px;color:var(--muted);line-height:1.8}
ul.lista{list-style:none;padding:0;margin:22px 0;display:grid;gap:1px}
ul.lista li a{display:flex;justify-content:space-between;gap:14px;padding:9px 10px;
color:var(--ink-2);border:1px solid transparent}
ul.lista li a:hover{background:rgba(255,255,255,.04);border-color:var(--rule);text-decoration:none}
ul.lista em{font-style:normal;font-family:var(--mono);font-size:11px;color:var(--muted);white-space:nowrap}
.grupo-anio{font-family:var(--mono);font-size:11px;color:var(--solar);letter-spacing:.1em;
margin:26px 0 6px;padding-bottom:5px;border-bottom:1px solid var(--rule)}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;

function pagina({ titulo, desc, canonica, cuerpo, jsonld }){
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITIO}${canonica}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITIO}${canonica}">
<meta property="og:image" content="${SITIO}/og.png">
<meta property="og:locale" content="es_MX">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#05060a">
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Ctext%20y='.9em'%20font-size='90'%3E%F0%9F%AA%90%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@400;500;600&family=IBM+Plex+Serif:ital,wght@0,400;0,500;1,400&display=swap">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<main class="env">
${cuerpo}
<footer>
Posiciones calculadas con elementos keplerianos del JPL y la teoría lunar ELP (Meeus).
Los eclipses se determinan por geometría de conos de sombra, no de un calendario precargado.
Las horas son UTC. · <a href="${BASE}">Abrir el simulador</a>
</footer>
</main>
</body>
</html>`;
}

/* ---------- páginas de eclipse ---------- */
fs.mkdirSync(OUT + 'eclipse', { recursive: true });
const urls = [{ loc: '/', prio: '1.0' }, { loc: '/explorar/', prio: '0.8' }];

eclipses.forEach((e, i) => {
  const prev = eclipses[i-1], next = eclipses[i+1];
  const solar = e.clase === 'solar';
  const donde = `${Math.abs(e.geo.lat).toFixed(1)}° ${e.geo.lat >= 0 ? 'N' : 'S'}, ${Math.abs(e.geo.lon).toFixed(1)}° ${e.geo.lon >= 0 ? 'E' : 'O'}`;
  const desc = solar
    ? `El ${fechaLarga(e.jd)} la Luna tapa el Sol en un eclipse ${e.tipo}. Máximo a las ${horaUTC(e.jd)} sobre ${e.region}. Explóralo en 3D con las posiciones reales.`
    : `El ${fechaLarga(e.jd)} la Luna entra en la sombra de la Tierra en un eclipse ${e.tipo}. Máximo a las ${horaUTC(e.jd)}, mejor visible desde ${e.region}.`;

  const explica = solar
    ? (e.tipo === 'total'
        ? `Durante unos minutos la Luna cubre el disco solar por completo y aparece la corona. La franja de totalidad es estrecha: fuera de ella el eclipse se ve parcial.`
        : e.tipo === 'anular'
          ? `La Luna está cerca de su apogeo, así que se ve más pequeña que el Sol y no alcanza a taparlo del todo: queda un anillo de luz alrededor del disco oscuro.`
          : `La Luna pasa por delante del Sol sin cubrir su centro: desde la Tierra se ve un mordisco en el disco solar.`)
    : (e.tipo === 'total'
        ? `La Luna entra por completo en la umbra terrestre. No desaparece: la atmósfera de la Tierra refracta la luz roja del Sol y la tiñe de cobre, el efecto que llaman Luna de sangre.`
        : e.tipo === 'parcial'
          ? `Solo una parte del disco lunar entra en la umbra de la Tierra: se ve una mordida oscura de borde curvo, que es la sombra de nuestro planeta.`
          : `La Luna atraviesa la penumbra, la zona donde la Tierra tapa el Sol solo en parte. El oscurecimiento es sutil y fácil de pasar por alto.`);

  const filas = [
    ['Tipo', `${e.tipo} de ${solar ? 'Sol' : 'Luna'}`],
    ['Fecha', fechaLarga(e.jd)],
    ['Máximo', horaUTC(e.jd)],
    [solar ? 'Mejor visible desde' : 'Luna en el cenit sobre', `${e.region} (${donde})`]
  ];
  if (solar && e.gamma !== undefined) filas.push(['Gamma', e.gamma.toFixed(3)]);

  const cuerpo = `
<nav class="migas"><a href="${BASE}">Sistema Solar</a> / <a href="${BASE}explorar/">Eclipses</a> / ${esc(isoCorto(e.jd))}</nav>
<div class="eyebrow">Eclipse ${esc(e.tipo)} de ${solar ? 'Sol' : 'Luna'}</div>
<h1>${esc(e.titulo)}</h1>
<p>${esc(explica)}</p>
<dl class="datos">
${filas.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
</dl>
<p>Puedes situarte en el momento exacto y ver la geometría desde el espacio: la sombra
proyectada sobre la superficie, la posición real de la Tierra y la Luna, y el terminador
cayendo sobre la geografía correcta para esa hora.</p>
<a class="cta" href="${BASE}?f=${isoMin(e.jd - 35/1440)}&amp;foco=${solar ? 'tierra' : 'luna'}&amp;d=${solar ? 30000 : 5600}&amp;vel=2">Ver este eclipse en 3D</a>
<h2>Cómo se calculó</h2>
<p>La fecha no viene de una tabla: se busca el instante en que la Luna y el Sol quedan
alineados en longitud eclíptica, y después se mide si los conos de sombra realmente se
cruzan con la Tierra. El tipo (${esc(e.tipo)}) sale de comparar los radios angulares de
los discos en ese instante.</p>
<nav class="nav">
<span>${prev ? `<a href="${BASE}eclipse/${prev.slug}/">← ${esc(prev.titulo.replace('Eclipse ',''))}</a>` : ''}</span>
<span>${next ? `<a href="${BASE}eclipse/${next.slug}/">${esc(next.titulo.replace('Eclipse ',''))} →</a>` : ''}</span>
</nav>`;

  const html = pagina({
    titulo: `${e.titulo} — Sistema Solar 3D`,
    desc, canonica: `/eclipse/${e.slug}/`, cuerpo,
    jsonld: { '@context':'https://schema.org', '@type':'Event', name: e.titulo,
      startDate: isoMin(e.jd) + ':00Z', eventStatus:'https://schema.org/EventScheduled',
      eventAttendanceMode:'https://schema.org/OnlineEventAttendanceMode',
      description: desc, location:{ '@type':'Place', name: e.region,
        geo:{ '@type':'GeoCoordinates', latitude:+e.geo.lat.toFixed(2), longitude:+e.geo.lon.toFixed(2) } } }
  });
  fs.mkdirSync(`${OUT}eclipse/${e.slug}`, { recursive: true });
  fs.writeFileSync(`${OUT}eclipse/${e.slug}/index.html`, html);
  urls.push({ loc: `/eclipse/${e.slug}/`, prio: '0.6' });
});

/* ---------- páginas de cuerpos ---------- */
fs.mkdirSync(OUT + 'cuerpo', { recursive: true });
const fichas = [
  ...BODIES.map(b => ({ ...b, tipoPag: 'cuerpo' })),
  ...MENORES.map(b => ({ ...b, tipoPag: 'menor' }))
];
for (const b of fichas){
  if (b.id === 'sol') continue;
  const el = ELEM[b.id];
  const filas = [['Tipo', b.tipo], ['Radio medio', `${b.r.toLocaleString('es-MX')} km`]];
  if (b.mass) filas.push(['Masa', `${b.mass.toExponential(3)} kg`]);
  if (b.grav) filas.push(['Gravedad en superficie', `${b.grav} m/s²`]);
  if (b.temp !== undefined) filas.push(['Temperatura media', `${b.temp} °C`]);
  if (b.rot) filas.push(['Día (rotación)', `${Math.abs(b.rot).toFixed(3)} días${b.rot < 0 ? ' (retrógrado)' : ''}`]);
  if (b.tilt !== undefined) filas.push(['Inclinación axial', `${b.tilt}°`]);
  if (b.lunas !== undefined) filas.push(['Lunas conocidas', b.lunas]);
  let a = null, e2 = null;
  if (el){ a = el[0]; e2 = el[2]; }
  else if (b.el){ a = b.el.a; e2 = b.el.e; }
  if (a){
    const P = Math.pow(a, 1.5);
    filas.push(['Semieje mayor', `${a.toFixed(4)} UA (${(a*AU/1e6).toFixed(1)} millones de km)`]);
    filas.push(['Año orbital', P < 2 ? `${(P*365.25).toFixed(1)} días` : `${P.toFixed(2)} años terrestres`]);
    filas.push(['Perihelio', `${(a*(1-e2)).toFixed(3)} UA`]);
    filas.push(['Afelio', `${(a*(1+e2)).toFixed(3)} UA`]);
    filas.push(['Excentricidad', e2.toFixed(4)]);
    filas.push(['Luz del Sol', `${(a*AU/299792.458/60).toFixed(1)} minutos`]);
  }
  const desc = `${b.nombre}: datos reales, órbita y posición actual. ${b.nota || ''}`.slice(0, 180);
  const cuerpo = `
<nav class="migas"><a href="${BASE}">Sistema Solar</a> / <a href="${BASE}explorar/">Cuerpos</a> / ${esc(b.nombre)}</nav>
<div class="eyebrow">${esc(b.tipo)}</div>
<h1>${esc(b.nombre)}</h1>
${b.nota ? `<p>${esc(b.nota)}</p>` : ''}
<dl class="datos">
${filas.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
</dl>
<a class="cta" href="${BASE}?foco=${b.id}">Ver ${esc(b.nombre)} en 3D</a>
<h2>Dónde está ahora</h2>
<p>El simulador calcula su posición para la fecha y hora que le pidas, con elementos
orbitales del JPL. Puedes adelantar el tiempo y ver cómo recorre su órbita, o retroceder
a cualquier momento entre 1800 y 2050.</p>
<nav class="nav"><span><a href="${BASE}explorar/">← Todos los cuerpos</a></span></nav>`;
  fs.mkdirSync(`${OUT}cuerpo/${b.id}`, { recursive: true });
  fs.writeFileSync(`${OUT}cuerpo/${b.id}/index.html`, pagina({
    titulo: `${b.nombre} — datos, órbita y simulador 3D`,
    desc, canonica: `/cuerpo/${b.id}/`, cuerpo
  }));
  urls.push({ loc: `/cuerpo/${b.id}/`, prio: '0.7' });
}

/* ---------- índice explorable ---------- */
const porAnio = {};
for (const e of eclipses){
  const y = jdToDate(e.jd).getUTCFullYear();
  (porAnio[y] ||= []).push(e);
}
const listaCuerpos = fichas.filter(b => b.id !== 'sol')
  .map(b => `<li><a href="${BASE}cuerpo/${b.id}/">${esc(b.nombre)}<em>${esc(b.tipo)}</em></a></li>`).join('\n');
const listaEclipses = Object.keys(porAnio).sort().map(y =>
  `<div class="grupo-anio">${y}</div>\n<ul class="lista">\n` +
  porAnio[y].map(e => `<li><a href="${BASE}eclipse/${e.slug}/">${esc(e.titulo.replace(/^Eclipse /,'Eclipse '))}<em>${esc(horaUTC(e.jd))}</em></a></li>`).join('\n') +
  `\n</ul>`).join('\n');

fs.mkdirSync(OUT + 'explorar', { recursive: true });
fs.writeFileSync(OUT + 'explorar/index.html', pagina({
  titulo: 'Eclipses y cuerpos del sistema solar — índice',
  desc: `Todos los eclipses de Sol y Luna entre 2026 y 2040 calculados por geometría de sombras, y fichas de cada planeta, asteroide y cometa del simulador.`,
  canonica: '/explorar/',
  cuerpo: `
<nav class="migas"><a href="${BASE}">Sistema Solar</a> / Explorar</nav>
<div class="eyebrow">Índice</div>
<h1>Eclipses y cuerpos</h1>
<p>Cada eclipse de esta lista se calculó resolviendo la geometría real de las sombras,
no se copió de un calendario. Pulsa cualquiera para ver su ficha y abrirlo en el
simulador en el instante exacto.</p>
<h2>Cuerpos</h2>
<ul class="lista">${listaCuerpos}</ul>
<h2>Eclipses ${Object.keys(porAnio).sort()[0]}–${Object.keys(porAnio).sort().slice(-1)[0]}</h2>
${listaEclipses}`
}));

/* ---------- robots + sitemap ---------- */
fs.writeFileSync(OUT + 'robots.txt',
`User-agent: *
Allow: /

Sitemap: ${SITIO}/sitemap.xml
`);
fs.writeFileSync(OUT + 'sitemap.xml',
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITIO}${u.loc}</loc><priority>${u.prio}</priority></url>`).join('\n')}
</urlset>
`);

/* ---------- rewrites para rutas bonitas del simulador ---------- */
fs.writeFileSync(OUT + '_redirects',
`/fecha/*   /index.html   200
/date/*    /index.html   200
`);
fs.writeFileSync(OUT + 'vercel.json', JSON.stringify({
  rewrites: [
    { source: '/fecha/:resto*', destination: '/index.html' },
    { source: '/date/:resto*', destination: '/index.html' }
  ],
  headers: [{ source: '/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] }]
}, null, 2));

console.log(`páginas: ${urls.length} · eclipses ${eclipses.length} · cuerpos ${fichas.length - 1}`);
