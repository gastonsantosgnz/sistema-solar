# Hoja de ruta

Plan de implementación del backlog acordado. El orden no es el de la emoción sino
el de las dependencias: primero lo pequeño que desbloquea (capturar → compartir),
luego la infraestructura (PWA), luego las features grandes (sonido, galaxia,
exoplanetas), y al final el idioma y el lanzamiento — porque el lanzamiento
multiplica todo lo que exista antes de él.

## Principios (aplican a todas las fases)

- **Un archivo, sin dependencias**: nada de librerías nuevas ni assets pesados;
  lo procedural y determinista antes que lo descargado.
- **Honestidad de instrumento**: cada aproximación se declara (como ya hacen
  "Límites conocidos", la nota de la nave y el aviso de Halley).
- **Capas con compuerta**: toda feature nueva vive detrás de un umbral
  (distancia, altura, toggle) y no toca el núcleo que ya funciona.
- **Determinismo**: mismas semillas → mismas formas/escenas en cada visita y en
  cada enlace compartido.
- **Flujo de trabajo**: compilar con `node build.mjs`, probar en local
  (`python3 -m http.server 8734` en `publicar/`), checklist de pruebas por fase,
  un commit por fase.

## Resumen

| # | Fase | Tamaño | Depende de |
|---|------|--------|------------|
| 1 | Pulido rápido: aviso de rango, captura de vista, compartir nativo | 1 sesión | — |
| 2 | PWA instalable y offline | 1 sesión | — |
| 3 | Sonido honesto | 1 sesión | — |
| 4 | La galaxia | 2–4 sesiones | — |
| 5 | Exoplanetas cercanos | 1–2 sesiones | Fase 4 (narrativa) |
| 6 | Bilingüe ES/EN | 2–3 sesiones | Fases 1–5 congeladas |
| 7 | Lanzamiento (HN / Product Hunt) | 1 sesión + espera | Fases 2, 4 y 6 |

---

## Fase 1 — Pulido rápido

Tres piezas chicas que cierran cabos sueltos y se apoyan entre sí.

### 1a. Aviso fuera del rango 1800–2050

**Qué**: un chip discreto junto al reloj cuando la fecha sale del rango de
validez de los elementos del JPL: "precisión reducida fuera de 1800–2050".

**Cómo**: chequeo en `actualizarHUD` (barato, ya corre por frame), elemento en
`shell.html` junto a `#fecha`, estilo tipo `#avisoEscala`.

**Hecho cuando**: aparece al cruzar el límite (p. ej. viajando a Halley 2061 no,
pero sí en 1750 o 2120), desaparece al volver, y su tooltip explica por qué.

### 1b. Captura de la vista actual

**Qué**: botón "Capturar esta vista" (bloque Compartir + tecla) que descarga un
PNG de lo que se ve — cualquier ángulo, con nave y velo atmosférico incluidos.

**Cómo**: la maquinaria ya existe en la postal — `renderCuadro(0)` +
`canvas.toDataURL` en la misma tarea (sin `preserveDrawingBuffer`). Se captura a
resolución de pantalla ×2 (renderizando a doble tamaño como hace la postal) y se
compone un pie mínimo opcional: fecha + URL en mono chico, esquinas marcadas.
El HUD no sale (es DOM); la nave sí (es escena).

**Archivos**: extender `12-postal.js` (compartir helpers) o `12b-captura.js`.

**Hecho cuando**: un clic → PNG nítido de la vista desde órbita, vuelo y
momentos; sin parpadeo del canvas; nombre `sistema-solar-vista-<fecha>.png`.

### 1c. Compartir nativo (Web Share API)

**Qué**: botón "Compartir" junto a "Descargar PNG" — en la postal **y** en la
captura — que abre la hoja nativa del sistema (WhatsApp, Instagram, mensajes).

**Cómo**: `navigator.canShare({ files })` para detectar soporte (móvil,
principalmente); si hay, `navigator.share` con el blob que ya generamos; si no,
el botón no aparece (el de descarga queda igual). ~20 líneas.

**Hecho cuando**: en un teléfono, postal → Compartir → llega la imagen a
WhatsApp en dos toques; en desktop sin soporte, nada cambia.

---

## Fase 2 — PWA instalable y offline

**Qué**: manifest + service worker para que el sitio se instale como app (icono,
pantalla completa) y funcione sin red tras la primera visita.

