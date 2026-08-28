# Sistema Solar a Escala

Simulador 3D del sistema solar con distancias reales, efemérides del JPL y un cielo
de 8 920 estrellas colocadas a su distancia verdadera. Funciona sin red: todo va
incrustado en un solo archivo.

## Compilar

```bash
node build.mjs          # -> dist/sistema-solar.html  y  publicar/index.html
node generar-sitio.mjs  # -> páginas estáticas, sitemap y robots
```

No hay dependencias: solo Node 18 o superior. `three.js` viene incrustado en el
repositorio, así que no hace falta `npm install`.

`build.mjs` produce dos salidas del mismo código:

| Salida | Qué es | Peso |
|---|---|---|
| `dist/sistema-solar.html` | Fragmento sin `<html>`/`<head>`, para el Artifact. Todo incrustado como data URI porque ahí no se permiten peticiones externas. | 2.9 MB en un archivo |
| `publicar/index.html` | Documento completo con SEO y Open Graph. Texturas y catálogos salen como archivos aparte. | 815 KB + 1.7 MB cacheables |

En la versión del sitio, cada textura y cada catálogo lleva el hash de su contenido en
el nombre (`tierra.ce92853f.jpg`), así que se sirven con `immutable` y caducidad de un
año: la segunda visita no descarga nada. Cambiar una textura cambia su hash y rompe la
caché sola, sin tocar configuración.

Todo el HTML sale en **ASCII puro**: los acentos van escapados, así que no depende de
que el servidor mande la cabecera `charset` correcta.

Las rutas de los assets son absolutas (`/tex/...`), porque con el rewrite de
`/fecha/2026-11-28` una ruta relativa resolvería a `/fecha/tex/...` y daría 404. Esto
supone que el sitio vive en la raíz del dominio.

## Publicar

El directorio `publicar/` es un sitio estático completo. No necesita servidor de
aplicación ni base de datos.

Antes de generar, fija el dominio real para que las URL canónicas y el sitemap
apunten a donde toca:

```bash
SITIO_URL=https://tudominio.com node generar-sitio.mjs
```

Luego sube `publicar/` a cualquier hosting estático:

```bash
# Netlify
npx netlify deploy --dir=publicar --prod

# Vercel
npx vercel deploy publicar --prod

# Cloudflare Pages
npx wrangler pages deploy publicar

# GitHub Pages: copia el contenido de publicar/ a la rama gh-pages
```

`_redirects` y `_headers` (Netlify y Cloudflare) y `vercel.json` ya traen las reglas de
rewrite para que `/fecha/...` y `/date/...` sirvan la app sin un 404, y las cabeceras de
caché de los assets.

Si tu hosting no lee ninguno de esos archivos, basta con dos reglas:

- `/tex/*` y `/datos/*` → `Cache-Control: public, max-age=31536000, immutable`
- `/fecha/*` y `/date/*` → servir `/index.html` con estado 200 (no redirección)

## Qué contiene el sitio

| Ruta | Qué es |
|---|---|
| `/` | El simulador |
| `/explorar/` | Índice de eclipses y fichas de cuerpos |
| `/eclipse/<slug>/` | Una página por eclipse, 2026–2040 |
| `/cuerpo/<id>/` | Ficha de cada planeta, asteroide y cometa |
| `/sitemap.xml`, `/robots.txt` | Para buscadores |

Las páginas de eclipse no son plantillas rellenadas: la fecha, la hora del máximo, el
tipo y las coordenadas del punto de máximo se calculan resolviendo la geometría de los
conos de sombra. Contrastadas con valores publicados, coinciden dentro de 1–2 minutos
y alrededor de 1 grado.

## URLs compartibles

La dirección refleja la vista y se puede restaurar:

```
/?f=2027-08-02T10:07&foco=saturno&d=400000&yaw=120&pit=25&capas=c,-o&play=0
/fecha/2026-11-28
/date/28-11-2026
```

| Parámetro | Significado |
|---|---|
| `f` | Fecha y hora UTC (`YYYY-MM-DD` o `YYYY-MM-DDTHH:MM`) |
| `foco` | Cuerpo enfocado (`tierra`, `saturno`, `halley`…) |
| `d` | Distancia de la cámara en km |
| `yaw`, `pit` | Orientación de la cámara en grados |
| `esc` | Exageración del tamaño de los cuerpos (1–1000) |
| `vel` | Índice de velocidad del tiempo (0–8) |
| `play` | `0` para empezar en pausa |
| `capas` | Lista separada por comas; el prefijo `-` apaga (`c,-o` = constelaciones sí, órbitas no) |

## Fuentes de datos

- Órbitas planetarias: JPL, *Approximate Positions of the Major Planets* (1800–2050)
- Cuerpos menores: JPL Small-Body Database (11 850 asteroides y transneptunianos)
- Sondas: trayectorias reales del JPL Horizons, interpoladas con Catmull-Rom
- Luna: teoría ELP truncada (Meeus, *Astronomical Algorithms*, cap. 47)
- Estrellas: catálogo HYG v4.1, magnitud ≤ 6.5
- Constelaciones: d3-celestial de Olaf Frohn (BSD-3)
- Mapas de superficie: NASA Blue Marble y Visible Earth; Solar System Scope (CC BY 4.0)
- Three.js r169 (MIT), incrustado

Las licencias y la atribución completa están en [CREDITOS.md](CREDITOS.md).
**Importante**: `stars.json` deriva del catálogo HYG, que es CC BY-SA 4.0, así que
ese archivo arrastra la cláusula ShareAlike aunque el resto del código no.

## Publicar en GitHub Pages

El repositorio trae un workflow (`.github/workflows/deploy.yml`) que compila y
publica en cada push a `main`. Para activarlo: **Settings → Pages → Source:
GitHub Actions**. Si usas dominio propio, define la variable de repositorio
`SITIO_URL` (Settings → Secrets and variables → Actions → Variables) con la URL
completa, para que las canónicas y el sitemap apunten ahí.

## Límites conocidos

- Precisión planetaria de minutos de arco, no de segundos (elementos aproximados del JPL).
- Las lunas salvo la Luna usan órbitas circulares, no keplerianas.
- Los cometas se propagan como problema de dos cuerpos: lejos de su época los pasos por
  el perihelio se desvían (Halley da enero de 2062 frente a julio de 2061 real).
- La Vía Láctea es procedural, no fotográfica.
