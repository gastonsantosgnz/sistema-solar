/* ============================================================
   BUSCADOR — tecla "/": cuerpos, sistemas, nebulosas, momentos y
   acciones. Coincidencia sin acentos, prioridad al inicio de
   palabra, navegación con flechas y Enter. Un solo campo, nada más.
   ============================================================ */

const normTxt = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let busqItems = null, busqRes = [], busqSel = 0;

function armarBusqueda(){
  const items = [];
  for (const c of cuerpos){
    const d = c.def;
    const s = d.ly ? 'Sistema · ' + d.tipo
            : (d.tipo || (c.esLuna ? 'Luna de ' + porId[d.padre].def.nombre : ''));
    items.push({ t: d.nombre, s, go: () => d.ly ? irASistema(d.id) : enfocar(d.id) });
  }
  for (const n of NEBULOSAS)
    items.push({ t: n.nombre, s: 'Nebulosa · ' + nf(n.ly, 0) + ' al', go: () => irANebulosa(n) });
  MOMENTOS.forEach((m, i) => items.push({ t: m.nombre, s: 'Momento · ' + m.fecha, go: () => abrirMomento(i) }));
  const acciones = [
    ['Ver todo el sistema', verSistema], ['Ver la galaxia desde fuera', verGalaxia],
    ['Comparar tamaños', abrirSelector], ['Postal de esta fecha', abrirPostal],
    ['Vuelo libre', alternarModo], ['Volver a hoy', () => viajarEnElTiempo(dateToJD(new Date()))]
  ];
  for (const [t, f] of acciones) items.push({ t, s: 'Acción', go: f, accion: true });
  for (const it of items) it.n = normTxt(it.t + ' ' + it.s);
  return items;
}

function buscar(q){
  const nq = normTxt(q.trim());
  if (!nq) return busqItems.filter(i => i.accion);
  const puntos = it => {
    const nt = normTxt(it.t);
    if (nt.startsWith(nq)) return 0;
    if (nt.split(/[\s(]+/).some(w => w.startsWith(nq))) return 1;
    if (nt.includes(nq)) return 2;
    if (it.n.includes(nq)) return 3;
    return 9;
  };
  return busqItems.map(it => [puntos(it), it]).filter(x => x[0] < 9)
    .sort((a, b) => a[0] - b[0] || a[1].t.length - b[1].t.length)
    .slice(0, 9).map(x => x[1]);
}

function marcarBusqueda(){
  $('#busqLista').querySelectorAll('button').forEach((b, j) => b.classList.toggle('activo', j === busqSel));
}
function pintarBusqueda(){
  const lista = $('#busqLista');
  busqRes = buscar($('#busqIn').value);
  busqSel = Math.min(busqSel, Math.max(0, busqRes.length - 1));
  lista.innerHTML = busqRes.length
    ? busqRes.map((it, i) => `<button data-i="${i}">${it.t}<em>${it.s}</em></button>`).join('')
    : '<p class="calc">sin resultados</p>';
  lista.querySelectorAll('button').forEach(b => {
    b.onmouseenter = () => { busqSel = +b.dataset.i; marcarBusqueda(); };
    b.onclick = () => irBusqueda(+b.dataset.i);
  });
  marcarBusqueda();
}
function irBusqueda(i){
  const it = busqRes[i]; if (!it) return;
  cerrarBuscador();
  document.body.classList.remove('menu');
  it.go();
}
function abrirBuscador(){
  if (!busqItems) busqItems = armarBusqueda();
  $('#buscador').classList.add('abierto');
  $('#busqIn').value = ''; busqSel = 0;
  pintarBusqueda();
  setTimeout(() => $('#busqIn').focus(), 30);
}
function cerrarBuscador(){
  $('#buscador').classList.remove('abierto');
  $('#busqIn').blur();
}

$('#busqIn').addEventListener('input', () => { busqSel = 0; pintarBusqueda(); });
$('#busqIn').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown'){ e.preventDefault(); if (busqRes.length){ busqSel = (busqSel + 1) % busqRes.length; marcarBusqueda(); } }
  else if (e.key === 'ArrowUp'){ e.preventDefault(); if (busqRes.length){ busqSel = (busqSel - 1 + busqRes.length) % busqRes.length; marcarBusqueda(); } }
  else if (e.key === 'Enter'){ e.preventDefault(); irBusqueda(busqSel); }
  else if (e.key === 'Escape'){ cerrarBuscador(); }
});
$('#btnBuscar').onclick = abrirBuscador;
$('#buscador').addEventListener('click', e => { if (e.target.id === 'buscador') cerrarBuscador(); });
window.sistemaSolar.buscar = abrirBuscador;
