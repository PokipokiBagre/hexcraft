// ============================================================
// panel-hexcast-evento.js — Panel de Eventos del sistema HexCast
// Gestiona cola de cambios (stats, hechizos, objetos) para un PJ
// durante un turno, con aplicación diferida mediante "Aplicar eventos".
// ============================================================

import { supabase } from '../hex-auth.js';
import { personajes } from './personajes-state.js';
import { calcularStats } from './personajes-logic.js';
import { persistirCampos } from './personajes-data.js';
import { hxState } from './hexcast-state.js';

// ── Estado local del panel de eventos ─────────────────────────
const evState = {
  abierto: false,
  pjNombre: null,        // PJ activo en el panel
  panelActivo: 'stats',  // 'stats' | 'hechizos' | 'objetos'
  busqueda: '',

  // Cola de cambios pendientes: [{ tipo, label, resumen, datos }]
  // tipos: 'stat', 'hechizo_add', 'hechizo_rem', 'obj_add', 'obj_rem', 'obj_equip'
  cola: [],

  // Cache de datos cargados
  catalogoHechizos: [],   // hechizos_nodos
  inventarioHz: [],       // hechizos_inventario del PJ
  catalogoObjetos: [],    // objetos del catálogo
  inventarioObj: [],      // inventario_objetos del PJ
};