**Cómo**:
- `manifest.webmanifest` generado por `build.mjs`: nombre, colores (`#05060a`),
  iconos 192/512 (generar PNG desde un diseño propio simple — anillo de Saturno
  sobre fondo void, coherente con el favicon actual).
- Service worker **generado por el build** (ahí está la lista exacta de assets
  con hash): precache de `/tex/*` y `/datos/*` (inmutables — cache-first
  eterno), `index.html` con *stale-while-revalidate* + `skipWaiting`, para que
  un push actualice en la siguiente visita sin quedarse pegado.
- Registro solo en la salida sitio (`ES_SITIO`), nunca en el artifact.

**Riesgos**: el clásico SW que sirve una versión vieja para siempre →
mitigado con SWR en el HTML y versión del SW ligada al hash del build.

**Hecho cuando**: Lighthouse marca "installable"; en modo avión la app entera
funciona (simulador, postal, comparador); un push a main llega a los usuarios en
la siguiente recarga.

---

## Fase 3 — Sonido honesto

**Qué**: audio sintetizado con WebAudio, **cero archivos**, apagado por defecto.
Solo suena lo que físicamente sonaría:

- **Empuje** (estructural, lo oyes porque vas dentro de la nave): ruido filtrado
  (lowpass + gain) cuya intensidad sigue la rampa de empuje ya existente
  (`velVuelo`/`intEmpuje`); Shift lo engorda; al soltar, silencio real — el
  contraste es el mensaje.
- **Sonificación de magnetosferas** al acercarse a Júpiter, Saturno, la Tierra o
  el Sol: osciladores graves con batidos lentos, parámetros deterministas por
  cuerpo. Etiquetada como sonificación en la ayuda (como hace la NASA con Juno).

**Cómo**: `src/18-sonido.js`; `AudioContext` creado en el primer gesto (política
de autoplay); toggle "Sonido" en el panel (apagado por defecto); rampas de
ganancia en todos los cambios (sin pops).

**Hecho cuando**: ON → el empuje se oye seguir a la rampa y calla al soltar;
acercarse a Júpiter introduce el tono espectral gradualmente; OFF por defecto y
silencio absoluto; nada suena en momentos ni en el comparador.

---

## Fase 4 — La galaxia (el buque insignia)

**Qué**: que "salir del sistema" culmine: volar más allá de las estrellas del
catálogo y ver la Vía Láctea como objeto 3D — la espiral completa, con el Sol en
su lugar real (26 000 años luz del centro) — y Andrómeda al fondo. Le da destino
al velocímetro superlumínico.

**Subfases** (cada una probable y commiteable por separado):

**4a. Estudio del cielo actual** (media sesión). Entender cómo `06-stars.js`
maneja distancias y paralaje (las 8 920 estrellas ya tienen posición 3D real) y
decidir dónde vive la galaxia: misma escena-cielo con su convención, no la
escena principal (a 2.5×10¹⁷ km el float32 no da).

**4b. Generador procedural** (1 sesión). 200–300k puntos deterministas: 2 brazos
espirales logarítmicos + bulbo + disco delgado + halo tenue; polvo como bandas
de menor densidad y color apagado (sobre negro no hay "puntos oscuros"). El
motor ya mueve 12k asteroides + 9k estrellas — es territorio conocido, pero
**medir en móvil** y preparar un LOD (menos puntos de cerca, donde la banda
actual manda).

**4c. La transición** (1 sesión, la parte fina). Doble representación: de cerca
manda la banda procedural actual (que es hermosa); de lejos, la galaxia 3D.
Crossfade por distancia al Sol (~300–3 000 al). Criterio de éxito: en ningún
momento se ven dos Vías Lácteas. Si el prototipo lo permite, ideal: que la banda
*emerja* de los propios puntos y la textura actual se retire del todo.

**4d. Destinos y hitos** (media sesión). Andrómeda (mancha de puntos a 2.5 M al,
orientación real); botón "Ver la galaxia" en Salir del sistema; revisar el tope
de velocidad del vuelo (hoy el auto-escalado permite ~0.01 al/s: cruzar la
galaxia tomaría meses de reloj — lejos de toda superficie el tope debe crecer
para que el viaje dure minutos, no días).

