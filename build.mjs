import fs from 'node:fs';
import crypto from 'node:crypto';

const dir = new URL('.', import.meta.url).pathname;
const R = p => fs.readFileSync(dir + p, 'utf8');
const hash = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);

/* --- three.js ESM -> objeto THREE local (sin import maps, sin CDN) --- */
let three = R('three.min.js').trim();
const m = three.match(/export\{([^}]*)\};?\s*$/);
if (!m) throw new Error('no encontré la declaración export de three.js');
const pares = m[1].split(',').map(s => {
  const t = s.trim();
  const g = t.match(/^(.+?)\s+as\s+(.+)$/);
  return g ? `${JSON.stringify(g[2].trim())}:${g[1].trim()}` : `${JSON.stringify(t)}:${t}`;
});
three = three.slice(0, m.index) + `\nconst THREE={${pares.join(',')}};\n`;

const stars = R('stars.json');
const asts  = R('asteroides.json');
const sondas = R('sondas.json');
const archivosTex = fs.readdirSync(dir + 'texturas').filter(f => f.endsWith('.jpg')).sort();
const fuentes = fs.readdirSync(dir + 'src').filter(f => f.endsWith('.js')).sort();
const app = fuentes.map(f => R('src/' + f)).join('\n\n');

const NO_ASCII = new RegExp('[\\u0080-\\uffff]', 'g');

/* ============================================================
   Dos modos de empaquetado del mismo código:

   artifact — todo incrustado como data URI. El artifact publicado
     bloquea peticiones a servidores externos, así que la página
     tiene que bastarse a sí misma aunque pese 3 MB.

   sitio — texturas y catálogos como archivos aparte, con el hash
     del contenido en el nombre. Así el navegador los cachea para
     siempre y el HTML inicial baja a ~1 MB. Cambiar una textura
     cambia su hash y rompe la caché sola.
   ============================================================ */
function preambulo(modo){
  if (modo === 'artifact'){
    const tex = {};
    for (const f of archivosTex){
      tex[f.replace('.jpg','')] =
        'data:image/jpeg;base64,' + fs.readFileSync(dir + 'texturas/' + f).toString('base64');
    }
    return {
      pre: `const STARDATA = ${stars};\nconst ASTDATA = ${asts};\nconst SONDASDATA = ${sondas};\nconst TEXTURAS = ${JSON.stringify(tex)};`,
      preloads: '', assets: []
    };
  }

  const assets = [];
  const tex = {};
  for (const f of archivosTex){
    const buf = fs.readFileSync(dir + 'texturas/' + f);
    const nombre = f.replace('.jpg','') + '.' + hash(buf) + '.jpg';
    tex[f.replace('.jpg','')] = '/tex/' + nombre;      // absoluta: /fecha/... reescribe a index.html
    assets.push({ ruta: 'tex/' + nombre, buf });
  }
  const datos = {};
  for (const [clave, txt] of [['estrellas', stars], ['asteroides', asts], ['sondas', sondas]]){
    const buf = Buffer.from(txt);
    const nombre = clave + '.' + hash(buf) + '.json';
    datos[clave] = '/datos/' + nombre;
    assets.push({ ruta: 'datos/' + nombre, buf });
  }
  const pre = `const TEXTURAS = ${JSON.stringify(tex)};
const RUTAS_DATOS = ${JSON.stringify(datos)};
const bajar = async r => {
  const res = await fetch(r);
  if (!res.ok) throw new Error(r + ': ' + res.status);
  return res.json();
};
let STARDATA, ASTDATA, SONDASDATA;
try {
  [STARDATA, ASTDATA, SONDASDATA] = await Promise.all([
    bajar(RUTAS_DATOS.estrellas), bajar(RUTAS_DATOS.asteroides), bajar(RUTAS_DATOS.sondas)
  ]);
} catch (err) {
  // sin catálogos no hay nada que dibujar: decirlo en vez de dejar la pantalla colgada
  const c = document.getElementById('carga');
  if (c) c.innerHTML = '<h1>No se pudieron cargar los datos</h1>'
    + '<p>Revisa tu conexi\\u00f3n y vuelve a cargar la p\\u00e1gina.</p>';
  throw err;
}`;
  /* el navegador empieza a bajar lo crítico antes de leer el script */
  const preloads = [
    `<link rel="preload" as="fetch" crossorigin href="${datos.estrellas}">`,
    `<link rel="preload" as="fetch" crossorigin href="${datos.asteroides}">`,
    `<link rel="preload" as="fetch" crossorigin href="${datos.sondas}">`,
    `<link rel="preload" as="image" href="${tex.tierra}">`,
    `<link rel="preload" as="image" href="${tex.tierra_nubes}">`
  ].join('\n');
  return { pre, preloads, assets };
}