// ── CSS ────────────────────────────────────────────────────────
function _css() {
  if (document.getElementById('hxev-styles')) return;
  const st = document.createElement('style');
  st.id = 'hxev-styles';
  st.textContent = `
/* ── Overlay y contenedor principal ── */
#hxev-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1400; opacity:0; pointer-events:none; transition:opacity 0.22s; }
#hxev-overlay.open { opacity:1; pointer-events:all; }
#hxev-root { position:fixed; top:0; right:0; bottom:0; width:820px; max-width:96vw; background:#07060e; border-left:1px solid rgba(140,90,220,0.25); z-index:1401; display:flex; flex-direction:column; transform:translateX(100%); transition:transform 0.28s cubic-bezier(0.4,0,0.2,1); font-family:'Inter',system-ui,sans-serif; box-shadow:-12px 0 50px rgba(0,0,0,0.7); }
#hxev-root.open { transform:translateX(0); }

/* ── Header ── */
.hxev-header { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.07); flex-shrink:0; background:#09081a; }
.hxev-header-title { font-family:'Cinzel',serif; font-size:0.82em; color:#b080e0; letter-spacing:2px; text-transform:uppercase; }
.hxev-header-pj { font-size:0.78em; color:#fff; font-weight:600; flex:1; }
.hxev-header-sub { font-size:0.62em; color:#666; }
.hxev-close { background:none; border:none; color:#555; font-size:1.4em; cursor:pointer; padding:2px 7px; transition:color 0.15s; }
.hxev-close:hover { color:#ccc; }

/* ── Layout: 3 paneles + cola ── */
.hxev-body { flex:1; display:grid; grid-template-columns:1fr 1fr 1fr 260px; overflow:hidden; }
.hxev-panel { display:flex; flex-direction:column; border-right:1px solid rgba(255,255,255,0.05); overflow:hidden; }
.hxev-panel:last-child { border-right:none; }
.hxev-panel-title { font-size:0.52em; letter-spacing:2px; text-transform:uppercase; color:#666; padding:7px 10px 5px; font-weight:700; border-bottom:1px solid rgba(255,255,255,0.05); flex-shrink:0; }
.hxev-panel-tabs { display:flex; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
.hxev-ptab { flex:1; font-size:0.58em; padding:6px 3px; background:none; border:none; color:#555; cursor:pointer; border-bottom:2px solid transparent; transition:all 0.13s; font-family:inherit; text-transform:uppercase; letter-spacing:0.5px; }
.hxev-ptab:hover { color:#bbb; }
.hxev-ptab.on { color:#b080e0; border-bottom-color:#b080e0; }

/* ── Stats panel ── */
.hxev-stats-body { flex:1; overflow-y:auto; padding:8px 10px; scrollbar-width:thin; }
.hxev-stat-block { margin-bottom:14px; }
.hxev-stat-label { font-size:0.58em; letter-spacing:1px; text-transform:uppercase; color:#888; margin-bottom:5px; font-weight:700; }
.hxev-stat-val { font-size:1.3em; font-weight:700; color:#d4af37; font-family:'Cinzel',serif; text-align:center; margin-bottom:5px; }
.hxev-stat-btns { display:flex; gap:3px; flex-wrap:wrap; justify-content:center; }
.hxev-stat-btn { font-size:0.64em; padding:4px 8px; border-radius:5px; cursor:pointer; border:1px solid; transition:background 0.12s; font-weight:600; }
.hxev-stat-btn.pos { background:rgba(62,207,110,0.08); border-color:rgba(62,207,110,0.3); color:#3ecf6e; }
.hxev-stat-btn.pos:hover { background:rgba(62,207,110,0.2); }
.hxev-stat-btn.neg { background:rgba(220,80,80,0.08); border-color:rgba(220,80,80,0.3); color:#e06060; }
.hxev-stat-btn.neg:hover { background:rgba(220,80,80,0.2); }
.hxev-stat-custom { display:flex; gap:4px; margin-top:5px; }
.hxev-stat-custom-input { flex:1; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.14); border-radius:4px; color:#fff; font-size:0.72em; padding:4px 7px; outline:none; font-family:inherit; text-align:center; }
.hxev-stat-custom-input::placeholder { color:#444; }
.hxev-stat-custom-btn { font-size:0.65em; padding:4px 8px; border-radius:4px; cursor:pointer; border:1px solid rgba(140,90,220,0.35); background:rgba(140,90,220,0.1); color:#b080e0; transition:background 0.12s; }
.hxev-stat-custom-btn:hover { background:rgba(140,90,220,0.22); }
.hxev-stat-divider { border:none; border-top:1px solid rgba(255,255,255,0.05); margin:10px 0; }

/* ── Hechizos y objetos panel ── */
.hxev-list-search { margin:6px 8px 4px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:5px; color:#fff; font-size:0.7em; padding:5px 8px; outline:none; font-family:inherit; width:calc(100% - 16px); box-sizing:border-box; }
.hxev-list-search::placeholder { color:#444; }
.hxev-list-body { flex:1; overflow-y:auto; padding:3px 6px 8px; scrollbar-width:thin; }
.hxev-list-item { display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:5px; border:1px solid transparent; margin-bottom:3px; cursor:pointer; transition:background 0.12s; }
.hxev-list-item:hover { background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.09); }
.hxev-list-item.es-estado { border-left:2px solid rgba(80,200,140,0.5); }
.hxev-list-item.en-inv { border-left:2px solid rgba(212,175,55,0.4); }
.hxev-list-item-nombre { font-size:0.72em; color:#eee; flex:1; line-height:1.2; }
.hxev-list-item-sub { font-size:0.58em; color:#666; }
.hxev-list-item-badge { font-size:0.48em; padding:1px 5px; border-radius:3px; }
.hxev-badge-estado { background:rgba(80,200,140,0.15); color:#50c88c; border:1px solid rgba(80,200,140,0.3); }
.hxev-badge-inv { background:rgba(212,175,55,0.12); color:#d4af37; border:1px solid rgba(212,175,55,0.25); }
.hxev-list-item-cost { font-size:0.63em; color:#888; flex-shrink:0; }
.hxev-list-add { font-size:0.75em; color:#b080e0; cursor:pointer; padding:2px 5px; border-radius:3px; flex-shrink:0; transition:color 0.12s; }
.hxev-list-add:hover { color:#d4af37; }
.hxev-list-del { font-size:0.75em; color:#555; cursor:pointer; padding:2px 5px; border-radius:3px; flex-shrink:0; transition:color 0.12s; }
.hxev-list-del:hover { color:#e05050; }
.hxev-list-empty { font-size:0.68em; color:#444; text-align:center; padding:20px 8px; }
.hxev-sec-label { font-size:0.52em; letter-spacing:1.5px; text-transform:uppercase; color:#555; padding:8px 8px 3px; font-weight:700; }

/* ── Cola de eventos ── */
.hxev-cola { display:flex; flex-direction:column; overflow:hidden; }
.hxev-cola-header { padding:8px 10px 5px; border-bottom:1px solid rgba(255,255,255,0.06); flex-shrink:0; }
.hxev-cola-title { font-size:0.54em; letter-spacing:1.5px; text-transform:uppercase; color:#888; font-weight:700; }
.hxev-cola-count { font-size:0.54em; color:#b080e0; margin-left:5px; }
.hxev-cola-list { flex:1; overflow-y:auto; padding:4px 6px; scrollbar-width:thin; }
.hxev-cola-item { background:rgba(140,90,220,0.07); border:1px solid rgba(140,90,220,0.2); border-radius:5px; padding:6px 8px; margin-bottom:4px; position:relative; }
.hxev-cola-item-tipo { font-size:0.48em; letter-spacing:1px; text-transform:uppercase; color:#b080e0; margin-bottom:2px; font-weight:700; }
.hxev-cola-item-texto { font-size:0.68em; color:#ddd; line-height:1.35; }
.hxev-cola-item-del { position:absolute; top:4px; right:5px; background:none; border:none; color:#333; font-size:0.75em; cursor:pointer; padding:1px 4px; transition:color 0.12s; }
.hxev-cola-item-del:hover { color:#e05050; }
.hxev-cola-empty { font-size:0.65em; color:#333; text-align:center; padding:20px 8px; line-height:1.9; }
.hxev-cola-footer { padding:10px 8px; border-top:1px solid rgba(255,255,255,0.06); flex-shrink:0; display:flex; flex-direction:column; gap:6px; }
.hxev-btn-aplicar { background:rgba(140,90,220,0.18); border:1px solid rgba(140,90,220,0.5); color:#c8a0f0; font-size:0.72em; font-family:'Cinzel',serif; letter-spacing:0.8px; padding:8px 12px; border-radius:6px; cursor:pointer; transition:background 0.15s; width:100%; }
.hxev-btn-aplicar:hover { background:rgba(140,90,220,0.32); }
.hxev-btn-aplicar:disabled { opacity:0.35; cursor:default; }
.hxev-btn-limpiar { background:none; border:1px solid rgba(255,255,255,0.1); color:#555; font-size:0.62em; padding:5px 10px; border-radius:5px; cursor:pointer; font-family:inherit; transition:color 0.12s; }
.hxev-btn-limpiar:hover { color:#bbb; }
.hxev-cola-nota { font-size:0.6em; color:#333; text-align:center; line-height:1.5; }
`;
  document.head.appendChild(st);
}

