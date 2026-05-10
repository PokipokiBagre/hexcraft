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
  // Encuentra el elemento hechizo o slot más cercano al punto del evento
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return null;
  const item = el.closest('[data-hxc-idx]');
  if (item) return { id: `item:${item.dataset.hxcIdx}`, el: item };
  const slot = el.closest('.hxc-slot:not(.vacio)');
  if (slot) {
    // Determinar grupo e índice del slot
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

  // Dibujar línea de preview
  if (!_previewLine) {
    _previewLine = document.createElementNS('http://www.w3.org/2000/svg','line');
    _previewLine.setAttribute('id','hxfx-preview-line');
    _previewLine.setAttribute('stroke-dasharray','6 4');
    _previewLine.setAttribute('opacity','0.6');
    svg.appendChild(_previewLine);
  }
  const po = _posEl(fxState.drag.origenEl);
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

  // Quitar línea de preview
  _previewLine?.remove();
  _previewLine = null;

  // Quitar highlight origen
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
  const id = `item:${itemIdx}`;
  const el = _itemEl(itemIdx);
  el?.classList.add('hxfx-origen');
  fxState.drag = { origenId: id, origenEl: el };
  return true;
}

// Mantener compatibilidad con los handlers de clic (ya no se usan para crear)
export function fxClickSlot(grupo, idx) { return false; }
export function fxClickItem(itemIdx)     { return false; }

// ── Obtener posición central de un elemento relativa al SVG overlay ──
function _posEl(el) {
  const svg = document.getElementById('hxfx-overlay');
  if (!el || !svg) return null;
  const bodyRect = svg.parentElement.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return {
    x: elRect.left + elRect.width/2 - bodyRect.left,
    y: elRect.top  + elRect.height/2 - bodyRect.top,
    w: elRect.width,
    h: elRect.height,
  };
}

// ── Encontrar elemento DOM por su id ─────────────────────────
function _findEl(id) {
  if (id.startsWith('slot:')) {
    const [, grupo, idx] = id.split(':');
    return document.querySelector(`.hxc-col:${grupo==='B'?'last-child':'first-child'} .hxc-slot:nth-child(${parseInt(idx)+2})`);
  }
  if (id.startsWith('item:')) {
    const idx = id.split(':')[1];
    return document.querySelector(`[data-hxc-idx="${idx}"]`);
  }
  return null;
}

// Alias más fiable usando grupo/idx
function _slotEl(grupo, idx) {
  const col = grupo === 'A'
    ? document.querySelector('.hxc-col:not(.hxc-col-b)')
    : document.querySelector('.hxc-col-b');
  if (!col) return null;
  const slots = col.querySelectorAll('.hxc-slot');
  return slots[idx] || null;
}

function _itemEl(itemIdx) {
  return document.querySelector(`[data-hxc-idx="${itemIdx}"] .hxc-item-row`) ||
         document.querySelector(`[data-hxc-idx="${itemIdx}"]`);
}