function documento(modo){
  const { pre, preloads, assets } = preambulo(modo);
  const script = `<script type="module">
const ES_SITIO = ${modo === 'sitio'};
${three}
${pre}
await (async function(){
"use strict";
${app}
})();
<\/script>
`;
  let html = R('shell.html') + '\n' + script;
  /* Escapa todo carácter fuera de ASCII: en el HTML como entidad numérica y en
     el JS como \uXXXX. Así los acentos no dependen de que el servidor mande la
     cabecera charset correcta — el archivo entero queda en ASCII puro.       */
  const corte = html.indexOf('<script type="module">');
  html = html.slice(0, corte).replace(NO_ASCII,
           c => '&#x' + c.charCodeAt(0).toString(16) + ';')
       + html.slice(corte).replace(NO_ASCII,
           c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return { html, preloads, assets };
}

/* ---- artifact: un solo archivo, sin <html>/<head> (los pone el host) ---- */
const A = documento('artifact');
fs.mkdirSync(dir + 'dist', { recursive: true });
fs.writeFileSync(dir + 'dist/sistema-solar.html', A.html);

/* ---- sitio: documento completo con head SEO y assets aparte ---- */
const DESC = 'Sistema solar 3D a escala real: posiciones planetarias calculadas con efemérides del JPL, 8 920 estrellas a su distancia verdadera, 11 850 asteroides, eclipses por geometría de sombras y viaje libre por el espacio. En español, sin instalar nada.';
const S = documento('sitio');
const cabezaSEO = `
<meta name="description" content="${DESC}">
<meta property="og:title" content="Sistema Solar a Escala">
<meta property="og:description" content="${DESC}">
<meta property="og:type" content="website">
<meta property="og:image" content="/og.png">
<meta property="og:locale" content="es_MX">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#05060a">
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Ctext%20y='.9em'%20font-size='90'%3E%F0%9F%AA%90%3C/text%3E%3C/svg%3E">
${S.preloads}
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"WebApplication","name":"Sistema Solar a Escala","description":"${DESC}","applicationCategory":"EducationalApplication","operatingSystem":"Web","offers":{"@type":"Offer","price":"0"},"inLanguage":"es"}
</script>`;
const corteEstilo = S.html.indexOf('</style>') + 8;
const publico = '<!doctype html>\n<html lang="es">\n<head>\n'
  + S.html.slice(0, corteEstilo) + cabezaSEO + '\n</head>\n<body>\n'
  + S.html.slice(corteEstilo) + '\n</body>\n</html>\n';

fs.mkdirSync(dir + 'publicar/tex', { recursive: true });
fs.mkdirSync(dir + 'publicar/datos', { recursive: true });
/* limpiar assets con hash viejo para que no se acumulen entre compilaciones */
for (const sub of ['tex', 'datos']){
  for (const f of fs.readdirSync(dir + 'publicar/' + sub)){
    fs.unlinkSync(dir + 'publicar/' + sub + '/' + f);
  }
}
for (const a of S.assets) fs.writeFileSync(dir + 'publicar/' + a.ruta, a.buf);
fs.copyFileSync(dir + 'assets/og.png', dir + 'publicar/og.png');
fs.writeFileSync(dir + 'publicar/index.html', publico);

/* cabeceras de caché: los assets llevan hash, así que son inmutables */
fs.writeFileSync(dir + 'publicar/_headers',
`/tex/*
  Cache-Control: public, max-age=31536000, immutable
/datos/*
  Cache-Control: public, max-age=31536000, immutable
/og.png
  Cache-Control: public, max-age=604800
/*.html
  Cache-Control: public, max-age=0, must-revalidate
/
  Cache-Control: public, max-age=0, must-revalidate
`);
fs.writeFileSync(dir + 'publicar/vercel.json', JSON.stringify({
  rewrites: [
    { source: '/fecha/:resto*', destination: '/index.html' },
    { source: '/date/:resto*', destination: '/index.html' }
  ],
  headers: [
    { source: '/tex/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/datos/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/(.*).html', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] }
  ]
}, null, 2));

const kbA = (fs.statSync(dir + 'dist/sistema-solar.html').size / 1024).toFixed(0);
const kbS = (fs.statSync(dir + 'publicar/index.html').size / 1024).toFixed(0);
const kbAssets = (S.assets.reduce((n, a) => n + a.buf.length, 0) / 1024).toFixed(0);
const noAscii = [...A.html].filter(c => c.charCodeAt(0) > 127).length;
console.log(`dist/sistema-solar.html: ${kbA} KB en un archivo`);
console.log(`sitio:    ${kbS} KB de HTML + ${S.assets.length} assets con hash (${kbAssets} KB cacheables)`);
console.log(`${archivosTex.length} texturas · ${pares.length} símbolos de three · ${fuentes.length} módulos · no ASCII: ${noAscii}`);