// ── Helpers ────────────────────────────────────────────────────
const _norm = (s) => s ? s.toString().trim().toLowerCase()
  .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
  .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
  .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';

function _toast(msg, err = false) {
  let el = document.getElementById('hxc-toast');
  if (!el) { el = document.createElement('div'); el.id = 'hxc-toast'; el.className = 'hxc-toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.style.borderColor = err ? 'rgba(220,80,80,0.4)' : 'rgba(140,90,220,0.4)';
  el.style.color = err ? '#e07070' : '#c8a0f0';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

// Etiqueta legible del tipo de cambio
function _tipoLabel(tipo) {
  return {
    stat:        'Modificación de stat',
    hechizo_add: 'Hechizo aprendido',
    hechizo_rem: 'Hechizo olvidado',
    obj_add:     'Objeto obtenido',
    obj_rem:     'Objeto retirado',
    obj_equip:   'Objeto equipado',
  }[tipo] || 'Evento';
}

// ── Montaje del DOM ────────────────────────────────────────────
function _montar() {
  if (document.getElementById('hxev-root')) return;
  _css();
  const overlay = document.createElement('div');
  overlay.id = 'hxev-overlay';
  overlay.onclick = () => cerrarEventoPanel();
  document.body.appendChild(overlay);

  const root = document.createElement('div');
  root.id = 'hxev-root';
  document.body.appendChild(root);
}

// ── Render principal ──────────────────────────────────────────
function _render() {
  const root = document.getElementById('hxev-root');
  if (!root) return;
  const p = personajes[evState.pjNombre];
  const s = p ? calcularStats(p) : null;

  root.innerHTML = `
    <div class="hxev-header">
      <span class="hxev-header-title">✦ Evento</span>
      <span class="hxev-header-pj">${evState.pjNombre || '—'}</span>
      <span class="hxev-header-sub">Los cambios se aplicarán al confirmar</span>
      <button class="hxev-close" onclick="window._hxevCerrar()">×</button>
    </div>
    <div class="hxev-body">
      ${_renderPanelStats(p, s)}
      ${_renderPanelHechizos()}
      ${_renderPanelObjetos()}
      ${_renderCola()}
    </div>`;
}

// ── Panel 1: Stats ─────────────────────────────────────────────
function _renderPanelStats(p, s) {
  if (!p || !s) return `<div class="hxev-panel"><div class="hxev-panel-title">Stats</div><div class="hxev-stats-body"><div class="hxev-list-empty">Sin personaje</div></div></div>`;

  const safe = evState.pjNombre.replace(/'/g, "\\'");

  // Estadísticas editables
  const stats = [
    { label: 'Vida Roja', campo: 'vida_roja_actual', val: p.vida_roja_actual ?? 0, max: s.vida_roja_max, deltas: [1, 3, 5, 10], color: '#e06060' },
    { label: 'Vida Azul', campo: 'vida_azul_actual', val: p.vida_azul_actual ?? 0, max: s.vida_azul_max, deltas: [1, 3, 5], color: '#4ab3e8' },
    { label: 'Guarda Dorada', campo: 'guarda_actual', val: p.guarda_actual ?? 0, max: s.guarda_max, deltas: [1, 3, 5], color: '#d4af37' },
    { label: 'VEX', campo: 'vex_actual', val: p.vex_actual ?? 0, max: s.vex_max, deltas: [50, 100, 200], color: '#9060c0' },
    { label: 'HEX', campo: 'hex', val: p.hex ?? 0, max: null, deltas: [100, 500, 1000], color: '#d4af37' },
  ];

  const afins = [
    { label: 'Física', key: 'fisica' }, { label: 'Energética', key: 'energetica' },
    { label: 'Espiritual', key: 'espiritual' }, { label: 'Mando', key: 'mando' },
    { label: 'Psíquica', key: 'psiquica' }, { label: 'Oscura', key: 'oscura' },
  ];

  const statsHtml = stats.map(st => {
    const maxStr = st.max != null ? ` / ${st.max}` : '';
    const btnsPos = st.deltas.map(d =>
      `<button class="hxev-stat-btn pos" onclick="window._hxevQueueStat('${safe}','${st.campo}',+${d},'+${d} ${st.label}')">+${d}</button>`
    ).join('');
    const btnsNeg = st.deltas.map(d =>
      `<button class="hxev-stat-btn neg" onclick="window._hxevQueueStat('${safe}','${st.campo}',-${d},'-${d} ${st.label}')">-${d}</button>`
    ).join('');
    return `
      <div class="hxev-stat-block">
        <div class="hxev-stat-label">${st.label}</div>
        <div class="hxev-stat-val" style="color:${st.color};">${(st.val).toLocaleString()}${maxStr}</div>
        <div class="hxev-stat-btns">${btnsNeg}${btnsPos}</div>
        <div class="hxev-stat-custom">
          <input class="hxev-stat-custom-input" id="hxev-custom-${st.campo}" type="number" placeholder="custom">
          <button class="hxev-stat-custom-btn" onclick="window._hxevQueueStatCustom('${safe}','${st.campo}','${st.label}')">✓</button>
        </div>
      </div>`;
  }).join('<hr class="hxev-stat-divider">');

  const afinsHtml = `
    <div class="hxev-stat-label" style="margin-top:12px;">Afinidades (base)</div>
    ${afins.map(a => {
      const val = (p.afin_base || {})[a.key] || 0;
      return `<div class="hxev-stat-block" style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
          <span style="font-size:0.68em;color:#aaa;">${a.label}</span>
          <span style="font-size:0.75em;font-weight:700;color:#d4af37;font-family:'Cinzel',serif;">${val}</span>
        </div>
        <div class="hxev-stat-btns">
          <button class="hxev-stat-btn neg" onclick="window._hxevQueueAfin('${safe}','${a.key}',-1,'${a.label} -1')">-1</button>
          <button class="hxev-stat-btn neg" onclick="window._hxevQueueAfin('${safe}','${a.key}',-5,'${a.label} -5')">-5</button>
          <button class="hxev-stat-btn pos" onclick="window._hxevQueueAfin('${safe}','${a.key}',+1,'${a.label} +1')">+1</button>
          <button class="hxev-stat-btn pos" onclick="window._hxevQueueAfin('${safe}','${a.key}',+5,'${a.label} +5')">+5</button>
        </div>
      </div>`;
    }).join('')}`;

  return `<div class="hxev-panel">
    <div class="hxev-panel-title">Stats</div>
    <div class="hxev-stats-body">${statsHtml}${afinsHtml}</div>
  </div>`;
}

// ── Panel 2: Hechizos ──────────────────────────────────────────
function _renderPanelHechizos() {
  const busq = evState.busqueda.toLowerCase();
  const inv  = evState.inventarioHz;
  const invIds = new Set(inv.map(h => h.hechizo_nombre));
  const cat  = evState.catalogoHechizos.filter(h =>
    !busq || (h.nombre||'').toLowerCase().includes(busq) || (h.afinidad||'').toLowerCase().includes(busq)
  );
  const safe = evState.pjNombre?.replace(/'/g, "\\'");

  const invRows = inv.length > 0
    ? inv.map(h => `
      <div class="hxev-list-item en-inv">
        <div style="flex:1;min-width:0;">
          <div class="hxev-list-item-nombre">${h.hechizo_nombre}</div>
          <div class="hxev-list-item-sub">${h.hechizo_afinidad||'—'}</div>
        </div>
        <span class="hxev-list-del" title="Quitar hechizo" onclick="window._hxevQueueHzRem('${safe}','${(h.hechizo_nombre||'').replace(/'/g,"\\'")}')">✕</span>
      </div>`)
    .join('')
    : `<div class="hxev-list-empty">Sin hechizos</div>`;

  const catRows = cat.length > 0
    ? cat.map(h => {
        const yaTiene = invIds.has(h.nombre);
        const estadoBadge = h.es_estado ? `<span class="hxev-list-item-badge hxev-badge-estado">estado</span>` : '';
        const invBadge = yaTiene ? `<span class="hxev-list-item-badge hxev-badge-inv">✓ aprendido</span>` : '';
        return `<div class="hxev-list-item ${h.es_estado?'es-estado':''}">
          <div style="flex:1;min-width:0;">
            <div class="hxev-list-item-nombre">${h.nombre} ${estadoBadge}${invBadge}</div>
            <div class="hxev-list-item-sub">${h.afinidad||'—'} · ${h.hex_cost||0} HEX</div>
          </div>
          ${!yaTiene
            ? `<span class="hxev-list-add" title="Agregar hechizo" onclick="window._hxevQueueHzAdd('${safe}','${(h.nombre||'').replace(/'/g,"\\'")}','${h.hechizo_id}','${h.afinidad||''}')">+</span>`
            : `<span style="font-size:0.65em;color:#3a3a55;">✓</span>`
          }
        </div>`;
      }).join('')
    : `<div class="hxev-list-empty">Sin resultados</div>`;

  return `<div class="hxev-panel">
    <div class="hxev-panel-title">Hechizos</div>
    <input class="hxev-list-search" placeholder="Buscar hechizo..." value="${evState.busqueda}"
      oninput="window._hxevBuscar(this.value)" onclick="event.stopPropagation()">
    <div class="hxev-list-body">
      <div class="hxev-sec-label">En inventario</div>
      ${invRows}
      <div class="hxev-sec-label" style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.05);padding-top:8px;">Catálogo</div>
      ${catRows}
    </div>
  </div>`;
}

// ── Panel 3: Objetos ───────────────────────────────────────────
function _renderPanelObjetos() {
  const busq = evState.busqueda.toLowerCase();
  const inv  = evState.inventarioObj;
  const invNombres = new Set(inv.map(o => o.objeto_nombre));
  const cat  = evState.catalogoObjetos.filter(o =>
    !busq || (o.nombre||'').toLowerCase().includes(busq) || (o.tipo||'').toLowerCase().includes(busq)
  );
  const safe = evState.pjNombre?.replace(/'/g, "\\'");

  const invRows = inv.length > 0
    ? inv.map(o => `
      <div class="hxev-list-item en-inv">
        <div style="flex:1;min-width:0;">
          <div class="hxev-list-item-nombre">${o.objeto_nombre}</div>
          <div class="hxev-list-item-sub">×${o.cantidad} ${o.equipado?'· equipado':''}</div>
        </div>
        ${!o.equipado
          ? `<span class="hxev-list-add" title="Equipar" onclick="window._hxevQueueObjEquip('${safe}','${(o.objeto_nombre||'').replace(/'/g,"\\'")}',${o.id})">⚔</span>`
          : `<span style="font-size:0.65em;color:#d4af37;">⚔</span>`}
        <span class="hxev-list-del" title="Retirar objeto" onclick="window._hxevQueueObjRem('${safe}','${(o.objeto_nombre||'').replace(/'/g,"\\'")}',${o.id})">✕</span>
      </div>`)
    .join('')
    : `<div class="hxev-list-empty">Sin objetos</div>`;

  const catRows = cat.length > 0
    ? cat.map(o => {
        const yaT = invNombres.has(o.nombre);
        return `<div class="hxev-list-item">
          <div style="flex:1;min-width:0;">
            <div class="hxev-list-item-nombre">${o.nombre}</div>
            <div class="hxev-list-item-sub">${o.tipo||'—'} ${o.rareza?'· '+o.rareza:''}</div>
          </div>
          ${!yaT
            ? `<span class="hxev-list-add" title="Dar objeto" onclick="window._hxevQueueObjAdd('${safe}','${(o.nombre||'').replace(/'/g,"\\'")}')">+</span>`
            : `<span class="hxev-list-add" onclick="window._hxevQueueObjAdd('${safe}','${(o.nombre||'').replace(/'/g,"\\'")}')">+1</span>`}
        </div>`;
      }).join('')
    : `<div class="hxev-list-empty">Sin resultados</div>`;

  return `<div class="hxev-panel">
    <div class="hxev-panel-title">Objetos</div>
    <input class="hxev-list-search" placeholder="Buscar objeto..." value="${evState.busqueda}"
      oninput="window._hxevBuscar(this.value)" onclick="event.stopPropagation()">
    <div class="hxev-list-body">
      <div class="hxev-sec-label">En inventario</div>
      ${invRows}
      <div class="hxev-sec-label" style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.05);padding-top:8px;">Catálogo</div>
      ${catRows}
    </div>
  </div>`;
}

// ── Panel 4: Cola de eventos ───────────────────────────────────
function _renderCola() {
  const cola = evState.cola;
  const items = cola.length > 0
    ? cola.map((ev, i) => `
      <div class="hxev-cola-item">
        <div class="hxev-cola-item-tipo">${_tipoLabel(ev.tipo)}</div>
        <div class="hxev-cola-item-texto">${ev.resumen}</div>
        <button class="hxev-cola-item-del" onclick="window._hxevQueueRemover(${i})">×</button>
      </div>`)
    .join('')
    : `<div class="hxev-cola-empty">Sin cambios pendientes.<br>Selecciona stats, hechizos u objetos.</div>`;

  return `<div class="hxev-panel hxev-cola">
    <div class="hxev-cola-header">
      <span class="hxev-cola-title">Cola de cambios</span>
      <span class="hxev-cola-count">${cola.length > 0 ? cola.length + ' pendientes' : ''}</span>
    </div>
    <div class="hxev-cola-list">${items}</div>
    <div class="hxev-cola-footer">
      <button class="hxev-btn-aplicar" onclick="window._hxevAplicar()" ${cola.length===0?'disabled':''}>
        ✦ Aplicar eventos
      </button>
      ${cola.length > 0
        ? `<button class="hxev-btn-limpiar" onclick="window._hxevLimpiarCola()">Limpiar todo</button>`
        : ''}
      <div class="hxev-cola-nota">Los cambios se aplican al PJ<br>y quedan registrados como evento en el turno</div>
    </div>
  </div>`;
}

// ── Carga de datos ─────────────────────────────────────────────
async function _cargarDatos(nombre) {
  const [hzCat, hzInv, objCat, objInv] = await Promise.all([
    supabase.from('hechizos_nodos').select('hechizo_id,nombre,afinidad,hex_cost,es_estado').order('nombre'),
    supabase.from('hechizos_inventario').select('hechizo_nombre,hechizo_afinidad,hechizo_hex').eq('personaje_nombre', nombre),
    supabase.from('objetos').select('nombre,tipo,rareza,material,efecto').eq('es_propuesta', false).order('nombre'),
    supabase.from('inventario_objetos').select('id,objeto_nombre,cantidad,equipado').eq('personaje_nombre', nombre).gt('cantidad', 0),
  ]);
  evState.catalogoHechizos = hzCat.data || [];
  evState.inventarioHz     = hzInv.data || [];
  evState.catalogoObjetos  = objCat.data || [];
  evState.inventarioObj    = objInv.data || [];
}

// ── Apertura / cierre ──────────────────────────────────────────
export async function abrirEventoPanel(pjNombre) {
  _montar();
  evState.pjNombre = pjNombre;
  evState.cola = [];
  evState.busqueda = '';
  await _cargarDatos(pjNombre);
  document.getElementById('hxev-overlay')?.classList.add('open');
  document.getElementById('hxev-root')?.classList.add('open');
  _render();
}

export function cerrarEventoPanel() {
  document.getElementById('hxev-overlay')?.classList.remove('open');
  document.getElementById('hxev-root')?.classList.remove('open');
}

// ── Handlers globales ──────────────────────────────────────────
window._hxevCerrar = cerrarEventoPanel;
window._hxevBuscar = (val) => { evState.busqueda = val; _render(); };

window._hxevQueueRemover = (idx) => {
  evState.cola.splice(idx, 1);
  _render();
};
window._hxevLimpiarCola = () => { evState.cola = []; _render(); };

// ── Agregar a cola: stat ───────────────────────────────────────
window._hxevQueueStat = (nombre, campo, delta, resumen) => {
  evState.cola.push({ tipo: 'stat', campo, delta, pjNombre: nombre, resumen: `${resumen} (${nombre})` });
  _render();
};

window._hxevQueueStatCustom = (nombre, campo, label) => {
  const inp = document.getElementById(`hxev-custom-${campo}`);
  const val = parseInt(inp?.value);
  if (!val || isNaN(val)) { _toast('Ingresa un número', true); return; }
  evState.cola.push({ tipo: 'stat', campo, delta: val, pjNombre: nombre, resumen: `${label} ${val > 0 ? '+' : ''}${val} (${nombre})` });
  if (inp) inp.value = '';
  _render();
};

window._hxevQueueAfin = (nombre, afinKey, delta, resumen) => {
  evState.cola.push({ tipo: 'afin', afinKey, delta, pjNombre: nombre, resumen: `Afinidad ${resumen} (${nombre})` });
  _render();
};

// ── Agregar a cola: hechizos ───────────────────────────────────
window._hxevQueueHzAdd = (nombre, hzNombre, hzId, afinidad) => {
  const ya = evState.cola.find(e => e.tipo === 'hechizo_add' && e.hzNombre === hzNombre && e.pjNombre === nombre);
  if (ya) { _toast('Ya está en la cola', true); return; }
  evState.cola.push({ tipo: 'hechizo_add', pjNombre: nombre, hzNombre, hzId, afinidad, resumen: `Hechizo aprendido: ${hzNombre} (${nombre})` });
  _render();
};

window._hxevQueueHzRem = (nombre, hzNombre) => {
  const ya = evState.cola.find(e => e.tipo === 'hechizo_rem' && e.hzNombre === hzNombre && e.pjNombre === nombre);
  if (ya) { _toast('Ya está en la cola', true); return; }
  evState.cola.push({ tipo: 'hechizo_rem', pjNombre: nombre, hzNombre, resumen: `Hechizo olvidado: ${hzNombre} (${nombre})` });
  _render();
};

// ── Agregar a cola: objetos ────────────────────────────────────
window._hxevQueueObjAdd = (nombre, objNombre) => {
  evState.cola.push({ tipo: 'obj_add', pjNombre: nombre, objNombre, resumen: `Objeto obtenido: ${objNombre} (${nombre})` });
  _render();
};

window._hxevQueueObjRem = (nombre, objNombre, slotId) => {
  const ya = evState.cola.find(e => e.tipo === 'obj_rem' && e.slotId === slotId);
  if (ya) { _toast('Ya está en la cola', true); return; }
  evState.cola.push({ tipo: 'obj_rem', pjNombre: nombre, objNombre, slotId, resumen: `Objeto retirado: ${objNombre} (${nombre})` });
  _render();
};

window._hxevQueueObjEquip = (nombre, objNombre, slotId) => {
  evState.cola.push({ tipo: 'obj_equip', pjNombre: nombre, objNombre, slotId, resumen: `Objeto equipado: ${objNombre} (${nombre})` });
  _render();
};

// ── APLICAR todos los eventos de la cola ──────────────────────
window._hxevAplicar = async () => {
  const cola = [...evState.cola];
  if (!cola.length) return;

  const errores = [];
  const resumenesAplicados = [];

  for (const ev of cola) {
    try {
      if (ev.tipo === 'stat') {
        const p = personajes[ev.pjNombre];
        if (p) {
          const s = calcularStats(p);
          const caps = { vex_actual: s.vex_max, vida_azul_actual: s.vida_azul_max, guarda_actual: s.guarda_max };
          const max = caps[ev.campo] ?? Infinity;
          p[ev.campo] = Math.max(0, Math.min(max, (p[ev.campo] || 0) + ev.delta));
          await persistirCampos(ev.pjNombre, { [ev.campo]: p[ev.campo] });
        }

      } else if (ev.tipo === 'afin') {
        const p = personajes[ev.pjNombre];
        if (p) {
          if (!p.afin_base) p.afin_base = {};
          p.afin_base[ev.afinKey] = Math.max(0, (p.afin_base[ev.afinKey] || 0) + ev.delta);
          if (!p.afinidadesBase) p.afinidadesBase = {};
          p.afinidadesBase[ev.afinKey] = p.afin_base[ev.afinKey];
          await persistirCampos(ev.pjNombre, { afin_base: { ...p.afin_base } });
        }

      } else if (ev.tipo === 'hechizo_add') {
        const { error } = await supabase.from('hechizos_inventario').insert({
          personaje_nombre: ev.pjNombre,
          hechizo_nombre:   ev.hzNombre,
          hechizo_afinidad: ev.afinidad || '',
          hechizo_hex:      0,
          tipo:             'Normal',
          origen:           'HexCast Evento'
        });
        if (error) errores.push(`Hz ${ev.hzNombre}: ${error.message}`);

      } else if (ev.tipo === 'hechizo_rem') {
        const { error } = await supabase.from('hechizos_inventario')
          .delete()
          .eq('personaje_nombre', ev.pjNombre)
          .eq('hechizo_nombre', ev.hzNombre);
        if (error) errores.push(`Quitar Hz ${ev.hzNombre}: ${error.message}`);

      } else if (ev.tipo === 'obj_add') {
        const { data: exist } = await supabase.from('inventario_objetos')
          .select('id,cantidad').eq('personaje_nombre', ev.pjNombre).eq('objeto_nombre', ev.objNombre).single();
        if (exist) {
          await supabase.from('inventario_objetos').update({ cantidad: exist.cantidad + 1 }).eq('id', exist.id);
        } else {
          await supabase.from('inventario_objetos').insert({ personaje_nombre: ev.pjNombre, objeto_nombre: ev.objNombre, cantidad: 1, equipado: false });
        }

      } else if (ev.tipo === 'obj_rem') {
        const { data: slot } = await supabase.from('inventario_objetos').select('cantidad').eq('id', ev.slotId).single();
        if (slot) {
          if (slot.cantidad <= 1) await supabase.from('inventario_objetos').delete().eq('id', ev.slotId);
          else await supabase.from('inventario_objetos').update({ cantidad: slot.cantidad - 1 }).eq('id', ev.slotId);
        }

      } else if (ev.tipo === 'obj_equip') {
        await supabase.from('inventario_objetos').update({ equipado: true }).eq('id', ev.slotId);
      }

      resumenesAplicados.push(ev.resumen);

    } catch(e) {
      errores.push(ev.resumen + ': ' + e.message);
    }
  }

  // Construir bloque de evento para el stack de HexCast
  if (resumenesAplicados.length > 0 && hxState.turnoActivo) {
    const panelSlot = hxState.panelSlot;
    const grupo = panelSlot?.grupo || 'A';
    const idx   = panelSlot?.idx   || 0;
    const { SLOT_COLORS } = await import('./hexcast-state.js');
    const color = SLOT_COLORS[grupo]?.[idx] || SLOT_COLORS.A[0];

    // Agrupar resúmenes por tipo para el bloque del stack
    const porTipo = {};
    for (const ev of cola) {
      if (!porTipo[ev.tipo]) porTipo[ev.tipo] = [];
      porTipo[ev.tipo].push(ev);
    }
    const resumenBloque = Object.entries(porTipo).map(([tipo, evs]) => {
      const label = _tipoLabel(tipo);
      const nombres = evs.map(e => e.hzNombre || e.objNombre || (e.delta > 0 ? `+${e.delta} ${e.campo}` : `${e.delta} ${e.campo}`));
      return `${label}: ${nombres.join(', ')}`;
    }).join(' | ');

    hxState.stack.push({
      id: 'ev_' + Date.now(),
      tipoItem: 'evento',
      pjNombre: evState.pjNombre,
      grupo, slotIdx: idx, color,
      eventoTipo: 'aplicado',
      eventoNombre: resumenBloque,
      eventoDesc: resumenesAplicados.join('\n'),
      abierto: false,
      _eventosAplicados: cola,
    });
  }

  if (errores.length) {
    _toast('Errores: ' + errores[0], true);
  } else {
    _toast(`✦ ${resumenesAplicados.length} cambio(s) aplicados`);
  }

  // Recargar datos y limpiar cola
  evState.cola = [];
  await _cargarDatos(evState.pjNombre);

  // Refrescar panel de personajes si está visible
  if (typeof window.refreshPanelPJ === 'function') window.refreshPanelPJ();
  if (typeof window.renderCatalogo === 'function') window.renderCatalogo();

  // Refrescar el panel hexcast
  if (typeof window._hxcRender === 'function') window._hxcRender();

  _render();
};
