# Sistema Solar a Escala

Simulador 3D del sistema solar con distancias reales, efemérides del JPL y un cielo
de 8 920 estrellas colocadas a su distancia verdadera. Funciona sin red: todo va
incrustado en un solo archivo.

Además del simulador trae una **postal descargable** —la vista cenital del sistema
en cualquier fecha, compuesta en el navegador en 16:9, 9:16 o 1:1, con fase lunar y
dedicatoria opcional— y un **comparador de tamaños** que pone hasta diez cuerpos
lado a lado a escala real, alineados por la base, con su inclinación axial y
rotando; el Sol entra completo a la fila. Ambos reutilizan el motor: no añaden
assets ni peso al archivo.

La sección **Momentos** guarda escenas curadas —el Punto azul pálido, la Voyager 2
sobre Neptuno, la Gran Conjunción de 2020, el eclipse total de 2026, el regreso de
Halley— cada una con su fecha, su cámara puesta con intención y un banner que
explica qué estás viendo hasta que sales. Como toda la vista es estado de la URL,
cada momento se comparte como un enlace. El reloj, además, corre en ambos sentidos:
la escalera de velocidades llega hasta −10 años/s.

El **vuelo libre** lleva instrumentos: velocímetro de cinta logarítmica con hitos
reales por el camino (del sonido a la Voyager, la sonda Parker, la luz y miles de
veces más allá), velocidad de crucero fijable con un clic en cualquier hito, una
línea de contexto que traduce la cifra a algo imaginable, y el rumbo con tiempo de
llegada comparado con el de la luz. Se pilota una **sonda o una nave** procedurales
(cero assets), con propulsores ligados al empuje y luces de navegación, dibujadas a
escala de cabina —lo único del universo que no está a escala real, y se declara.

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

Las rutas de los assets son absolutas, porque con el rewrite de `/fecha/2026-11-28`
una ruta relativa resolvería a `/fecha/tex/...` y daría 404. El prefijo sale de
`SITIO_URL`: si el sitio vive en un subdirectorio (como en GitHub Pages, que sirve
cada repo bajo `/<repo>/`), las rutas se generan con ese prefijo automáticamente.

```bash
SITIO_URL=https://usuario.github.io/sistema-solar node build.mjs   # base /sistema-solar/
SITIO_URL=https://midominio.com node build.mjs                     # base /
```

El build también escribe `publicar/404.html` como copia del index: GitHub Pages no
admite rewrites, pero sirve `404.html` para rutas inexistentes, así que las rutas
bonitas (`/fecha/...`) funcionan igual.

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
| `vel` | Velocidad del tiempo (−8 a 8; negativo = el reloj corre hacia atrás) |
| `play` | `0` para empezar en pausa |
| `nave` | Vehículo del vuelo libre: `sonda` (por defecto), `nave`, `0` = ninguno |
| `capas` | Lista separada por comas; el prefijo `-` apaga (`c,-o` = constelaciones sí, órbitas no). Letras: `o` órbitas · `e` etiquetas · `m` lunas · `a` asteroides · `k` cinturón de Kuiper · `c` constelaciones · `g` Vía Láctea · `z` luz real |

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

## Licencia

El código de este proyecto está bajo **[AGPL-3.0](LICENSE)**. En corto: puedes
usarlo, estudiarlo y modificarlo libremente, pero si lo despliegas como servicio
web —modificado o no— tienes que ofrecer el código fuente a quien lo use.

Los datos y las imágenes de terceros conservan su propia licencia; la lista
completa está en **[CREDITOS.md](CREDITOS.md)**. Una en particular importa:
`stars.json` deriva del catálogo HYG, que es CC BY-SA 4.0, así que ese archivo
se redistribuye bajo esa licencia y no bajo AGPL.

Si necesitas una licencia distinta para un uso comercial cerrado, escribe.

## Límites conocidos

- Precisión planetaria de minutos de arco, no de segundos (elementos aproximados del JPL).
- Las lunas salvo la Luna usan órbitas circulares, no keplerianas.
- Los cometas se propagan como problema de dos cuerpos: lejos de su época los pasos por
  el perihelio se desvían (Halley da enero de 2062 frente a julio de 2061 real).
- La Vía Láctea es procedural, no fotográfica.