**4e. Instrumentos galácticos** (media sesión). La línea de contexto del
velocímetro gana tramos ("cruzarías la galaxia en X"; "hasta Andrómeda en Y") y
el RUMBO reconoce el centro galáctico y Andrómeda.

**Riesgos**: rendimiento móvil (medir en 4b antes de pulir), la costura visual
de 4c, y la precisión numérica (validar el paralaje a 100 k al).

**Hecho cuando**: de la Tierra a ver la espiral completa en menos de 2 minutos
de vuelo con Shift; 60 fps desktop / 30 móvil; el cielo nocturno actual queda
intacto a escala planetaria; la vista galáctica se comparte por URL; la postal y
el comparador no se enteran.

---

## Fase 5 — Exoplanetas cercanos

**Qué**: que llegar a una estrella tenga premio. Ocho a diez sistemas
emblemáticos con sus planetas orbitando: Próxima b (P=11.2 días), TRAPPIST-1
(siete mundos), Tau Ceti, 51 Peg b…

**Cómo**: datos del NASA Exoplanet Archive embebidos (unos KB); reutilizar la
maquinaria kepleriana y `crearCuerpo` con shaders procedurales genéricos;
órbitas relativas a su estrella (misma técnica que las lunas). Nota honesta en
cada ficha: inclinaciones desconocidas → se dibujan coplanares.

**Hecho cuando**: viajar a Próxima Centauri muestra a Próxima b recorriendo su
órbita de 11 días; cada exoplaneta tiene ficha con sus datos reales y su nota de
incertidumbre; el buscador de la escena (clic/etiquetas) los trata como a
cualquier cuerpo.

---

## Fase 6 — Bilingüe ES/EN

**Qué**: versión en inglés completa sin degradar el español (que sigue siendo el
foso competitivo y el SEO del eclipse 2027).

**Cómo** (decisión fina al llegar, con dos candidatas):
- *Diccionario en runtime* (un objeto de cadenas + toggle): mantiene la
  filosofía de un archivo; sirve para el artifact.
- *Doble salida del build* (`/` y `/en/` prerenderizados): mejor para SEO
  (hreflang, canónicas por idioma). Probablemente **híbrido**: diccionario +
  prerender de rutas.

Inventario a traducir: UI (`shell.html`), ayuda, momentos, postal (¡tipografía
de fechas!), comparador, instrumentos, notas de los ~40 cuerpos, páginas
estáticas de `generar-sitio.mjs`, README-EN.

**Hecho cuando**: `/en/` completo e indexable con hreflang; toggle vivo en la
interfaz; la postal sale en el idioma activo; cero regresión en español.

---

## Fase 7 — Lanzamiento

**Qué**: el momento de cosechar. "Show HN: a real-scale solar system in one
HTML file (no dependencies, works offline)" + Product Hunt + Reddit (r/space,
r/InternetIsBeautiful).

**Cómo**: og-images por idioma, GIF/video de 20 s (viaje Tierra → galaxia),
texto del post enfocado en lo que a HN le encanta (un archivo, cero deps, AGPL,
efemérides reales, funciona offline), README-EN pulido. Opcional al gusto:
activar donaciones (Ko-fi + FUNDING.yml) *antes* del pico, con el pedido
contextual tras descargar la postal.

**Hecho cuando**: el post publicado, y el sitio aguanta el pico (es estático
sobre CDN de GitHub: aguanta).

---

## Fuera de alcance (decidido y por qué)

- **Modelos 3D externos (Meshy/GLTF)**: peso y estilo ajeno; lo procedural ya da.
- **Terreno real navegable**: exige streaming de teselas y servidores — otra app.
- **Inercia física en el vuelo**: rompería el auto-escalado que hace el manejo
  perfecto.
- **Anuncios**: destruirían la estética y el alma contemplativa por centavos.
- **Multijugador / cuentas / backend**: el proyecto es estático por diseño.

## Monetización (pospuesta por decisión, lista para activar)

Cuando se quiera, en este orden de esfuerzo: donaciones contextuales (Ko-fi +
FUNDING.yml, una tarde) → postal impresa bajo demanda (Stripe Payment Link +
Gelato/Printful, días) → licencias B2B a museos/planetarios (el dual-licensing
AGPL ya está invitado en el README) → SEO apuntando al eclipse total del 2 de
agosto de 2027 en España, el pico de tráfico predecible.
