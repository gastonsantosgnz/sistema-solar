/* ============================================================
   OTROS SOLES — diez sistemas emblemáticos con sus exoplanetas.
   Datos: NASA Exoplanet Archive (2026). Las órbitas se dibujan
   circulares y coplanares porque en casi todos los casos la
   inclinación y la excentricidad se desconocen; donde el radio
   no se ha medido (planetas sin tránsito) va estimado desde la
   masa y se declara en la ficha. Radios en km, semiejes en km,
   periodos en días, posiciones de las estrellas por RA/Dec/años luz.
   ============================================================ */

const R_TIERRA_KM = 6371, R_JUP_KM = 69911, R_SOL_KM = 695700;
const ROJA = [0xffd4a8, 0xff7a3c, 0xb8301a], NARANJA = [0xfff0d0, 0xffa848, 0xd0521e];

const EXOESTRELLAS = [
  { id:'proxima', nombre:'Próxima Centauri', tipo:'Enana roja M5.5', ra:217.4289, dec:-62.6795, ly:4.246,
    r:0.154*R_SOL_KM, temp:2769, paleta:ROJA,
    nota:'La estrella más cercana al Sol. Tan tenue que no se ve a simple vista, pese a estar a 4.2 años luz.' },
  { id:'barnard', nombre:'Estrella de Barnard', tipo:'Enana roja M4', ra:269.4521, dec:4.6934, ly:5.963,
    r:0.196*R_SOL_KM, temp:2922, paleta:ROJA,
    nota:'La estrella que más rápido se mueve en nuestro cielo: cruza el ancho de la Luna cada 180 años.' },
  { id:'epseri', nombre:'Épsilon Eridani', tipo:'Enana naranja K2', ra:53.2327, dec:-9.4583, ly:10.49,
    r:0.735*R_SOL_KM, temp:4811, paleta:NARANJA,
    nota:'Joven (unos 500 millones de años) y rodeada de cinturones de escombros: un sistema solar en formación.' },
  { id:'tauceti', nombre:'Tau Ceti', tipo:'Enana amarilla G8', ra:26.0170, dec:-15.9375, ly:11.91,
    r:0.793*R_SOL_KM, temp:5071,
    nota:'La estrella parecida al Sol más cercana que se ve a simple vista. Clásica de la ciencia ficción.' },
  { id:'trappist1', nombre:'TRAPPIST-1', tipo:'Enana ultrafría M8', ra:346.6224, dec:-5.0414, ly:40.66,
    r:0.1192*R_SOL_KM, temp:2293, paleta:ROJA,
    nota:'Apenas más grande que Júpiter, con siete mundos rocosos apretados en menos espacio del que Mercurio deja al Sol.' },
  { id:'55cnc', nombre:'55 Cancri', tipo:'Enana amarilla G8', ra:133.1494, dec:28.3306, ly:41.06,
    r:0.943*R_SOL_KM, temp:4899,
    nota:'Cinco planetas conocidos. El más interior completa su año en menos de un día terrestre.' },
  { id:'51peg', nombre:'51 Pegasi', tipo:'Subgigante amarilla G2', ra:344.3667, dec:20.7689, ly:50.9,
    r:1.27*R_SOL_KM, temp:5495,
    nota:'Aquí se encontró en 1995 el primer exoplaneta alrededor de una estrella como el Sol.' },
  { id:'hd209458', nombre:'HD 209458', tipo:'Enana amarilla G0', ra:330.7950, dec:18.8843, ly:157.5,
    r:1.203*R_SOL_KM, temp:5792,
    nota:'Su planeta fue el primero visto pasar por delante de su estrella y el primero con atmósfera detectada.' },
  { id:'kepler186', nombre:'Kepler-186', tipo:'Enana roja M1', ra:298.6738, dec:43.9539, ly:579,
    r:0.472*R_SOL_KM, temp:3482, paleta:ROJA,
    nota:'Cinco planetas descubiertos por el telescopio Kepler; el quinto, del tamaño de la Tierra, en la zona templada.' },
  { id:'kepler452', nombre:'Kepler-452', tipo:'Enana amarilla G2', ra:296.2005, dec:44.2779, ly:1402,
    r:1.11*R_SOL_KM, temp:5484,
    nota:'Casi gemela del Sol pero 1 500 millones de años más vieja: un vistazo al futuro de nuestro sistema.' }
];

