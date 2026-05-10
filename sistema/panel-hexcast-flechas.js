// ============================================================
// panel-hexcast-flechas.js — Sistema de flechas automáticas HexCast
// ============================================================

import { supabase } from '../hex-auth.js';
import { hxState } from './hexcast-state.js';

const fxState = {
  modo: null,
  origen: null,
  flechas: [],      // incluye { id (DB), origenId, destinoId, color, grosor, estilo }
  nextLocalId: -1,  // IDs negativos = locales aún no guardados
  turnoIdCargado: null,
  colores: [
    '#e84040','#e87040','#e8c040','#40c840',
    '#40d0c0','#4090e8','#a040e8','#e840b0',
    '#e8e8e8','#888888',
  ],
  colorActivo: '#40c840',
  grosor: 3,
  estilo: 'solida',
};

// ── CSS ────────────────────────────────────────────────────────
function _css() {
  if (document.getElementById('hxfx-styles')) return;
  const st = document.createElement('style');
  st.id = 'hxfx-styles';
  st.textContent = `
/* SVG overlay sobre todo el body del panel */
#hxfx-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
  overflow: visible;
}
#hxfx-overlay.modo-conectar { pointer-events: none; }

/* Elemento seleccionado como origen */
.hxfx-origen {
  outline: 2px dashed v !important;
  outline-offset: 2px;
}
[data-hxc-idx].hxfx-origen { outline: 2px dashed #40c840 !important; outline-offset: 2px; }
.hxc-slot.hxfx-origen { outline: 2px dashed #40c840 !important; }

/* Hover en modo conectar */
.modo-conectar-activo [data-hxc-idx]:hover,
.modo-conectar-activo .hxc-slot:not(.vacio):hover {
  outline: 2px dashed rgba(64,200,64,0.5) !important;
  outline-offset: 2px;
  cursor: crosshair !important;
}
.modo-borrar-activo .hxfx-flecha-g:hover { cursor: pointer; }

/* Toolbar */
.hxfx-toolbar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
  flex-wrap: wrap;
  background: rgba(0,0,0,0.18);
}
.hxfx-btn {
  font-size: 0.62em;
  padding: 3px 9px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: #888;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
  font-family: inherit;
  user-select: none;
}
.hxfx-btn:hover { background: rgba(255,255,255,0.1); color: #ccc; }
.hxfx-btn.activo {
  color: #fff;
  border-color: var(--fx-ac, #40c840);
  background: rgba(64,200,64,0.12);
  box-shadow: 0 0 8px rgba(64,200,64,0.25);
}
.hxfx-btn-borrar.activo {
  border-color: #e84040 !important;
  background: rgba(232,64,64,0.12) !important;
  box-shadow: 0 0 8px rgba(232,64,64,0.2) !important;
}
.hxfx-sep { width: 1px; height: 14px; background: rgba(255,255,255,0.1); flex-shrink: 0; }
.hxfx-colores { display: flex; gap: 3px; align-items: center; }
.hxfx-dot {
  width: 14px; height: 14px; border-radius: 50%;
  cursor: pointer; border: 2px solid transparent;
  transition: transform 0.1s, border-color 0.1s; flex-shrink: 0;
}
.hxfx-dot:hover { transform: scale(1.25); }
.hxfx-dot.sel { border-color: #fff; transform: scale(1.2); }
.hxfx-grosor-inp {
  width: 30px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 3px; color: #ccc;
  font-size: 0.68em; padding: 2px 4px;
  text-align: center; outline: none; font-family: inherit;
}
.hxfx-estilo-btn {
  font-size: 0.6em; padding: 3px 7px;
  border-radius: 4px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05); color: #777;
  cursor: pointer; font-family: inherit; transition: all 0.12s;
}
.hxfx-estilo-btn.sel { border-color: rgba(255,255,255,0.3); color: #ccc; background: rgba(255,255,255,0.1); }
.hxfx-btn-export {
  font-size: 0.62em; padding: 3px 9px; border-radius: 4px;
  border: 1px solid rgba(212,175,55,0.35);
  background: rgba(212,175,55,0.07); color: #d4af37;
  cursor: pointer; font-family: inherit; transition: all 0.12s;
}
.hxfx-btn-export:hover { background: rgba(212,175,55,0.18); }
.hxfx-btn-clear {
  font-size: 0.62em; padding: 3px 8px; border-radius: 4px;
  border: 1px solid rgba(220,80,80,0.25);
  background: rgba(220,80,80,0.05); color: #e06060;
  cursor: pointer; font-family: inherit; transition: all 0.12s;
}
.hxfx-btn-clear:hover { background: rgba(220,80,80,0.15); }
.hxfx-hint {
  font-size: 0.57em; color: #444; font-style: italic; margin-left: 4px;
}
`;
  document.head.appendChild(st);
}