// ── Dibujar una flecha curva entre dos puntos ─────────────────
function _svgFlecha(f) {
  const elO = f.origenId.startsWith('slot:')
    ? _slotEl(...f.origenId.split(':').slice(1))
    : _itemEl(f.origenId.split(':')[1]);
  const elD = f.destinoId.startsWith('slot:')
    ? _slotEl(...f.destinoId.split(':').slice(1))
    : _itemEl(f.destinoId.split(':')[1]);

  const po = _posEl(elO);
  const pd = _posEl(elD);
  if (!po || !pd) return '';

  // Punto de salida: borde derecho del origen si el destino está a la derecha, etc.
  const dx = pd.x - po.x;
  const dy = pd.y - po.y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;

  // Punto de inicio/fin en el borde del elemento
  const ox = po.x + (dx/dist)*(po.w/2);
  const oy = po.y + (dy/dist)*(po.h/2);
  const dx2 = pd.x - po.x; // recompute toward dest center
  const dy2 = pd.y - po.y;
  const d2 = Math.sqrt(dx2*dx2+dy2*dy2)||1;
  const tx = pd.x - (dx2/d2)*(pd.w/2 + 8);
  const ty = pd.y - (dy2/d2)*(pd.h/2 + 8);

  // Bezier con curva lateral para evitar solapamientos
  const mid = { x: (ox+tx)/2, y: (oy+ty)/2 };
  const perp = { x: -(ty-oy)/dist*60, y: (tx-ox)/dist*60 };
  const cx = mid.x + perp.x;
  const cy = mid.y + perp.y;

  const path = `M ${ox.toFixed(1)} ${oy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;

  const dashArray = f.estilo === 'punteada'
    ? `stroke-dasharray="${f.grosor*2} ${f.grosor*2}"`
    : f.estilo === 'rayada'
      ? `stroke-dasharray="${f.grosor*5} ${f.grosor*2}"`
      : '';

  // Punta de flecha
  const ang = Math.atan2(ty - cy, tx - cx);
  const al = f.grosor * 4;
  const aw = f.grosor * 2;
  const ax1 = tx - al*Math.cos(ang-0.4);
  const ay1 = ty - al*Math.sin(ang-0.4);
  const ax2 = tx - al*Math.cos(ang+0.4);
  const ay2 = ty - al*Math.sin(ang+0.4);

  return `<g class="hxfx-flecha-g" data-fx-id="${f.id}"
      style="cursor:${fxState.modo==='borrar'?'pointer':'default'}"
      onclick="window._hxfxClickFlecha(${f.id})">
    <path d="${path}" fill="none" stroke="${f.color}"
      stroke-width="${f.grosor}" stroke-linecap="round"
      stroke-linejoin="round" opacity="0.85" ${dashArray}/>
    <polygon points="${tx.toFixed(1)},${ty.toFixed(1)} ${ax1.toFixed(1)},${ay1.toFixed(1)} ${ax2.toFixed(1)},${ay2.toFixed(1)}"
      fill="${f.color}" opacity="0.85"/>
    <path d="${path}" fill="none" stroke="transparent" stroke-width="${Math.max(f.grosor,8)}"/>
  </g>`;
}

function _redibujarTodo() {
  const svg = document.getElementById('hxfx-overlay');
  if (!svg) return;
  // Preservar defs
  const defs = svg.querySelector('defs');
  svg.innerHTML = '';
  if (defs) svg.appendChild(defs);
  fxState.flechas.forEach(f => {
    const tmp = document.createElementNS('http://www.w3.org/2000/svg','g');
    tmp.innerHTML = _svgFlecha(f);
    [...tmp.children].forEach(c => svg.appendChild(c));
  });
}

// Redibujar cuando cambia el layout (scroll, rerender)
function _scheduleRedraw() {
  clearTimeout(fxState._redrawTimer);
  fxState._redrawTimer = setTimeout(_redibujarTodo, 50);
}

// Observer para redibujar cuando el stack cambia
let _observer = null;
export function observarStack() {
  if (_observer) _observer.disconnect();
  const stack = document.getElementById('hxc-stack-list');
  if (!stack) return;
  _observer = new MutationObserver(_scheduleRedraw);
  _observer.observe(stack, { childList: true, subtree: true, attributes: true });
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

// ── _seleccionar ya no se usa (reemplazado por drag) ──────────

// ── Handlers de toolbar ────────────────────────────────────────
window._hxfxToggleConectar = () => {
  fxState.modo = fxState.modo === 'conectar' ? null : 'conectar';
  fxState.origen = null;
  document.querySelectorAll('.hxfx-origen').forEach(e => e.classList.remove('hxfx-origen'));
  _actualizarModoCursor();
  if (typeof window._hxcRender === 'function') window._hxcRender();
};

window._hxfxToggleBorrar = () => {
  fxState.modo = fxState.modo === 'borrar' ? null : 'borrar';
  fxState.origen = null;
  document.querySelectorAll('.hxfx-origen').forEach(e => e.classList.remove('hxfx-origen'));
  _actualizarModoCursor();
  if (typeof window._hxcRender === 'function') window._hxcRender();
};

window._hxfxSetColor = (c) => {
  fxState.colorActivo = c;
  if (fxState.modo !== 'conectar') fxState.modo = 'conectar';
  _actualizarModoCursor();
  if (typeof window._hxcRender === 'function') window._hxcRender();
};

window._hxfxSetGrosor = (v) => { fxState.grosor = Math.max(1, Math.min(12, parseInt(v)||3)); };
window._hxfxSetEstilo = (e) => { fxState.estilo = e; if (typeof window._hxcRender === 'function') window._hxcRender(); };

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
