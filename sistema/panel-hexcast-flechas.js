// ============================================================
// panel-hexcast-flechas.js — Sistema de flechas automáticas HexCast
// ============================================================

import { supabase } from '../hex-auth.js';
import { hxState } from './hexcast-state.js';

const fxState = {
  modo: null,
  origen: null,
  flechas: [],      // incluye { id (DB), origenId, destinoId, color, grosor, estilo, opacidad }
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
  opacidad: 0.88,
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
.hxc-estado-block.hxfx-origen { outline: 2px dashed #40c840 !important; outline-offset: 1px; }

/* Hover en modo conectar */
.modo-conectar-activo [data-hxc-idx]:hover,
.modo-conectar-activo .hxc-slot:not(.vacio):hover,
.modo-conectar-activo .hxc-estado-block[data-hxf-id]:hover {
  outline: 2px dashed rgba(64,200,64,0.5) !important;
  outline-offset: 2px;
  cursor: crosshair !important;
}
/* Hover en modo borrar - rojo */
.modo-borrar-activo [data-hxc-idx]:hover,
.modo-borrar-activo .hxc-slot:not(.vacio):hover,
.modo-borrar-activo .hxc-estado-block[data-hxf-id]:hover {
  outline: 2px dashed rgba(232,64,64,0.6) !important;
  outline-offset: 2px;
  cursor: crosshair !important;
}
.modo-borrar-activo [data-hxc-idx].hxfx-origen,
.modo-borrar-activo .hxc-slot.hxfx-origen,
.modo-borrar-activo .hxc-estado-block.hxfx-origen {
  outline: 2px dashed #e84040 !important;
}

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
.hxfx-opacidad-wrap { display: flex; align-items: center; gap: 4px; }
.hxfx-opacidad-lbl { font-size: 0.56em; color: #555; white-space: nowrap; }
.hxfx-opacidad-inp { width: 60px; accent-color: #40c840; cursor: pointer; }
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
    id:        r.id,
    origenId:  r.origen_id,
    destinoId: r.destino_id,
    color:     r.color,
    grosor:    r.grosor,
    estilo:    r.estilo,
    opacidad:  r.opacidad ?? 0.88,
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
      opacidad:   f.opacidad ?? 0.88,
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
    <div class="hxfx-opacidad-wrap">
      <span class="hxfx-opacidad-lbl">Opac. ${Math.round(fxState.opacidad*100)}%</span>
      <input class="hxfx-opacidad-inp" type="range" min="0" max="100" value="${Math.round(fxState.opacidad*100)}"
        oninput="window._hxfxSetOpacidad(this.value)" onclick="event.stopPropagation()">
    </div>
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
    const rect = item.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;
    return { id: `item:${item.dataset.hxcIdx}:${isLeft ? 'L' : 'R'}`, el: item };
  }

  // Bloques de estado (debajo de los slots)
  const estadoBlock = el.closest('.hxc-estado-block[data-hxf-id]');
  if (estadoBlock) {
    return { id: `estado:${estadoBlock.dataset.hxfId}`, el: estadoBlock };
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
  if (!fxState.drag || (fxState.modo !== 'conectar' && fxState.modo !== 'borrar')) return;
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

  const previewColor = fxState.modo === 'borrar' ? '#e84040' : fxState.colorActivo;

  // Leer el lado dinámico para la línea de previsualización
  let ladoO = 'right';
  if (fxState.drag.origenId.startsWith('slot:A')) ladoO = 'right';
  else if (fxState.drag.origenId.startsWith('slot:B')) ladoO = 'left';
  else if (fxState.drag.origenId.startsWith('estado:')) {
    const el = fxState.drag.origenEl;
    ladoO = el?.closest('.hxc-col-b') ? 'left' : 'right';
  }
  else if (fxState.drag.origenId.startsWith('item:')) {
    ladoO = fxState.drag.origenId.endsWith(':L') ? 'left' : 'right';
  }

  const po = _posEl(fxState.drag.origenEl, ladoO);
  if (po) {
    _previewLine.setAttribute('x1', po.x);
    _previewLine.setAttribute('y1', po.y);
    _previewLine.setAttribute('x2', mx);
    _previewLine.setAttribute('y2', my);
    _previewLine.setAttribute('stroke', previewColor);
    _previewLine.setAttribute('stroke-width', fxState.grosor);
  }
}

function _onDragEnd(e) {
  if (!fxState.drag) return;

  _previewLine?.remove();
  _previewLine = null;
  document.querySelectorAll('.hxfx-origen').forEach(x => x.classList.remove('hxfx-origen'));

  const destino = _elIdFromEvent(e);
  const origenId = fxState.drag.origenId;
  fxState.drag = null;

  if (!destino || destino.id === origenId) return;

  if (fxState.modo === 'borrar') {
    // Buscar flecha que conecte origen↔destino en cualquier dirección
    // Comparación ignorando sufijos :L/:R para ser tolerante
    const stripSuffix = (id) => id.replace(/:[LR]$/, '');
    const oBase = stripSuffix(origenId);
    const dBase = stripSuffix(destino.id);
    const idx = fxState.flechas.findIndex(f => {
      const fO = stripSuffix(f.origenId);
      const fD = stripSuffix(f.destinoId);
      return (fO === oBase && fD === dBase) || (fO === dBase && fD === oBase);
    });
    if (idx >= 0) {
      const f = fxState.flechas[idx];
      _borrarFlechaDB(f.id);
      fxState.flechas.splice(idx, 1);
      _redibujarTodo();
    }
    return;
  }

  if (fxState.modo === 'conectar') {
    const nueva = {
      id:        fxState.nextLocalId--,
      origenId,
      destinoId: destino.id,
      color:     fxState.colorActivo,
      grosor:    fxState.grosor,
      estilo:    fxState.estilo,
      opacidad:  fxState.opacidad,
    };
    fxState.flechas.push(nueva);
    _redibujarTodo();
    _guardarFlechaDB(nueva);
  }
}

// ── API pública: inicio de drag desde slot o item ─────────────
export function fxMouseDownSlot(e, grupo, idx) {
  if (fxState.modo !== 'conectar' && fxState.modo !== 'borrar') return false;
  e.stopPropagation();
  const id = `slot:${grupo}:${idx}`;
  const el = _slotEl(grupo, idx);
  el?.classList.add('hxfx-origen');
  fxState.drag = { origenId: id, origenEl: el };
  return true;
}

export function fxMouseDownItem(e, itemIdx) {
  if (fxState.modo !== 'conectar' && fxState.modo !== 'borrar') return false;
  e.stopPropagation();
  const el = _itemEl(itemIdx);
  if (!el) return false;
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

// Drag desde bloque de estado
export function fxMouseDownEstado(e, hxfId) {
  if (fxState.modo !== 'conectar' && fxState.modo !== 'borrar') return false;
  e.stopPropagation();
  const el = document.querySelector(`.hxc-estado-block[data-hxf-id="${hxfId}"]`);
  if (!el) return false;
  el.classList.add('hxfx-origen');
  fxState.drag = { origenId: `estado:${hxfId}`, origenEl: el };
  return true;
}

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
    return _itemEl(id.split(':')[1]);
  }
  if (id.startsWith('estado:')) {
    const hxfId = id.slice(7);
    return document.querySelector(`.hxc-estado-block[data-hxf-id="${hxfId}"]`);
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

  const isColA   = (id) => id.startsWith('slot:A');
  const isColB   = (id) => id.startsWith('slot:B');
  const isCenter = (id) => id.startsWith('item:');
  const isEstado = (id) => id.startsWith('estado:');

  // Para estados, detectar en qué columna está su elemento DOM
  const ladoEstado = (id) => {
    const el = _findEl(id);
    if (!el) return 'right';
    const col = el.closest('.hxc-col');
    return col?.classList.contains('hxc-col-b') ? 'left' : 'right';
  };

  // 1. Extraer sufijo explícito si existe (:L o :R)
  const getExplicit = (id) => {
    if (id.endsWith(':L')) return 'left';
    if (id.endsWith(':R')) return 'right';
    return null;
  };

  let ladoO = getExplicit(f.origenId);
  let ladoD = getExplicit(f.destinoId);

  // 2. Deducir lado si no hay sufijo explícito
  if (!ladoO) {
    if (isColA(f.origenId))   ladoO = 'right';
    else if (isColB(f.origenId))   ladoO = 'left';
    else if (isEstado(f.origenId)) ladoO = ladoEstado(f.origenId);
    else if (isCenter(f.origenId)) {
      if (isColA(f.destinoId) || isEstado(f.destinoId) && ladoEstado(f.destinoId)==='right') ladoO = 'left';
      else if (isColB(f.destinoId)) ladoO = 'right';
      else ladoO = 'right';
    }
  }

  if (!ladoD) {
    if (isColA(f.destinoId))   ladoD = 'right';
    else if (isColB(f.destinoId))   ladoD = 'left';
    else if (isEstado(f.destinoId)) ladoD = ladoEstado(f.destinoId);
    else if (isCenter(f.destinoId)) {
      if (isColA(f.origenId) || isEstado(f.origenId) && ladoEstado(f.origenId)==='right') ladoD = 'left';
      else if (isColB(f.origenId)) ladoD = 'right';
      else ladoD = 'right';
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

  const al   = Math.max(8, f.grosor * 3.5);
  const tang = Math.atan2(pd.y - cy, pd.x - cx);
  const ax1  = pd.x - al*Math.cos(tang - 0.4);
  const ay1  = pd.y - al*Math.sin(tang - 0.4);
  const ax2  = pd.x - al*Math.cos(tang + 0.4);
  const ay2  = pd.y - al*Math.sin(tang + 0.4);

  // Punto donde termina la línea (retrocede al por la tangente para no tapar la punta)
  const lineEndX = pd.x - al * Math.cos(tang);
  const lineEndY = pd.y - al * Math.sin(tang);
  const path = `M ${po.x.toFixed(1)},${po.y.toFixed(1)} Q ${cx.toFixed(1)},${cy.toFixed(1)} ${lineEndX.toFixed(1)},${lineEndY.toFixed(1)}`;

  const dash = f.estilo === 'punteada'
    ? `stroke-dasharray="${f.grosor*1.5} ${f.grosor*2}"`
    : f.estilo === 'rayada'
      ? `stroke-dasharray="${f.grosor*4} ${f.grosor*2}"`
      : '';

  const op = f.opacidad ?? 0.88;
  return `<g class="hxfx-flecha-g" data-fx-id="${f.id}" style="cursor:default;">
    <path d="${path}" fill="none" stroke="${f.color}" stroke-width="${f.grosor}"
      stroke-linecap="round" stroke-linejoin="round" opacity="${op}" ${dash}/>
    <polygon points="${pd.x.toFixed(1)},${pd.y.toFixed(1)} ${ax1.toFixed(1)},${ay1.toFixed(1)} ${ax2.toFixed(1)},${ay2.toFixed(1)}"
      fill="${f.color}" opacity="${op}"/>
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
  _observer = new MutationObserver(_scheduleRedraw);
  _observer.observe(stack, { childList: true });
  stack.addEventListener('scroll', _scheduleRedraw, { passive: true });

  // También recalcular cuando se scrollea en las columnas de grupo A y B
  const colA = document.querySelector('.hxc-col:not(.hxc-col-b)');
  const colB = document.querySelector('.hxc-col-b');
  if (colA) colA.addEventListener('scroll', _scheduleRedraw, { passive: true });
  if (colB) colB.addEventListener('scroll', _scheduleRedraw, { passive: true });
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

window._hxfxSetOpacidad = (v) => {
  fxState.opacidad = Math.max(0, Math.min(1, parseInt(v) / 100));
  _refreshToolbar();
};

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

// ── CSS modo claro (inline para no depender de fetch) ──────────
const _CLARO_CSS = `
/* Base */
.hxc-claro { background:#eae6dc!important; color:#111!important; }

/* Columnas A / B — fondo diferenciado del centro */
.hxc-claro .hxc-col { background:#dedad0!important; border-right:2px solid #b8b4aa!important; }
.hxc-claro .hxc-col-b { background:#dedad0!important; border-left:2px solid #b8b4aa!important; border-right:none!important; }
.hxc-claro .hxc-col-title { color:#222!important; background:#ccc8be!important; border-bottom:1px solid #aaa!important; font-weight:800!important; }

/* Slots */
.hxc-claro .hxc-slot { background:#dedad0!important; border-bottom:1px solid #bbb8b0!important; }
.hxc-claro .hxc-slot-nombre { color:#111!important; font-weight:700!important; }
.hxc-claro .hxc-slot-hex { color:#333!important; }
.hxc-claro .hxc-slot-vex { color:#5a2080!important; font-weight:600!important; }
.hxc-claro .hxc-slot-plus { color:rgba(0,0,0,0.4)!important; }
.hxc-claro .hxc-slot-label { color:#555!important; }
.hxc-claro .hxc-slot-avatar { border:2px solid #888!important; background:#bbb!important; }
.hxc-claro .hxc-slot.activo { box-shadow:inset 3px 0 0 var(--slot-border); background:#d4d0c6!important; }
.hxc-claro .hxc-slot-action-btn { background:#c8c4ba!important; border:1px solid #999!important; color:#222!important; font-weight:600!important; }
.hxc-claro .hxc-slot-action-btn.btn-evento { background:#c0b8d8!important; border-color:#8060b0!important; color:#3a1870!important; }

/* Estados bajo slot */
.hxc-claro .hxc-estado-block { background:#c8e8d4!important; border:1px solid #6aaa88!important; border-top:none!important; }
.hxc-claro .hxc-estado-block-nombre { color:#0a4a28!important; font-weight:700!important; }
.hxc-claro .hxc-estado-block-afin { color:#2a6a48!important; }

/* Canales SVG laterales */
.hxc-claro .hxfx-canal { background:#dedad0!important; }

/* Centro / stack */
.hxc-claro .hxc-stack { background:#eae6dc!important; }
.hxc-claro .hxc-center { background:#eae6dc!important; }
.hxc-claro .hxc-center-top { background:#c8c4b8!important; border-bottom:2px solid #888!important; }
.hxc-claro .hxc-turno-label { color:#333!important; }
.hxc-claro .hxc-turno-label strong { color:#000!important; }

/* Botones barra superior — sólidos y distinguibles */
.hxc-claro .hxc-btn-confirmar { background:rgba(180,140,0,0.15)!important; border:1.5px solid #a08020!important; color:#6a4800!important; font-weight:700!important; }
.hxc-claro .hxc-btn-guardar-hist { background:rgba(0,120,60,0.13)!important; border:1.5px solid #287a40!important; color:#0a5020!important; font-weight:700!important; }
.hxc-claro .hxc-btn-cobrar { background:rgba(180,140,0,0.15)!important; border:1.5px solid #a08020!important; color:#6a4800!important; font-weight:700!important; }
.hxc-claro .hxc-btn-devolver { background:rgba(0,140,130,0.12)!important; border:1.5px solid #108070!important; color:#0a5048!important; font-weight:700!important; }
.hxc-claro .hxc-btn-turno { background:rgba(180,40,40,0.1)!important; border:1.5px solid #882020!important; color:#701010!important; font-weight:700!important; }
.hxc-claro .hxc-btn-nuevo-turno { background:rgba(0,0,0,0.08)!important; border:1.5px solid #888!important; color:#333!important; font-weight:600!important; }
.hxc-claro .hxc-badge-hist { background:rgba(180,80,0,0.15)!important; color:#7a3000!important; border:1.5px solid #a05020!important; font-weight:700!important; }
/* Botones turno nav */
.hxc-claro .hxc-turno-nav-btn { background:rgba(0,0,0,0.08)!important; border:1px solid #999!important; color:#222!important; }
.hxc-claro .hxc-turno-select { background:#fff!important; border:1px solid #999!important; color:#111!important; }

/* Items hechizo — fondo blanco con borde visible */
.hxc-claro .hxc-item { background:#fff!important; border:1px solid #bbb!important; box-shadow:0 1px 3px rgba(0,0,0,0.12)!important; }
.hxc-claro .hxc-item-pj { color:#555!important; font-weight:600!important; }
.hxc-claro .hxc-item-hz { color:#111!important; font-weight:700!important; }
.hxc-claro .hxc-item-mult { color:#a05000!important; background:#ffe8cc!important; border:1px solid #c87020!important; font-weight:700!important; }
.hxc-claro .hxc-item.res-exito { background:#e8f8ee!important; border-color:#50a070!important; }
.hxc-claro .hxc-item.res-fallo { background:#fceaea!important; border-color:#c05050!important; }
.hxc-claro .hxc-item.es-estado { background:#eef8f2!important; border-color:#60a880!important; }

/* Badges meta */
.hxc-claro .hxc-item-row span[style] { color:#333!important; }
.hxc-claro [class*="hxc-badge"] { background:#ddd!important; border:1px solid #999!important; color:#222!important; }

/* Input dado */
.hxc-claro .hxc-dado-input { background:#f0ece4!important; border:1px solid #999!important; color:#111!important; font-weight:700!important; }

/* Item detail expandido */
.hxc-claro .hxc-item-detail { background:#f0ece0!important; border-top:2px solid #ccc!important; color:#111!important; }
.hxc-claro .hxc-hz-field-label { color:#444!important; font-weight:800!important; letter-spacing:1px!important; }
.hxc-claro .hxc-hz-field-val { color:#111!important; }
.hxc-claro .hxc-gasto-row { background:#e4e0d4!important; color:#222!important; border-left:3px solid #999!important; }
.hxc-claro .hxc-nc-calc { color:#222!important; font-weight:600!important; }
/* CD editor dentro del detail */
.hxc-claro .hxc-cd-edit-row { background:#fff8e8!important; border-left:3px solid #c87020!important; }
.hxc-claro .hxc-cd-edit-label { color:#7a4000!important; font-weight:700!important; }
.hxc-claro .hxc-cd-edit-input { background:#fff!important; border:1px solid #c87020!important; color:#7a4000!important; font-weight:700!important; }
.hxc-claro .hxc-cd-edit-btn { background:#fff!important; border:1px solid #c87020!important; color:#7a4000!important; }
.hxc-claro .hxc-cd-edit-hint { color:#888!important; }
/* Opciones del detail (Cobrar HEX, Infalible, etc.) */
.hxc-claro .hxc-detail-opts { border-bottom:1px solid #ccc!important; }
.hxc-claro .hxc-opt-btn { background:#e4e0d4!important; border:1px solid #aaa!important; color:#222!important; font-weight:600!important; }
.hxc-claro .hxc-opt-btn.on { background:#d4a030!important; border-color:#a07010!important; color:#fff!important; }

/* Items evento */
.hxc-claro .hxc-item-evento { background:#f0ecf8!important; border:1px solid #9080c0!important; box-shadow:0 1px 3px rgba(0,0,0,0.1)!important; }
.hxc-claro .hxc-item-evento-tipo { color:#4020a0!important; font-weight:700!important; }
.hxc-claro .hxc-item-evento-nombre { color:#111!important; font-weight:700!important; }
.hxc-claro .hxc-item-evento-pj { color:#444!important; }
.hxc-claro .hxc-item-evento-desc { color:#222!important; background:#e8e4f4!important; }

/* Balance */
.hxc-claro .hxc-balance-panel { background:#d8d4c8!important; border-top:2px solid #aaa!important; }
.hxc-claro .hxc-balance-title { color:#333!important; font-weight:700!important; letter-spacing:2px!important; }
.hxc-claro .hxc-balance-row { border-left:3px solid var(--slot-border)!important; }
.hxc-claro .hxc-balance-row-nombre { color:#111!important; font-weight:700!important; }
.hxc-claro .hxc-gasto-hex { color:#903010!important; font-weight:700!important; }
.hxc-claro .hxc-gasto-vex { color:#5a2080!important; font-weight:700!important; }
`;

// ── Exportar imagen ────────────────────────────────────────────
window._hxfxExportar = async (oscuro = false) => {
  if (!window.html2canvas) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const body = document.querySelector('.hxc-body');
  if (!body) return;

  // Inyectar CSS claro inline si no existe
  if (!oscuro && !document.getElementById('hxc-claro-styles')) {
    const st = document.createElement('style');
    st.id = 'hxc-claro-styles';
    st.textContent = _CLARO_CSS;
    document.head.appendChild(st);
  }

  // Medir el body real
  const bodyRect  = body.getBoundingClientRect();
  const bodyW     = Math.round(bodyRect.width);

  // Wrapper fuera de pantalla con el mismo ancho y grid exacto
  const wrapper = document.createElement('div');
  const bodyCS  = getComputedStyle(body);
  wrapper.style.cssText = `
    position:fixed;
    left:-${bodyW + 100}px;
    top:0;
    width:${bodyW}px;
    display:${bodyCS.display};
    grid-template-columns:${bodyCS.gridTemplateColumns};
    flex-direction:${bodyCS.flexDirection};
    background:${oscuro ? '#08070f' : '#f5f2ea'};
    font-family:'Inter',system-ui,sans-serif;
    overflow:visible;
    box-sizing:border-box;
  `;
  if (!oscuro) wrapper.classList.add('hxc-claro');
  document.body.appendChild(wrapper);

  // Clonar cada sección del body (excepto el SVG overlay)
  const clones = [];
  [...body.children].forEach(sec => {
    if (sec.id === 'hxfx-overlay') return;
    const cl = sec.cloneNode(true);
    // Quitar overflow en el clon y todos sus hijos scrolleables
    cl.style.overflow  = 'visible';
    cl.style.maxHeight = 'none';
    cl.style.height    = 'auto';
    cl.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.overflowY === 'auto' || cs.overflowY === 'hidden' ||
          cs.overflow  === 'auto' || cs.overflow  === 'hidden') {
        el.style.overflow  = 'visible';
        el.style.maxHeight = 'none';
        el.style.height    = 'auto';
      }
    });
    // Ocultar botones de UI no relevantes
    cl.querySelectorAll('.hxc-slot-quit,.hxc-item-del,.hxc-estado-block-del,.hxfx-toolbar').forEach(b => b.style.display='none');
    wrapper.appendChild(cl);
    clones.push(cl);
  });

  // Esperar render para medir
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const totalH = wrapper.scrollHeight;

  // Redibujar flechas con posiciones relativas al clon
  // Mapear cada elemento original → elemento clonado por su data-hxc-idx o posición slot
  const svgNS   = 'http://www.w3.org/2000/svg';
  const svgClone = document.createElementNS(svgNS, 'svg');
  svgClone.setAttribute('xmlns', svgNS);
  svgClone.setAttribute('width',  bodyW);
  svgClone.setAttribute('height', totalH);
  svgClone.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:20;overflow:visible;';
  wrapper.style.position = 'relative';

  // Helper: encontrar el rect de un elemento relativo al wrapper
  const relRect = (el) => {
    const r  = el.getBoundingClientRect();
    const wr = wrapper.getBoundingClientRect();
    return { top: r.top - wr.top, left: r.left - wr.left, right: r.right - wr.left, bottom: r.bottom - wr.top, width: r.width, height: r.height };
  };

  // Helper: encontrar el elemento clonado equivalente al original
  const findCloneEl = (origId) => {
    if (origId.startsWith('slot:')) {
      const [, grupo, idx] = origId.split(':');
      const colCls = grupo === 'B' ? '.hxc-col-b' : '.hxc-col:not(.hxc-col-b)';
      const col = wrapper.querySelector(colCls);
      return col?.querySelectorAll('.hxc-slot')[parseInt(idx)] || null;
    }
    if (origId.startsWith('item:')) {
      return wrapper.querySelector(`[data-hxc-idx="${origId.split(':')[1]}"]`);
    }
    if (origId.startsWith('estado:')) {
      return wrapper.querySelector(`.hxc-estado-block[data-hxf-id="${origId.slice(7)}"]`);
    }
    return null;
  };

  const getLado = (id, otherEl, otherIsColA) => {
    if (id.endsWith(':L')) return 'left';
    if (id.endsWith(':R')) return 'right';
    if (id.startsWith('slot:A') || id.startsWith('estado:')) {
      const el = findCloneEl(id);
      if (el) return el.closest('.hxc-col-b') ? 'left' : 'right';
      return 'right';
    }
    if (id.startsWith('slot:B')) return 'left';
    return 'right';
  };

  fxState.flechas.forEach(f => {
    const elO = findCloneEl(f.origenId);
    const elD = findCloneEl(f.destinoId);
    if (!elO || !elD) return;

    const ladoO = getLado(f.origenId, elD, false);
    const ladoD = getLado(f.destinoId, elO, false);

    const rO = relRect(elO);
    const rD = relRect(elD);

    const px = ladoO === 'left' ? rO.left : rO.right;
    const py = rO.top + rO.height / 2;
    const dx = ladoD === 'left' ? rD.left : rD.right;
    const dy = rD.top + rD.height / 2;

    const dist = Math.sqrt((dx-px)**2 + (dy-py)**2) || 1;
    const arc  = Math.min(80, Math.max(30, dist * 0.35));
    const mx   = (px + dx) / 2;
    const my   = (py + dy) / 2;
    let cx, cy;
    if (ladoO === ladoD) {
      cx = ladoO === 'left' ? Math.min(px,dx) - arc : Math.max(px,dx) + arc;
      cy = my;
    } else {
      const ndx = -(dy-py)/dist, ndy = (dx-px)/dist;
      const dir = ladoO === 'right' ? 1 : -1;
      cx = mx + ndx * arc * dir;
      cy = my + ndy * arc * dir;
    }

    const op   = f.opacidad ?? 0.88;
    const al   = Math.max(8, f.grosor * 3.5);
    const tang = Math.atan2(dy - cy, dx - cx);
    const ax1  = dx - al*Math.cos(tang - 0.4), ay1 = dy - al*Math.sin(tang - 0.4);
    const ax2  = dx - al*Math.cos(tang + 0.4), ay2 = dy - al*Math.sin(tang + 0.4);
    const leX  = dx - al*Math.cos(tang), leY = dy - al*Math.sin(tang);
    const path = `M ${px.toFixed(1)},${py.toFixed(1)} Q ${cx.toFixed(1)},${cy.toFixed(1)} ${leX.toFixed(1)},${leY.toFixed(1)}`;
    const dash = f.estilo === 'punteada' ? `stroke-dasharray="${f.grosor*1.5} ${f.grosor*2}"` :
                 f.estilo === 'rayada'   ? `stroke-dasharray="${f.grosor*4} ${f.grosor*2}"` : '';

    const g = document.createElementNS(svgNS, 'g');
    g.innerHTML = `<path d="${path}" fill="none" stroke="${f.color}" stroke-width="${f.grosor}" stroke-linecap="round" opacity="${op}" ${dash}/>
      <polygon points="${dx.toFixed(1)},${dy.toFixed(1)} ${ax1.toFixed(1)},${ay1.toFixed(1)} ${ax2.toFixed(1)},${ay2.toFixed(1)}" fill="${f.color}" opacity="${op}"/>`;
    svgClone.appendChild(g);
  });

  wrapper.appendChild(svgClone);
  await new Promise(r => requestAnimationFrame(r));

  let canvas;
  try {
    canvas = await window.html2canvas(wrapper, {
      backgroundColor: oscuro ? '#08070f' : '#f5f2ea',
      scale: 2, useCORS: true, allowTaint: true, logging: false,
      width: bodyW, height: totalH,
    });
  } finally {
    document.body.removeChild(wrapper);
  }

  if (!canvas) return;
  const tn   = document.querySelector('.hxc-turno-label strong')?.textContent || 'T';
  const link = document.createElement('a');
  link.download = `hexcast_T${tn}_${oscuro ? 'oscuro' : 'claro'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};