// ── DB: cargar flechas del turno activo ───────────────────────
export async function cargarFlechasTurno(turnoId, sesionId) {
  if (fxState.turnoIdCargado === turnoId) return;
  fxState.turnoIdCargado = turnoId;
  fxState.flechas = [];
  fxState.origen  = null;

  if (!turnoId) { _redibujarTodo(); return; }

  const { data } = await supabase
    .from('hexcast_flechas')
    .select('*')
    .eq('turno_id', turnoId)
    .order('id');

  fxState.flechas = (data || []).map(r => ({
    id:        r.id,          // ID real de DB
    origenId:  r.origen_id,
    destinoId: r.destino_id,
    color:     r.color,
    grosor:    r.grosor,
    estilo:    r.estilo,
  }));
  _scheduleRedraw();
}

async function _guardarFlechaDB(f) {
  const turnoId  = hxState.turnoActivo?.id;
  const sesionId = hxState.sesionActiva?.id;
  if (!turnoId) return;

  const { data, error } = await supabase
    .from('hexcast_flechas')
    .insert({
      turno_id:   turnoId,
      sesion_id:  sesionId,
      origen_id:  f.origenId,
      destino_id: f.destinoId,
      color:      f.color,
      grosor:     f.grosor,
      estilo:     f.estilo,
    })
    .select()
    .single();

  if (!error && data) {
    // Reemplazar id local por id real de DB
    const local = fxState.flechas.find(x => x.id === f.id);
    if (local) local.id = data.id;
  }
}

async function _borrarFlechaDB(id) {
  if (id < 0) return; // era local, nunca se guardó
  await supabase.from('hexcast_flechas').delete().eq('id', id);
}

// ── Exportar función para limpiar al cambiar turno ─────────────
export function resetFlechas() {
  fxState.flechas = [];
  fxState.origen  = null;
  fxState.turnoIdCargado = null;
  _redibujarTodo();
}

// ── Toolbar HTML ───────────────────────────────────────────────
export function renderToolbarFlechas() {
  _css();
  const mc = fxState.modo === 'conectar';
  const mb = fxState.modo === 'borrar';
  const ac = fxState.colorActivo;

  const dots = fxState.colores.map(c =>
    `<div class="hxfx-dot ${c===ac?'sel':''}" style="background:${c}" onclick="window._hxfxSetColor('${c}')"></div>`
  ).join('');

  const estilos = [
    { id:'solida',   label:'━━' },
    { id:'punteada', label:'•••' },
    { id:'rayada',   label:'╌╌' },
  ].map(e =>
    `<button class="hxfx-estilo-btn ${fxState.estilo===e.id?'sel':''}" onclick="window._hxfxSetEstilo('${e.id}')" title="${e.id}">${e.label}</button>`
  ).join('');

  const hint = mc
    ? `<span class="hxfx-hint">${fxState.origen ? '→ clic en destino' : 'clic en origen'}</span>`
    : mb ? `<span class="hxfx-hint">clic sobre una flecha para borrarla</span>` : '';

  return `<div class="hxfx-toolbar">
    <button class="hxfx-btn ${mc?'activo':''}" style="${mc?'--fx-ac:'+ac:''}" onclick="window._hxfxToggleConectar()">⟶ Flecha</button>
    <button class="hxfx-btn hxfx-btn-borrar ${mb?'activo':''}" onclick="window._hxfxToggleBorrar()">✕ Borrar</button>
    <div class="hxfx-sep"></div>
    <div class="hxfx-colores">${dots}</div>
    <div class="hxfx-sep"></div>
    ${estilos}
    <div class="hxfx-sep"></div>
    <span style="font-size:0.58em;color:#555;">Grosor</span>
    <input class="hxfx-grosor-inp" type="number" min="1" max="12" value="${fxState.grosor}"
      oninput="window._hxfxSetGrosor(this.value)" onclick="event.stopPropagation()">
    <div class="hxfx-sep"></div>
    <button class="hxfx-btn-clear" onclick="window._hxfxLimpiar()">✕ Todo</button>
    <button class="hxfx-btn-export" onclick="window._hxfxExportar(false)">📷 Claro</button>
    <button class="hxfx-btn-export" style="border-color:rgba(255,255,255,0.1);color:#777;background:rgba(255,255,255,0.03);" onclick="window._hxfxExportar(true)">📷 Oscuro</button>
    ${hint}
  </div>`;
}

