# Créditos y licencias de terceros

Este proyecto incrusta datos e imágenes de terceros. Cada fuente conserva su
propia licencia, y todas exigen atribución. Este archivo la da.

## Código

| Componente | Licencia | Uso |
|---|---|---|
| [three.js](https://threejs.org) r169 | MIT | Motor de render 3D, incrustado en el bundle |
| [IBM Plex](https://github.com/IBM/plex) | SIL OFL 1.1 | Tipografías, cargadas desde Google Fonts |

## Datos astronómicos

| Fuente | Licencia | Uso |
|---|---|---|
| JPL, *Approximate Positions of the Major Planets* | Datos públicos de la NASA | Órbitas de los planetas |
| [JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_query.html) | Datos públicos de la NASA | 11 850 asteroides y transneptunianos, más 10 cuerpos con nombre |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Datos públicos de la NASA | Trayectorias de Voyager 1 y 2, New Horizons y Parker Solar Probe |
| Meeus, *Astronomical Algorithms*, cap. 47 | Algoritmo publicado, implementación propia | Efeméride de la Luna |
| [Catálogo HYG v4.1](https://codeberg.org/astronexus/hyg) | **CC BY-SA 4.0** | 8 920 estrellas hasta magnitud 6.5 |
| [d3-celestial](https://github.com/ofrohn/d3-celestial) de Olaf Frohn | BSD-3-Clause | Trazos de las constelaciones |

## Imágenes

| Fuente | Licencia | Uso |
|---|---|---|
| NASA Blue Marble y Visible Earth | Dominio público | Mapas de la Tierra: superficie, nubes, luces nocturnas, relieve, océanos |
| NASA / USGS (vía three.js) | Dominio público | Mapa de la Luna |
| [Solar System Scope](https://www.solarsystemscope.com/textures/) | **CC BY 4.0** | Mapas de Mercurio, Venus, Marte, Júpiter, Saturno, Urano y Neptuno |

El Sol, los anillos de Saturno, la Vía Láctea y las lunas menores no usan
fotografías: se generan por procedimiento con ruido simplex 3D.

## Nota sobre el catálogo HYG (CC BY-SA)

El catálogo de estrellas está bajo **CC BY-SA 4.0**, que incluye cláusula
*ShareAlike*. El archivo `stars.json` de este repositorio es una obra derivada
de ese catálogo (posiciones convertidas al marco eclíptico y cuantizadas), así
que **`stars.json` se redistribuye bajo CC BY-SA 4.0**, con independencia de la
licencia del resto del código.

Si eso resulta incómodo para un uso concreto, hay alternativas sin ShareAlike:
el catálogo Hipparcos original (ESA) o el Bright Star Catalogue (Yale) permiten
reconstruir el mismo cielo sin esa cláusula.