const AUk = 149597870.7;
const EXOPLANETAS = [
  { id:'proximab', padre:'proxima', nombre:'Próxima b', tipo:'Exoplaneta rocoso', a:0.04857*AUk, per:11.186,
    r:1.1*R_TIERRA_KM, estimado:true, shader:'ROCK', color:0xb08a6a,
    nota:'El exoplaneta más cercano. Recibe casi tanta luz como la Tierra, pero a 7 millones de km de una estrella que lo baña en fulguraciones.' },
  { id:'proximad', padre:'proxima', nombre:'Próxima d', tipo:'Exoplaneta rocoso', a:0.02885*AUk, per:5.122,
    r:0.8*R_TIERRA_KM, estimado:true, shader:'ROCK', color:0x9a8878,
    nota:'Uno de los planetas más ligeros conocidos: un cuarto de la masa de la Tierra, en un año de cinco días.' },
  { id:'barnardb', padre:'barnard', nombre:'Barnard b', tipo:'Exoplaneta rocoso', a:0.0229*AUk, per:3.154,
    r:0.75*R_TIERRA_KM, estimado:true, shader:'ROCK', color:0x8f8276,
    nota:'Confirmado en 2024 tras décadas de falsas alarmas. Más chico que la Tierra, con un año de tres días.' },
  { id:'epserib', padre:'epseri', nombre:'Ægir (Épsilon Eridani b)', tipo:'Gigante gaseoso', a:3.53*AUk, per:2775,
    r:R_JUP_KM, estimado:true, shader:'JUPITER', color:0xc9a97a,
    nota:'Un Júpiter a la distancia de nuestro Júpiter, en la estrella parecida al Sol más cercana con un gigante.' },
  { id:'taucetie', padre:'tauceti', nombre:'Tau Ceti e', tipo:'Supertierra', a:0.538*AUk, per:162.87,
    r:1.6*R_TIERRA_KM, estimado:true, shader:'ROCK', color:0xa89a7c,
    nota:'Casi cuatro veces la masa de la Tierra, en el borde interior de la zona templada.' },
  { id:'taucetif', padre:'tauceti', nombre:'Tau Ceti f', tipo:'Supertierra', a:1.334*AUk, per:636.13,
    r:1.6*R_TIERRA_KM, estimado:true, shader:'ICEMOON', color:0xb8c4d0,
    nota:'En el borde exterior de la zona templada: quizá un mundo helado con un año de 21 meses.' },
  { id:'trappist1b', padre:'trappist1', nombre:'TRAPPIST-1 b', tipo:'Exoplaneta rocoso', a:0.01154*AUk, per:1.5109,
    r:1.116*R_TIERRA_KM, shader:'ROCK', color:0xb07858,
    nota:'El más interior: un año de 36 horas y una superficie probablemente desnuda y ardiente.' },
  { id:'trappist1c', padre:'trappist1', nombre:'TRAPPIST-1 c', tipo:'Exoplaneta rocoso', a:0.01580*AUk, per:2.4218,
    r:1.097*R_TIERRA_KM, shader:'ROCK', color:0xb8906c,
    nota:'Casi gemelo de la Tierra en tamaño; el telescopio Webb no le encontró atmósfera densa.' },
  { id:'trappist1d', padre:'trappist1', nombre:'TRAPPIST-1 d', tipo:'Exoplaneta rocoso', a:0.02227*AUk, per:4.0496,
    r:0.788*R_TIERRA_KM, shader:'ROCK', color:0xa8a090,
    nota:'Más chico que la Tierra y en el borde cálido de la zona templada.' },
  { id:'trappist1e', padre:'trappist1', nombre:'TRAPPIST-1 e', tipo:'Exoplaneta rocoso', a:0.02925*AUk, per:6.0996,
    r:0.920*R_TIERRA_KM, shader:'ROCK', color:0x7d90a8,
    nota:'El candidato: densidad de roca, temperatura de agua líquida. El mundo más estudiado fuera del sistema solar.' },
  { id:'trappist1f', padre:'trappist1', nombre:'TRAPPIST-1 f', tipo:'Exoplaneta rocoso', a:0.03849*AUk, per:9.2067,
    r:1.045*R_TIERRA_KM, shader:'ICEMOON', color:0xb4c0cc,
    nota:'Menos denso que la roca pura: quizá cubierto de agua o hielo.' },
  { id:'trappist1g', padre:'trappist1', nombre:'TRAPPIST-1 g', tipo:'Exoplaneta rocoso', a:0.04683*AUk, per:12.3529,
    r:1.129*R_TIERRA_KM, shader:'ICEMOON', color:0xc0c8d4,
    nota:'El mayor de los siete. Sus años, sus días y los de sus vecinos están encadenados en resonancia.' },
  { id:'trappist1h', padre:'trappist1', nombre:'TRAPPIST-1 h', tipo:'Exoplaneta rocoso', a:0.06189*AUk, per:18.7727,
    r:0.755*R_TIERRA_KM, shader:'ICEMOON', color:0xcdd4dc,
    nota:'El más lejano y frío, del tamaño de Marte, con un año de 19 días.' },
  { id:'55cnce', padre:'55cnc', nombre:'Janssen (55 Cancri e)', tipo:'Supertierra de lava', a:0.01544*AUk, per:0.7365,
    r:1.88*R_TIERRA_KM, shader:'VENUS', color:0xd8783c, rot:0.7365,
    nota:'Un año de 18 horas. Su cara diurna es un océano de lava a más de 2 000 °C.' },
  { id:'51pegb', padre:'51peg', nombre:'Dimidio (51 Pegasi b)', tipo:'Júpiter caliente', a:0.0527*AUk, per:4.2308,
    r:1.2*R_JUP_KM, estimado:true, shader:'JUPITER', color:0xd9b58a,
    nota:'El primer exoplaneta hallado en torno a una estrella como el Sol (1995, Nobel de Física 2019): un gigante que orbita en cuatro días.' },
  { id:'hd209458b', padre:'hd209458', nombre:'Osiris (HD 209458 b)', tipo:'Júpiter caliente', a:0.04747*AUk, per:3.5247,
    r:1.38*R_JUP_KM, shader:'JUPITER', color:0x9aa8c8,
    nota:'El primero visto en tránsito (1999) y el primero con atmósfera detectada: pierde hidrógeno como un cometa gigante.' },
  { id:'kepler186f', padre:'kepler186', nombre:'Kepler-186 f', tipo:'Exoplaneta rocoso', a:0.4322*AUk, per:129.94,
    r:1.17*R_TIERRA_KM, shader:'ROCK', color:0x5a86b0, paleta:[0x6a90b8, 0x2b4d70, 0x000000],
    nota:'El primer planeta del tamaño de la Tierra hallado en la zona templada de otra estrella (2014).' },
  { id:'kepler452b', padre:'kepler452', nombre:'Kepler-452 b', tipo:'Supertierra', a:1.046*AUk, per:384.84,
    r:1.63*R_TIERRA_KM, shader:'ROCK', color:0x8c9cae, paleta:[0x9aa8b8, 0x455a70, 0x000000],
    nota:'"La prima de la Tierra": un año de 385 días alrededor de una estrella casi igual al Sol.' }
];
/* valores comunes que el motor espera */
for (const e of EXOESTRELLAS){ e.clase = 'star'; e.shader = 'SUN'; e.rot = 30; e.tilt = 0; e.color = e.paleta ? 0xff9a5c : 0xfff1cf; }
for (const p of EXOPLANETAS){ p.inc = 0; if (p.rot === undefined) p.rot = p.per; p.tilt = 0; p.clase = 'exo'; }