// ── Canal SVG (placeholder, las flechas van en overlay global) ─
export function renderCanalSVG(lado) {
  return `<div class="hxfx-canal" id="hxfx-canal-${lado}" style="flex-shrink:0;position:relative;overflow:visible;"></div>`;
}

// ── Inyectar SVG overlay sobre el hxc-body ────────────────────
export function montarOverlay() {
  _css();
  const body = document.querySelector('.hxc-body');
  if (!body || document.getElementById('hxfx-overlay')) return;
  body.style.position = 'relative';
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.id = 'hxfx-overlay';
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  body.appendChild(svg);
  const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
  svg.appendChild(defs);

  // Eventos globales de drag para conectar elementos
  document.addEventListener('mousemove', _onDragMove);
  document.addEventListener('mouseup',   _onDragEnd);
  document.addEventListener('touchmove', e => _onDragMove(e.touches[0]), { passive: true });
  document.addEventListener('touchend',  e => _onDragEnd(e.changedTouches[0]), { passive: true });

  _actualizarModoCursor();
  _redibujarTodo();
}

// ── Drag helpers ──────────────────────────────────────────────
function _elIdFromEvent(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return null;
  
  const item = el.closest('[data-hxc-idx]');
  if (item) {
    // Detectamos de qué lado se soltó el mouse para el Destino
    const rect = item.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;
    return { id: `item:${item.dataset.hxcIdx}:${isLeft ? 'L' : 'R'}`, el: item };
  }
  
  const slot = el.closest('.hxc-slot:not(.vacio)');
  if (slot) {
    const col = slot.closest('.hxc-col');
    if (!col) return null;
    const grupo = col.classList.contains('hxc-col-b') ? 'B' : 'A';
    const slots = [...col.querySelectorAll('.hxc-slot')];
    const idx = slots.indexOf(slot);
    if (idx < 0) return null;
    return { id: `slot:${grupo}:${idx}`, el: slot };
  }
  return null;
}

let _previewLine = null;

function _onDragMove(e) {
  if (!fxState.drag || fxState.modo !== 'conectar') return;
  const svg = document.getElementById('hxfx-overlay');
  if (!svg) return;
  const bodyRect = svg.parentElement.getBoundingClientRect();
  const mx = e.clientX - bodyRect.left;
  const my = e.clientY - bodyRect.top;

  if (!_previewLine) {
    _previewLine = document.createElementNS('http://www.w3.org/2000/svg','line');
    _previewLine.setAttribute('id','hxfx-preview-line');
    _previewLine.setAttribute('stroke-dasharray','6 4');
    _previewLine.setAttribute('opacity','0.6');
    svg.appendChild(_previewLine);
  }

  // Leer el lado dinámico para la línea de previsualización
  let ladoO = 'right';
  if (fxState.drag.origenId.startsWith('slot:A')) ladoO = 'right';
  else if (fxState.drag.origenId.startsWith('slot:B')) ladoO = 'left';
  else if (fxState.drag.origenId.startsWith('item:')) {
    ladoO = fxState.drag.origenId.endsWith(':L') ? 'left' : 'right';
  }

  const po = _posEl(fxState.drag.origenEl, ladoO);
  if (po) {
    _previewLine.setAttribute('x1', po.x);
    _previewLine.setAttribute('y1', po.y);
    _previewLine.setAttribute('x2', mx);
    _previewLine.setAttribute('y2', my);
    _previewLine.setAttribute('stroke', fxState.colorActivo);
    _previewLine.setAttribute('stroke-width', fxState.grosor);
  }
}

