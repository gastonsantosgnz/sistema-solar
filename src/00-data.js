/* ============================================================
   DATOS REALES
   Elementos keplerianos: JPL "Approximate Positions of the Major
   Planets" (validez 1800–2050 d.C.), época J2000.
   Radios, masas, rotaciones: NASA Planetary Fact Sheets.
   ============================================================ */

const AU = 149597870.7;          // km
const DEG = Math.PI / 180;
const J2000 = 2451545.0;         // día juliano
const PC = 3.0856775814913673e13; // km por parsec
const LY = 9.4607304725808e12;    // km por año luz

// a, e, I, L, long.peri, long.node  +  tasas por siglo juliano
const ELEM = {
  mercurio: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  venus:    [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  tierra:   [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0.0, 0.0],
  marte:    [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  jupiter:  [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  saturno:  [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
  urano:    [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.95427630, 0.40805281, 74.01692503, 0.04240589],
  neptuno:  [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664],
  pluton:   [39.48211675, -0.00031596, 0.24882730, 0.00005170, 17.14001206, 0.00004818, 238.92903833, 145.20780515, 224.06891629, -0.04062942, 110.30393684, -0.01183482]
};
// términos correctores b, c, s, f para los planetas exteriores
const EXTRA = {
  jupiter: [-0.00012452, 0.06064060, -0.35635438, 38.35125000],
  saturno: [0.00025899, -0.13434469, 0.87320147, 38.35125000],
  urano:   [0.00058331, -0.97731848, 0.17689245, 7.67025000],
  neptuno: [-0.00041348, 0.68346318, -0.10162547, 7.67025000],
  pluton:  [-0.01262724, 0, 0, 0]
};

/* Cuerpos. r = radio medio km · rot = periodo sidéreo de rotación en días
   (negativo = retrógrado) · tilt = oblicuidad en grados                */
const BODIES = [
  { id:'sol', nombre:'Sol', tipo:'Estrella G2V', clase:'star', r:695700, rot:25.38, tilt:7.25,
    mass:1.9885e30, temp:5505, color:0xfff1cf, shader:'SUN', dia:'25.4 d', grav:274,
    nota:'Contiene el 99.86 % de la masa del sistema. Su luz tarda 8 min 19 s en llegar a la Tierra.' },

  { id:'mercurio', nombre:'Mercurio', tipo:'Planeta rocoso', clase:'planet', r:2439.7, rot:58.646, tilt:0.034,
    mass:3.3011e23, temp:167, color:0x9a938c, shader:'ROCK', grav:3.7, lunas:0,
    nota:'Sin atmósfera. Entre el día y la noche varía 600 °C, el mayor contraste térmico del sistema.' },

  { id:'venus', nombre:'Venus', tipo:'Planeta rocoso', clase:'planet', r:6051.8, rot:-243.025, tilt:177.36,
    mass:4.8675e24, temp:464, color:0xe6cda2, shader:'VENUS', grav:8.87, lunas:0, atmos:0x6d5b3a,
    nota:'Rota al revés y más lento de lo que orbita: su día dura más que su año.' },

  { id:'tierra', nombre:'Tierra', tipo:'Planeta rocoso', clase:'planet', r:6371.0, rot:0.99726968, tilt:23.4393,
    meridiano:280.46061837,      // TSMG en J2000: alinea Greenwich con la hora del reloj
    mass:5.97237e24, temp:15, color:0x3f74a8, shader:'EARTH', grav:9.81, lunas:1, atmos:0x5a9fe0,
    nota:'Único cuerpo conocido con agua líquida estable en superficie.' },

  { id:'marte', nombre:'Marte', tipo:'Planeta rocoso', clase:'planet', r:3389.5, rot:1.02595676, tilt:25.19,
    mass:6.4171e23, temp:-65, color:0xa84b28, shader:'MARS', grav:3.71, lunas:2, atmos:0x8a4a30,
    nota:'Alberga el Monte Olimpo, de 22 km de altura: el volcán más grande del sistema solar.' },

  { id:'jupiter', nombre:'Júpiter', tipo:'Gigante gaseoso', clase:'planet', r:69911, rot:0.41354, tilt:3.13,
    mass:1.8982e27, temp:-110, color:0xd2b48c, shader:'JUPITER', grav:24.79, lunas:95,
    ring:[122500,129000,0.05],
    nota:'Más masivo que todos los demás planetas juntos. La Gran Mancha Roja lleva siglos girando.' },

  { id:'saturno', nombre:'Saturno', tipo:'Gigante gaseoso', clase:'planet', r:58232, rot:0.44401, tilt:26.73,
    mass:5.6834e26, temp:-140, color:0xdcc79a, shader:'SATURN', grav:10.44, lunas:146,
    ring:[74500,140220,1.0],
    nota:'Sus anillos miden 280 000 km de ancho y menos de 1 km de espesor.' },

  { id:'urano', nombre:'Urano', tipo:'Gigante helado', clase:'planet', r:25362, rot:-0.71833, tilt:97.77,
    mass:8.6810e25, temp:-195, color:0x9fdfe3, shader:'URANUS', grav:8.87, lunas:28,
    ring:[38000,51150,0.12],
    nota:'Gira tumbado de lado: sus polos apuntan al Sol durante 42 años seguidos.' },

  { id:'neptuno', nombre:'Neptuno', tipo:'Gigante helado', clase:'planet', r:24622, rot:0.67125, tilt:28.32,
    mass:1.02413e26, temp:-200, color:0x3b5bdb, shader:'NEPTUNE', grav:11.15, lunas:16,
    nota:'Vientos de 2 100 km/h, los más veloces del sistema solar. Se descubrió con matemáticas antes que con telescopio.' },

  { id:'pluton', nombre:'Plutón', tipo:'Planeta enano', clase:'dwarf', r:1188.3, rot:-6.3872, tilt:122.53,
    mass:1.303e22, temp:-225, color:0xc0ab95, shader:'PLUTO', grav:0.62, lunas:5,
    nota:'Su órbita está tan inclinada y es tan elíptica que a veces está más cerca del Sol que Neptuno.' }
];

/* Lunas: órbita circular kepleriana respecto al ecuador del planeta.
   a = semieje km · per = periodo sidéreo d · inc = inclinación grados  */
const MOONS = [
  { id:'luna', nombre:'Luna', padre:'tierra', r:1737.4, a:384400, per:27.321661, inc:5.145, rot:27.321661, color:0x9a958f, shader:'MOON',
    nota:'Se aleja de la Tierra 3.8 cm cada año.' },
  { id:'fobos', nombre:'Fobos', padre:'marte', r:11.267, a:9376, per:0.31891, inc:1.08, rot:0.31891, color:0x8a7f74, shader:'MOON',
    nota:'Orbita más rápido de lo que Marte gira: sale por el oeste tres veces al día.' },
  { id:'deimos', nombre:'Deimos', padre:'marte', r:6.2, a:23463, per:1.26244, inc:1.79, rot:1.26244, color:0x8f857a, shader:'MOON' },
  { id:'io', nombre:'Ío', padre:'jupiter', r:1821.6, a:421700, per:1.769138, inc:0.05, rot:1.769138, color:0xd8c86a, shader:'IO',
    nota:'El cuerpo más volcánico conocido: más de 400 volcanes activos.' },
  { id:'europa', nombre:'Europa', padre:'jupiter', r:1560.8, a:671034, per:3.551181, inc:0.47, rot:3.551181, color:0xc9b79a, shader:'EUROPA',
    nota:'Bajo su corteza de hielo hay un océano con más agua que toda la Tierra.' },
  { id:'ganimedes', nombre:'Ganimedes', padre:'jupiter', r:2634.1, a:1070412, per:7.154553, inc:0.20, rot:7.154553, color:0x9c9184, shader:'MOON',
    nota:'La luna más grande del sistema solar: supera en tamaño a Mercurio.' },
  { id:'calisto', nombre:'Calisto', padre:'jupiter', r:2410.3, a:1882709, per:16.689017, inc:0.19, rot:16.689017, color:0x6f665d, shader:'MOON' },
  { id:'encelado', nombre:'Encélado', padre:'saturno', r:252.1, a:237948, per:1.370218, inc:0.02, rot:1.370218, color:0xeef2f4, shader:'ICEMOON',
    nota:'Expulsa géiseres de agua salada por su polo sur.' },
  { id:'titan', nombre:'Titán', padre:'saturno', r:2574.7, a:1221870, per:15.945, inc:0.35, rot:15.945, color:0xd9a441, shader:'TITAN',
    nota:'Única luna con atmósfera densa. Tiene lagos y ríos de metano líquido.' },
  { id:'rea', nombre:'Rea', padre:'saturno', r:763.8, a:527108, per:4.518212, inc:0.35, rot:4.518212, color:0xbfbcb6, shader:'ICEMOON' },
  { id:'titania', nombre:'Titania', padre:'urano', r:788.4, a:435910, per:8.706234, inc:0.34, rot:8.706234, color:0x9e938c, shader:'MOON' },
  { id:'triton', nombre:'Tritón', padre:'neptuno', r:1353.4, a:354759, per:-5.876854, inc:156.885, rot:5.876854, color:0xd3c9c0, shader:'ICEMOON',
    nota:'Orbita al revés que Neptuno: es un objeto del cinturón de Kuiper capturado.' },
  { id:'caronte', nombre:'Caronte', padre:'pluton', r:606, a:19591, per:6.3872, inc:0.08, rot:6.3872, color:0xa89c90, shader:'MOON',
    nota:'Tan grande respecto a Plutón que ambos giran alrededor de un punto en el vacío.' }
];

/* Estrellas cercanas a las que se puede viajar (distancia en años luz) */
const NEAR_STARS = [
  { nombre:'Próxima Centauri', ly:4.2465, ra:14.4959, dec:-62.6795 },
  { nombre:'Alfa Centauri A',  ly:4.3650, ra:14.6600, dec:-60.8340 },
  { nombre:'Estrella de Barnard', ly:5.9629, ra:17.9634, dec:4.6933 },
  { nombre:'Sirio A',          ly:8.6094, ra:6.7525,  dec:-16.7161 },
  { nombre:'Vega',             ly:25.04,  ra:18.6156, dec:38.7837 },
  { nombre:'Betelgeuse',       ly:548.0,  ra:5.9195,  dec:7.4071 }
];