function _onDragEnd(e) {
  if (!fxState.drag || fxState.modo !== 'conectar') return;

  _previewLine?.remove();
  _previewLine = null;
  document.querySelectorAll('.hxfx-origen').forEach(x => x.classList.remove('hxfx-origen'));

  const destino = _elIdFromEvent(e);
  const origenId = fxState.drag.origenId;
  fxState.drag = null;

  if (destino && destino.id !== origenId) {
    const nueva = {
      id:        fxState.nextLocalId--,
      origenId,
      destinoId: destino.id,
      color:     fxState.colorActivo,
      grosor:    fxState.grosor,
      estilo:    fxState.estilo,
    };
    fxState.flechas.push(nueva);
    _redibujarTodo();
    _guardarFlechaDB(nueva);
  }
}

// ── API pública: inicio de drag desde slot o item ─────────────
export function fxMouseDownSlot(e, grupo, idx) {
  if (fxState.modo !== 'conectar') return false;
  e.stopPropagation();
  const id = `slot:${grupo}:${idx}`;
  const el = _slotEl(grupo, idx);
  el?.classList.add('hxfx-origen');
  fxState.drag = { origenId: id, origenEl: el };
  return true;
}

export function fxMouseDownItem(e, itemIdx) {
  if (fxState.modo !== 'conectar') return false;
  e.stopPropagation();
  const el = _itemEl(itemIdx);
  if (!el) return false;
  
  // Detectamos de qué lado se inició el drag para el Origen
  const rect = el.getBoundingClientRect();
  const isLeft = e.clientX < rect.left + rect.width / 2;
  const id = `item:${itemIdx}:${isLeft ? 'L' : 'R'}`;
  
  el.classList.add('hxfx-origen');
  fxState.drag = { origenId: id, origenEl: el };
  return true;
}

// Mantener compatibilidad con los handlers de clic
export function fxClickSlot(grupo, idx) { return false; }
export function fxClickItem(itemIdx)     { return false; }

// ── Obtener posición central de un elemento relativa al SVG overlay ──
// ── Posición en el BORDE del elemento (izq o der), no en el centro ──
function _posEl(el, lado) {
  const svg = document.getElementById('hxfx-overlay');
  if (!el || !svg) return null;
  const bodyRect = svg.parentElement.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const cx = lado === 'left'  ? r.left  - bodyRect.left
           : lado === 'right' ? r.right - bodyRect.left
           : r.left + r.width/2 - bodyRect.left;
  const cy = r.top + r.height/2 - bodyRect.top;
  return { x: cx, y: cy, w: r.width, h: r.height, lado };
}

// ── Encontrar elemento DOM por su id ─────────────────────────
function _findEl(id) {
  if (id.startsWith('slot:')) {
    const [, grupo, idx] = id.split(':');
    return _slotEl(grupo, parseInt(idx));
  }
  if (id.startsWith('item:')) {
    // Al dibujar, ignoramos el :L o :R para poder encontrar el elemento HTML
    return _itemEl(id.split(':')[1]);
  }
  return null;
}

function _slotEl(grupo, idx) {
  const col = grupo === 'A'
    ? document.querySelector('.hxc-col:not(.hxc-col-b)')
    : document.querySelector('.hxc-col-b');
  if (!col) return null;
  return col.querySelectorAll('.hxc-slot')[idx] || null;
}

function _itemEl(itemIdx) {
  return document.querySelector(`[data-hxc-idx="${itemIdx}"]`);
}

// ── Dibujar una flecha entre dos elementos usando sus lados ────
function _svgFlecha(f) {
  const elO = _findEl(f.origenId);
  const elD = _findEl(f.destinoId);
  if (!elO || !elD) return '';

  const isColA = (id) => id.startsWith('slot:A');
  const isColB = (id) => id.startsWith('slot:B');
  const isCenter = (id) => id.startsWith('item:');

  // 1. Extraer sufijo explícito si existe (:L o :R)
  const getExplicit = (id) => {
    if (id.endsWith(':L')) return 'left';
    if (id.endsWith(':R')) return 'right';
    return null; // Flechas antiguas de la DB no tienen sufijo
  };

  let ladoO = getExplicit(f.origenId);
  let ladoD = getExplicit(f.destinoId);

  // 2. Si no hay sufijo (flechas viejas de DB o slots), deducir lógicamente el lado
  if (!ladoO) {
    if (isColA(f.origenId)) ladoO = 'right'; // Grupo A expulsa por su derecha
    else if (isColB(f.origenId)) ladoO = 'left';  // Grupo B expulsa por su izquierda
    else if (isCenter(f.origenId)) {
      if (isColA(f.destinoId)) ladoO = 'left'; // Va hacia A, sale por la izquierda
      else if (isColB(f.destinoId)) ladoO = 'right'; // Va hacia B, sale por la derecha
      else ladoO = 'right'; // Item a Item por defecto a la derecha
    }
  }

  if (!ladoD) {
    if (isColA(f.destinoId)) ladoD = 'right'; // Grupo A recibe por su derecha
    else if (isColB(f.destinoId)) ladoD = 'left';  // Grupo B recibe por su izquierda
    else if (isCenter(f.destinoId)) {
      if (isColA(f.origenId)) ladoD = 'left'; // Viene de A, entra por la izquierda
      else if (isColB(f.origenId)) ladoD = 'right'; // Viene de B, entra por la derecha
      else ladoD = 'right'; // Item a Item por defecto a la derecha
    }
  }

  const po = _posEl(elO, ladoO);
  const pd = _posEl(elD, ladoD);
  if (!po || !pd) return '';

  // 3. Matemáticas para curvar la línea
  const dx = pd.x - po.x;
  const dy = pd.y - po.y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;

  const arcAmt = Math.min(80, Math.max(30, dist * 0.35));
  const mx = (po.x + pd.x) / 2;
  const my = (po.y + pd.y) / 2;

  let cx, cy;
  if (ladoO === ladoD) {
    // Arco en "C" para conectar elementos en el mismo flanco
    cx = ladoO === 'left' ? Math.min(po.x, pd.x) - arcAmt : Math.max(po.x, pd.x) + arcAmt;
    cy = my;
  } else {
    // Comportamiento de curva en "S" para cruzar la pantalla limpio
    const arcDir = ladoO === 'right' ? 1 : -1;
    const nx = -dy / dist;
    const ny =  dx / dist;
    cx = mx + nx * arcAmt * arcDir;
    cy = my + ny * arcAmt * arcDir;
  }

  const path = `M ${po.x.toFixed(1)},${po.y.toFixed(1)} Q ${cx.toFixed(1)},${cy.toFixed(1)} ${pd.x.toFixed(1)},${pd.y.toFixed(1)}`;

  const dash = f.estilo === 'punteada'
    ? `stroke-dasharray="${f.grosor*1.5} ${f.grosor*2}"`
    : f.estilo === 'rayada'
      ? `stroke-dasharray="${f.grosor*4} ${f.grosor*2}"`
      : '';

  const al  = Math.max(8, f.grosor * 3.5);
  const tang = Math.atan2(pd.y - cy, pd.x - cx);
  const ax1 = pd.x - al*Math.cos(tang - 0.4);
  const ay1 = pd.y - al*Math.sin(tang - 0.4);
  const ax2 = pd.x - al*Math.cos(tang + 0.4);
  const ay2 = pd.y - al*Math.sin(tang + 0.4);

  return `<g class="hxfx-flecha-g" data-fx-id="${f.id}"
      onclick="window._hxfxClickFlecha(${f.id})" style="cursor:${fxState.modo==='borrar'?'pointer':'default'}">
    <path d="${path}" fill="none" stroke="${f.color}" stroke-width="${f.grosor}"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.88" ${dash}/>
    <polygon points="${pd.x.toFixed(1)},${pd.y.toFixed(1)} ${ax1.toFixed(1)},${ay1.toFixed(1)} ${ax2.toFixed(1)},${ay2.toFixed(1)}"
      fill="${f.color}" opacity="0.88"/>
    <path d="${path}" fill="none" stroke="transparent" stroke-width="${Math.max(f.grosor+4,10)}"/>
  </g>`;
}

function _redibujarTodo() {
  const svg = document.getElementById('hxfx-overlay');
  if (!svg) return;
  // Actualizar tamaño del overlay al body
  const body = svg.parentElement;
  if (body) {
    svg.setAttribute('width',  body.offsetWidth);
    svg.setAttribute('height', body.offsetHeight);
  }
  // Limpiar y redibujar
  const defs = svg.querySelector('defs');
  svg.innerHTML = '';
  if (defs) svg.appendChild(defs);
  fxState.flechas.forEach(f => {
    const html = _svgFlecha(f);
    if (!html) return;
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.innerHTML = html;
    [...g.children].forEach(c => svg.appendChild(c));
  });
}

// RAF-throttled redraw para scroll — no dispara 60 veces por segundo
let _rafPending = false;
function _scheduleRedraw() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => { _rafPending = false; _redibujarTodo(); });
}

// Observer solo para cambios de estructura del stack (no scroll, no attributes)
let _observer = null;
export function observarStack() {
  if (_observer) _observer.disconnect();
  const stack = document.getElementById('hxc-stack-list');
  if (!stack) return;
  // Solo childList en el stack directo (no subtree) para evitar loops
  _observer = new MutationObserver(_scheduleRedraw);
  _observer.observe(stack, { childList: true });
  // Scroll con RAF throttle
  stack.addEventListener('scroll', _scheduleRedraw, { passive: true });
}

// ── Modo cursor en el body ─────────────────────────────────────
function _actualizarModoCursor() {
  const body = document.querySelector('.hxc-body');
  if (!body) return;
  body.classList.remove('modo-conectar-activo','modo-borrar-activo');
  if (fxState.modo === 'conectar') body.classList.add('modo-conectar-activo');
  if (fxState.modo === 'borrar')   body.classList.add('modo-borrar-activo');
}

// ── Handlers de toolbar ────────────────────────────────────────

function _refreshToolbar() {
  const oldTb = document.querySelector('.hxfx-toolbar');
  if (oldTb) {
    oldTb.outerHTML = renderToolbarFlechas();
  }
}

window._hxfxToggleConectar = () => {
  fxState.modo = fxState.modo === 'conectar' ? null : 'conectar';
  fxState.origen = null;
  document.querySelectorAll('.hxfx-origen').forEach(e => e.classList.remove('hxfx-origen'));
  _actualizarModoCursor();
  _refreshToolbar();
};

window._hxfxToggleBorrar = () => {
  fxState.modo = fxState.modo === 'borrar' ? null : 'borrar';
  fxState.origen = null;
  document.querySelectorAll('.hxfx-origen').forEach(e => e.classList.remove('hxfx-origen'));
  _actualizarModoCursor();
  _refreshToolbar();
};

window._hxfxSetColor = (c) => {
  fxState.colorActivo = c;
  if (fxState.modo !== 'conectar') fxState.modo = 'conectar';
  _actualizarModoCursor();
  _refreshToolbar();
};

window._hxfxSetGrosor = (v) => { fxState.grosor = Math.max(1, Math.min(12, parseInt(v)||3)); };

window._hxfxSetEstilo = (e) => { 
  fxState.estilo = e; 
  _refreshToolbar(); 
};

window._hxfxClickFlecha = (id) => {
  if (fxState.modo !== 'borrar') return;
  const f = fxState.flechas.find(x => x.id === id);
  if (f) _borrarFlechaDB(f.id);
  fxState.flechas = fxState.flechas.filter(f => f.id !== id);
  _redibujarTodo();
};

window._hxfxLimpiar = async () => {
  // Borrar de DB todas las flechas del turno activo
  const turnoId = hxState.turnoActivo?.id;
  if (turnoId) {
    await supabase.from('hexcast_flechas').delete().eq('turno_id', turnoId);
  }
  fxState.flechas = [];
  _redibujarTodo();
};

// ── Exportar imagen ────────────────────────────────────────────
window._hxfxExportar = async (oscuro = false) => {
  if (!window.html2canvas) {
    await new Promise((res,rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const target = document.querySelector('.hxc-body') || document.getElementById('hxc-drawer');
  if (!target) return;
  const prev = target.style.background;
  if (!oscuro) target.style.background = '#f4f0e8';
  // Ocultar toolbar momentáneamente
  const tb = target.querySelector('.hxfx-toolbar');
  if (tb) tb.style.display = 'none';
  const canvas = await window.html2canvas(target, {
    backgroundColor: oscuro ? '#08080e' : '#f4f0e8',
    scale: 2, useCORS: true, allowTaint: true, logging: false,
  });
  target.style.background = prev;
  if (tb) tb.style.display = '';
  const link = document.createElement('a');
  const tn = document.querySelector('.hxc-turno-label strong')?.textContent || 'T';
  link.download = `hexcast_T${tn}_${oscuro?'oscuro':'claro'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};
