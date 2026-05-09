// ============================================================
// panel-hexcast-evento.js — Panel de construcción de eventos HexCast
// 3 paneles (stats, hechizos, objetos) + nombre + "Guardar evento".
// El bloque se guarda en hxState.stack con su _payload para que
// panel-hexcast.js lo aplique/revierta con los botones correspondientes.
// ============================================================

import { supabase } from '../hex-auth.js';
import { personajes } from './personajes-state.js';
import { calcularStats } from './personajes-logic.js';
import { persistirCampos } from './personajes-data.js';
import { hxState, SLOT_COLORS } from './hexcast-state.js';

// ── Estado local ──────────────────────────────────────────────
const evState = {
  pjNombre: null,
  grupo: 'A', idx: 0,
  busqueda: '',
  cambios: [],          // [{ tipo, ...datos }]  — seleccionados antes de guardar
  catalogoHechizos: [],
  inventarioHz: [],
  catalogoObjetos: [],
  inventarioObj: [],
};

// ── CSS ───────────────────────────────────────────────────────
function _css() {
  if (document.getElementById('hxev-styles')) return;
  const st = document.createElement('style');
  st.id = 'hxev-styles';
  st.textContent = `
#hxev-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1400; opacity:0; pointer-events:none; transition:opacity 0.22s; }
#hxev-overlay.open { opacity:1; pointer-events:all; }
#hxev-root { position:fixed; top:0; right:0; bottom:0; width:880px; max-width:98vw; background:#07060e; border-left:1px solid rgba(140,90,220,0.25); z-index:1401; display:flex; flex-direction:column; transform:translateX(100%); transition:transform 0.28s cubic-bezier(0.4,0,0.2,1); font-family:'Inter',system-ui,sans-serif; box-shadow:-12px 0 50px rgba(0,0,0,0.7); }
#hxev-root.open { transform:translateX(0); }

.hxev-header { display:flex; align-items:center; gap:10px; padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.07); flex-shrink:0; background:#09081a; }
.hxev-header-title { font-family:'Cinzel',serif; font-size:0.8em; color:#b080e0; letter-spacing:2px; text-transform:uppercase; }
.hxev-header-pj { font-size:0.78em; color:#fff; font-weight:600; flex:1; }
.hxev-close { background:none; border:none; color:#555; font-size:1.4em; cursor:pointer; padding:2px 7px; transition:color 0.15s; }
.hxev-close:hover { color:#ccc; }

.hxev-body { flex:1; display:grid; grid-template-columns:1fr 1fr 1fr; overflow:hidden; }
.hxev-panel { display:flex; flex-direction:column; border-right:1px solid rgba(255,255,255,0.05); overflow:hidden; }
.hxev-panel:last-child { border-right:none; }
.hxev-panel-title { font-size:0.52em; letter-spacing:2px; text-transform:uppercase; color:#888; padding:7px 10px 5px; font-weight:700; border-bottom:1px solid rgba(255,255,255,0.05); flex-shrink:0; }

.hxev-stats-body { flex:1; overflow-y:auto; padding:6px 10px 8px; scrollbar-width:thin; }
.hxev-stat-block { margin-bottom:12px; }
.hxev-stat-label { font-size:0.56em; letter-spacing:1px; text-transform:uppercase; color:#888; margin-bottom:4px; font-weight:700; }
.hxev-stat-val { font-size:1.1em; font-weight:700; font-family:'Cinzel',serif; text-align:center; margin-bottom:4px; }
.hxev-stat-btns { display:flex; gap:3px; flex-wrap:wrap; justify-content:center; }
.hxev-stat-btn { font-size:0.62em; padding:3px 7px; border-radius:4px; cursor:pointer; border:1px solid; transition:background 0.12s; font-weight:600; }
.hxev-stat-btn.pos { background:rgba(62,207,110,0.08); border-color:rgba(62,207,110,0.3); color:#3ecf6e; }
.hxev-stat-btn.pos:hover { background:rgba(62,207,110,0.2); }
.hxev-stat-btn.neg { background:rgba(220,80,80,0.08); border-color:rgba(220,80,80,0.3); color:#e06060; }
.hxev-stat-btn.neg:hover { background:rgba(220,80,80,0.2); }
.hxev-stat-custom { display:flex; gap:4px; margin-top:4px; }
.hxev-stat-custom-input { flex:1; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.14); border-radius:4px; color:#fff; font-size:0.7em; padding:3px 7px; outline:none; font-family:inherit; text-align:center; }
.hxev-stat-custom-input::placeholder { color:#444; }
.hxev-stat-custom-btn { font-size:0.63em; padding:3px 8px; border-radius:4px; cursor:pointer; border:1px solid rgba(140,90,220,0.35); background:rgba(140,90,220,0.1); color:#b080e0; transition:background 0.12s; }
.hxev-stat-divider { border:none; border-top:1px solid rgba(255,255,255,0.05); margin:8px 0; }

.hxev-list-search { margin:5px 8px 3px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); border-radius:5px; color:#fff; font-size:0.7em; padding:5px 8px; outline:none; font-family:inherit; width:calc(100% - 16px); box-sizing:border-box; }
.hxev-list-search::placeholder { color:#444; }
.hxev-list-body { flex:1; overflow-y:auto; padding:3px 6px 8px; scrollbar-width:thin; }
.hxev-sec-label { font-size:0.5em; letter-spacing:1.5px; text-transform:uppercase; color:#555; padding:6px 4px 3px; font-weight:700; }
.hxev-list-item { display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:5px; border:1px solid transparent; margin-bottom:3px; }
.hxev-list-item-nombre { font-size:0.72em; color:#eee; flex:1; line-height:1.2; }
.hxev-list-item-sub { font-size:0.58em; color:#666; }
.hxev-list-item-efecto { font-size:0.57em; color:#555; margin-top:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:160px; }
.hxev-badge-estado { font-size:0.46em; padding:1px 5px; border-radius:3px; background:rgba(80,200,140,0.15); color:#50c88c; border:1px solid rgba(80,200,140,0.3); margin-left:3px; }
.hxev-badge-inv { font-size:0.46em; padding:1px 5px; border-radius:3px; background:rgba(212,175,55,0.12); color:#d4af37; border:1px solid rgba(212,175,55,0.25); margin-left:3px; }
.hxev-list-empty { font-size:0.68em; color:#444; text-align:center; padding:16px 8px; }

/* Hechizos — opciones de coste */
.hxev-hz-opts { display:flex; gap:3px; flex-wrap:wrap; margin-top:3px; }
.hxev-hz-opt { font-size:0.56em; padding:2px 7px; border-radius:3px; cursor:pointer; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.04); color:#888; transition:all 0.1s; white-space:nowrap; }
.hxev-hz-opt:hover { background:rgba(255,255,255,0.1); color:#ccc; }
.hxev-hz-opt.gratis   { border-color:rgba(62,207,110,0.4);  color:#3ecf6e; }
.hxev-hz-opt.gratis:hover   { background:rgba(62,207,110,0.15); }
.hxev-hz-opt.mitad    { border-color:rgba(212,175,55,0.4);  color:#d4af37; }
.hxev-hz-opt.mitad:hover    { background:rgba(212,175,55,0.15); }
.hxev-hz-opt.completo { border-color:rgba(232,100,60,0.4);  color:#e8643c; }
.hxev-hz-opt.completo:hover { background:rgba(232,100,60,0.15); }
.hxev-hz-opt.doble    { border-color:rgba(200,50,50,0.4);   color:#e05050; }
.hxev-hz-opt.doble:hover    { background:rgba(200,50,50,0.15); }

/* Objetos — cantidad */
.hxev-obj-add { display:flex; align-items:center; gap:3px; }
.hxev-obj-qty { width:32px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.14); border-radius:3px; color:#fff; font-size:0.7em; padding:2px 4px; text-align:center; outline:none; font-family:'Cinzel',serif; }
.hxev-obj-btn-add { font-size:0.65em; padding:2px 8px; border-radius:3px; cursor:pointer; border:1px solid rgba(140,90,220,0.4); background:rgba(140,90,220,0.1); color:#b080e0; transition:background 0.12s; }
.hxev-obj-btn-add:hover { background:rgba(140,90,220,0.22); }
.hxev-obj-btn-rem { font-size:0.65em; padding:2px 6px; border-radius:3px; cursor:pointer; border:1px solid rgba(220,80,80,0.3); background:rgba(220,80,80,0.06); color:#e06060; transition:background 0.12s; }
.hxev-obj-btn-rem:hover { background:rgba(220,80,80,0.18); }

/* Footer */
.hxev-footer { padding:10px 14px; border-top:1px solid rgba(255,255,255,0.07); flex-shrink:0; background:#09081a; display:flex; flex-direction:column; gap:7px; }
.hxev-footer-row { display:flex; gap:8px; align-items:center; }
.hxev-cambios-count { font-size:0.6em; color:#888; }
.hxev-cambios-count span { color:#b080e0; font-weight:700; }
.hxev-nombre-input { flex:1; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15); border-radius:5px; color:#fff; font-size:0.75em; padding:6px 10px; outline:none; font-family:inherit; }
.hxev-nombre-input::placeholder { color:#444; }
.hxev-nombre-input:focus { border-color:rgba(140,90,220,0.5); }
.hxev-btn-guardar { background:rgba(140,90,220,0.18); border:1px solid rgba(140,90,220,0.5); color:#c8a0f0; font-size:0.72em; font-family:'Cinzel',serif; letter-spacing:0.8px; padding:7px 16px; border-radius:6px; cursor:pointer; transition:background 0.15s; white-space:nowrap; }
.hxev-btn-guardar:hover { background:rgba(140,90,220,0.32); }
.hxev-btn-limpiar { background:none; border:1px solid rgba(255,255,255,0.1); color:#555; font-size:0.62em; padding:5px 10px; border-radius:5px; cursor:pointer; font-family:inherit; transition:color 0.12s; }
.hxev-btn-limpiar:hover { color:#bbb; }

/* Chips */
.hxev-chips { display:flex; flex-wrap:wrap; gap:4px; max-height:54px; overflow-y:auto; }
.hxev-chip { font-size:0.58em; padding:2px 7px; border-radius:10px; background:rgba(140,90,220,0.12); border:1px solid rgba(140,90,220,0.3); color:#c8a0f0; display:flex; align-items:center; gap:4px; }
.hxev-chip-del { cursor:pointer; color:#888; font-size:0.9em; }
.hxev-chip-del:hover { color:#e05050; }
`;
  document.head.appendChild(st);
}

// ── Toast ─────────────────────────────────────────────────────
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

// ── Montaje ───────────────────────────────────────────────────
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

// ── Preview helpers: aplica cambios pendientes al estado local para el render ──
function _previewStats(p) {
  if (!p) return p;
  // Clonar superficialmente para el preview
  const clone = { ...p,
    afin_base:  { ...p.afin_base },
    afin_extra: { ...p.afin_extra },
    afin_alter: { ...p.afin_alter },
  };
  for (const c of evState.cambios) {
    if (c.pjNombre !== evState.pjNombre) continue;
    if (c.tipo === 'stat') {
      clone[c.campo] = (clone[c.campo] ?? 0) + c.delta;
    } else if (c.tipo === 'afin') {
      if (!clone[c.afinLayer]) clone[c.afinLayer] = {};
      clone[c.afinLayer][c.afinKey] = (clone[c.afinLayer][c.afinKey] || 0) + c.delta;
    }
  }
  return clone;
}

function _previewInvHz() {
  // Inventario "virtual": copia con hz_add/hz_rem de cambios pendientes
  const base = evState.inventarioHz.map(h => ({ ...h }));
  const result = [...base];
  for (const c of evState.cambios) {
    if (c.pjNombre !== evState.pjNombre) continue;
    if (c.tipo === 'hz_add') {
      if (!result.find(h => h.hechizo_nombre === c.hzNombre)) {
        result.push({ hechizo_nombre: c.hzNombre, hechizo_afinidad: c.afinidad || '', hechizo_hex: 0, _pendiente: true });
      }
    } else if (c.tipo === 'hz_rem') {
      const idx = result.findIndex(h => h.hechizo_nombre === c.hzNombre);
      if (idx >= 0) result.splice(idx, 1);
    }
  }
  return result;
}

function _previewInvObj() {
  const base = evState.inventarioObj.map(o => ({ ...o }));
  const result = [...base];
  for (const c of evState.cambios) {
    if (c.pjNombre !== evState.pjNombre) continue;
    if (c.tipo === 'obj_add') {
      const ex = result.find(o => o.objeto_nombre === c.objNombre);
      if (ex) ex.cantidad += c.cantidad;
      else result.unshift({ id: null, objeto_nombre: c.objNombre, cantidad: c.cantidad, equipado: false, _pendiente: true });
    } else if (c.tipo === 'obj_rem') {
      const ex = result.find(o => o.objeto_nombre === c.objNombre);
      if (ex) { ex.cantidad -= c.cantidad; if (ex.cantidad <= 0) { const i = result.indexOf(ex); result.splice(i, 1); } }
    }
  }
  return result;
}

// ── Render ────────────────────────────────────────────────────
function _render() {
  const root = document.getElementById('hxev-root');
  if (!root) return;
  const pOrig = personajes[evState.pjNombre];
  const p = _previewStats(pOrig);
  const s = p ? calcularStats(p) : null;

  const chips = evState.cambios.map((c, i) =>
    `<span class="hxev-chip">${_cambioLabel(c)}<span class="hxev-chip-del" onclick="window._hxevQuitarCambio(${i})">x</span></span>`
  ).join('');

  root.innerHTML = `
    <div class="hxev-header">
      <span class="hxev-header-title">✦ Evento</span>
      <span class="hxev-header-pj">${evState.pjNombre || '—'}</span>
      <button class="hxev-close" onclick="window._hxevCerrar()">×</button>
    </div>
    <div class="hxev-body">
      ${_renderStats(p, s)}
      ${_renderHechizos()}
      ${_renderObjetos()}
    </div>
    <div class="hxev-footer">
      ${evState.cambios.length > 0 ? `<div class="hxev-chips">${chips}</div>` : ''}
      <div class="hxev-footer-row">
        <span class="hxev-cambios-count">${evState.cambios.length > 0
          ? `<span>${evState.cambios.length}</span> cambio(s) seleccionados`
          : 'Sin cambios seleccionados'}</span>
        ${evState.cambios.length > 0
          ? `<button class="hxev-btn-limpiar" onclick="window._hxevLimpiar()">✕ Limpiar</button>` : ''}
      </div>
      <div class="hxev-footer-row">
        <input class="hxev-nombre-input" id="hxev-nombre-evento"
          placeholder="Nombre del evento (ej: Agua de curación, Recompensa…)"
          onclick="event.stopPropagation()">
        <button class="hxev-btn-guardar" onclick="window._hxevGuardar()">✦ Guardar evento</button>
      </div>
    </div>`;
}

function _cambioLabel(c) {
  if (c.tipo === 'stat')    return c.label;
  if (c.tipo === 'afin')    return c.afinLabel;
  if (c.tipo === 'hz_add')  return `Hz: ${c.hzNombre}${c.costeHex > 0 ? ` (-${c.costeHex})` : ' (gratis)'}`;
  if (c.tipo === 'hz_rem')  return `-Hz: ${c.hzNombre}`;
  if (c.tipo === 'obj_add') return `${c.objNombre} x${c.cantidad}`;
  if (c.tipo === 'obj_rem') return `-${c.objNombre}`;
  return c.tipo;
}

// ── Panel Stats ───────────────────────────────────────────────
function _renderStats(p, s) {
  if (!p || !s) return `<div class="hxev-panel"><div class="hxev-panel-title">Stats</div>
    <div class="hxev-stats-body"><div class="hxev-list-empty">Sin personaje</div></div></div>`;

  const safe = evState.pjNombre.replace(/'/g, "\\'");

  // Helper para mostrar delta pendiente en stats
  function _pendienteDelta(campo) {
    const d = evState.cambios.filter(c => c.pjNombre === evState.pjNombre && c.tipo === 'stat' && c.campo === campo)
      .reduce((s, c) => s + c.delta, 0);
    if (!d) return '';
    return ` <span style="font-size:0.5em;color:${d>0?'#3ecf6e':'#e06060'};font-family:'Inter',sans-serif;">${d>0?'+':''}${d}</span>`;
  }

  // Bloque para stats con máximo (actual/max) + modificador del bonus manual de max
  function statBlockConMax(label, campoActual, actual, max, color, deltasActual, deltasMax, campoMaxOverride, maxOverride) {
    const posA = deltasActual.map(d =>
      `<button class="hxev-stat-btn pos" onclick="window._hxevAddStat('${safe}','${campoActual}',+${d},'${label} +${d}')">+${d}</button>`).join('');
    const negA = deltasActual.map(d =>
      `<button class="hxev-stat-btn neg" onclick="window._hxevAddStat('${safe}','${campoActual}',-${d},'${label} -${d}')">-${d}</button>`).join('');
    const posM = deltasMax.map(d =>
      `<button class="hxev-stat-btn pos" onclick="window._hxevAddStat('${safe}','${campoMaxOverride}',+${d},'Máx ${label} +${d}')">+${d}</button>`).join('');
    const negM = deltasMax.map(d =>
      `<button class="hxev-stat-btn neg" onclick="window._hxevAddStat('${safe}','${campoMaxOverride}',-${d},'Máx ${label} -${d}')">-${d}</button>`).join('');
    return `<div class="hxev-stat-block">
      <div class="hxev-stat-label">${label}</div>
      <div class="hxev-stat-val" style="color:${color};">${Number(actual).toLocaleString()}${_pendienteDelta(campoActual)}<span style="color:#444;font-size:0.6em;font-family:'Inter',sans-serif;"> / </span><span style="font-size:0.7em;color:#888;">${Number(max).toLocaleString()}${_pendienteDelta(campoMaxOverride)}</span></div>
      <div style="font-size:0.5em;letter-spacing:1px;color:#555;margin-bottom:2px;text-transform:uppercase;">Actual</div>
      <div class="hxev-stat-btns">${negA}${posA}</div>
      <div class="hxev-stat-custom">
        <input class="hxev-stat-custom-input" id="hxev-c-${campoActual}" type="number" placeholder="custom" onclick="event.stopPropagation()">
        <button class="hxev-stat-custom-btn" onclick="window._hxevAddStatCustom('${safe}','${campoActual}','${label}')">ok</button>
      </div>
      <div style="font-size:0.5em;letter-spacing:1px;color:#555;margin:6px 0 2px;text-transform:uppercase;">Máx manual${maxOverride!==0?` <span style="color:#d4af37;">(+${maxOverride})</span>`:''}</div>
      <div class="hxev-stat-btns">${negM}${posM}</div>
      <div class="hxev-stat-custom">
        <input class="hxev-stat-custom-input" id="hxev-c-${campoMaxOverride}" type="number" placeholder="custom" onclick="event.stopPropagation()">
        <button class="hxev-stat-custom-btn" onclick="window._hxevAddStatCustom('${safe}','${campoMaxOverride}','Máx ${label}')">ok</button>
      </div></div>`;
  }

  // Bloque simple para stats sin máximo (vida azul, hex)
  function statBlock(label, campo, val, color, deltas) {
    const pos = deltas.map(d =>
      `<button class="hxev-stat-btn pos" onclick="window._hxevAddStat('${safe}','${campo}',+${d},'${label} +${d}')">+${d}</button>`).join('');
    const neg = deltas.map(d =>
      `<button class="hxev-stat-btn neg" onclick="window._hxevAddStat('${safe}','${campo}',-${d},'${label} -${d}')">-${d}</button>`).join('');
    return `<div class="hxev-stat-block">
      <div class="hxev-stat-label">${label}</div>
      <div class="hxev-stat-val" style="color:${color};">${Number(val).toLocaleString()}${_pendienteDelta(campo)}</div>
      <div class="hxev-stat-btns">${neg}${pos}</div>
      <div class="hxev-stat-custom">
        <input class="hxev-stat-custom-input" id="hxev-c-${campo}" type="number" placeholder="custom" onclick="event.stopPropagation()">
        <button class="hxev-stat-custom-btn" onclick="window._hxevAddStatCustom('${safe}','${campo}','${label}')">ok</button>
      </div></div>`;
  }

  const vaTotal = (s.vida_azul_base || 0) + (p.vida_azul_actual ?? 0);
  const statsHtml = [
    statBlockConMax('Vida Roja', 'vida_roja_actual', p.vida_roja_actual ?? 0, s.vida_roja_max, '#e06060',
      [1,3,5,10], [1,3,5,10], 'vida_roja_max_override', s.vida_roja_max_override || 0),
    statBlock('Vida Azul', 'vida_azul_actual', vaTotal, '#4ab3e8', [1,3,5]),
    statBlockConMax('Guarda Dorada', 'guarda_actual', p.guarda_actual ?? 0, s.guarda_max, '#d4af37',
      [1,3,5], [1,3,5], 'guarda_max_override', s.guarda_max_override || 0),
    statBlockConMax('VEX', 'vex_actual', p.vex_actual ?? 0, s.vex_max, '#9060c0',
      [50,100,200], [50,100,200], 'vex_max_override', p.vex_max_override || 0),
    statBlock('HEX', 'hex', p.hex ?? 0, '#d4af37', [100,500,1000]),
  ].join('<hr class="hxev-stat-divider">');

  const AFINS = ['fisica','energetica','espiritual','mando','psiquica','oscura'];
  const AFIN_LABELS = { fisica:'Fis', energetica:'Ene', espiritual:'Esp', mando:'Man', psiquica:'Psi', oscura:'Osc' };
  const afinLayers = [
    { id:'afin_base',  label:'Base',  color:'#d4af37' },
    { id:'afin_extra', label:'Buff',  color:'#50c88c' },
    { id:'afin_alter', label:'Alter', color:'#60a8e8' },
  ];
  const afinsHtml = afinLayers.map(layer =>
    `<div style="margin-top:8px;">
      <div class="hxev-stat-label" style="color:${layer.color};">${layer.label}</div>
      ${AFINS.map(k => {
        const val = (p[layer.id] || {})[k] || 0;
        return `<div style="display:flex;align-items:center;gap:3px;margin-bottom:3px;">
          <span style="font-size:0.62em;color:#aaa;width:26px;">${AFIN_LABELS[k]}</span>
          <span style="font-size:0.68em;color:${layer.color};min-width:22px;text-align:right;">${val}</span>
          <button class="hxev-stat-btn neg" style="padding:1px 4px;" onclick="window._hxevAddAfin('${safe}','${layer.id}','${k}',-1)">-1</button>
          <button class="hxev-stat-btn neg" style="padding:1px 4px;" onclick="window._hxevAddAfin('${safe}','${layer.id}','${k}',-5)">-5</button>
          <button class="hxev-stat-btn pos" style="padding:1px 4px;" onclick="window._hxevAddAfin('${safe}','${layer.id}','${k}',+1)">+1</button>
          <button class="hxev-stat-btn pos" style="padding:1px 4px;" onclick="window._hxevAddAfin('${safe}','${layer.id}','${k}',+5)">+5</button>
        </div>`;
      }).join('')}
    </div>`
  ).join('');

  return `<div class="hxev-panel">
    <div class="hxev-panel-title">Stats</div>
    <div class="hxev-stats-body">${statsHtml}<hr class="hxev-stat-divider">${afinsHtml}</div>
  </div>`;
}

// ── Panel Hechizos ────────────────────────────────────────────
function _renderHechizos() {
  const busq = evState.busqueda.toLowerCase();
  const inv  = _previewInvHz();
  const invNombres = new Set(inv.map(h => h.hechizo_nombre));
  const cat  = evState.catalogoHechizos.filter(h =>
    !busq || (h.nombre||'').toLowerCase().includes(busq) || (h.afinidad||'').toLowerCase().includes(busq));
  const safe = evState.pjNombre?.replace(/'/g, "\\'");

  const invRows = inv.length > 0
    ? inv.map(h => `<div class="hxev-list-item" ${h._pendiente ? 'style="opacity:0.7;border-color:rgba(62,207,110,0.25);"' : ''}>
        <div style="flex:1;min-width:0;">
          <div class="hxev-list-item-nombre">${h.hechizo_nombre}${h._pendiente ? ' <span style="font-size:0.55em;color:#3ecf6e;padding:1px 5px;border-radius:3px;background:rgba(62,207,110,0.1);border:1px solid rgba(62,207,110,0.3);">pendiente</span>' : ''}</div>
          <div class="hxev-list-item-sub">${h.hechizo_afinidad||'—'}</div>
        </div>
        ${!h._pendiente ? `<button class="hxev-obj-btn-rem"
          onclick="window._hxevAddHzRem('${(evState.pjNombre||'').replace(/'/g,"\\'")}','${(h.hechizo_nombre||'').replace(/'/g,"\\'")}')">−</button>` : ''}
      </div>`).join('')
    : `<div class="hxev-list-empty">Sin hechizos</div>`;

  const catRows = cat.length > 0
    ? cat.map(h => {
        const yaTiene = invNombres.has(h.nombre);
        const costo   = h.hex_cost || 0;
        const sn = (h.nombre||'').replace(/'/g,"\\'");
        const si = (h.hechizo_id||'').replace(/'/g,"\\'");
        const sa = (h.afinidad||'').replace(/'/g,"\\'");
        const estadoBadge = h.es_estado ? `<span class="hxev-badge-estado">estado</span>` : '';
        const invBadge    = yaTiene     ? `<span class="hxev-badge-inv">aprendido</span>` : '';

        const opts = !yaTiene
          ? `<div class="hxev-hz-opts">
              <button class="hxev-hz-opt gratis"
                onclick="window._hxevAddHzAdd('${safe}','${sn}','${si}','${sa}',0)">Gratis</button>
              ${costo > 0 ? `
              <button class="hxev-hz-opt mitad"
                onclick="window._hxevAddHzAdd('${safe}','${sn}','${si}','${sa}',${Math.floor(costo/2)})">
                -${Math.floor(costo/2)} HEX (50%)</button>
              <button class="hxev-hz-opt completo"
                onclick="window._hxevAddHzAdd('${safe}','${sn}','${si}','${sa}',${costo})">
                -${costo} HEX</button>
              <button class="hxev-hz-opt doble"
                onclick="window._hxevAddHzAdd('${safe}','${sn}','${si}','${sa}',${costo*2})">
                -${costo*2} HEX (x2)</button>` : ''}
            </div>`
          : `<span style="font-size:0.58em;color:#3a3a55;">Ya en inventario</span>`;

        return `<div class="hxev-list-item"
            style="flex-direction:column;align-items:flex-start;gap:2px;padding:7px 8px;">
          <div style="display:flex;align-items:center;gap:4px;width:100%;">
            <div style="flex:1;min-width:0;">
              <div class="hxev-list-item-nombre">${h.nombre}${estadoBadge}${invBadge}</div>
              <div class="hxev-list-item-sub">${h.afinidad||'—'}${costo > 0 ? ' · '+costo+' HEX' : ''}</div>
            </div>
          </div>
          ${opts}
        </div>`;
      }).join('')
    : `<div class="hxev-list-empty">Sin resultados</div>`;

  return `<div class="hxev-panel">
    <div class="hxev-panel-title">Hechizos</div>
    <input class="hxev-list-search" placeholder="Buscar hechizo..." value="${evState.busqueda}"
      oninput="window._hxevBuscar(this.value)" onclick="event.stopPropagation()">
    <div class="hxev-list-body">
      <div class="hxev-sec-label">En inventario</div>${invRows}
      <div class="hxev-sec-label"
        style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.05);padding-top:6px;">
        Catálogo</div>${catRows}
    </div>
  </div>`;
}

// ── Panel Objetos ─────────────────────────────────────────────
function _renderObjetos() {
  const busq = evState.busqueda.toLowerCase();
  const inv  = _previewInvObj();
  const cat  = evState.catalogoObjetos.filter(o =>
    !busq || (o.nombre||'').toLowerCase().includes(busq) || (o.tipo||'').toLowerCase().includes(busq));
  const safe = evState.pjNombre?.replace(/'/g, "\\'");

  const invRows = inv.length > 0
    ? inv.map(o => `<div class="hxev-list-item" ${o._pendiente ? 'style="border-color:rgba(62,207,110,0.25);"' : ''}>
        <div style="flex:1;min-width:0;">
          <div class="hxev-list-item-nombre">${o.objeto_nombre} x${o.cantidad}${o._pendiente ? ' <span style="font-size:0.55em;color:#3ecf6e;padding:1px 5px;border-radius:3px;background:rgba(62,207,110,0.1);border:1px solid rgba(62,207,110,0.3);">pendiente</span>' : ''}</div>
          ${o.equipado ? `<div class="hxev-list-item-sub">equipado</div>` : ''}
        </div>
        ${!o._pendiente ? `<button class="hxev-obj-btn-rem"
          onclick="window._hxevAddObjRem('${safe}','${(o.objeto_nombre||'').replace(/'/g,"\\'")}',${o.id},1)">-1</button>` : ''}
      </div>`).join('')
    : `<div class="hxev-list-empty">Sin objetos</div>`;

  const catRows = cat.length > 0
    ? cat.map(o => {
        const sn = (o.nombre||'').replace(/'/g,"\\'");
        const se = (o.efecto||'').replace(/'/g,"\\'").replace(/\n/g,' ').substring(0,80);
        const qid = 'hxev-qty-' + (o.nombre||'').replace(/\s+/g,'_').replace(/[^a-z0-9_]/gi,'');
        return `<div class="hxev-list-item"
            style="flex-direction:column;align-items:flex-start;gap:2px;padding:6px 8px;">
          <div style="display:flex;align-items:center;gap:4px;width:100%;">
            <div style="flex:1;min-width:0;">
              <div class="hxev-list-item-nombre">${o.nombre}</div>
              <div class="hxev-list-item-sub">${o.tipo||'—'}${o.rareza?' · '+o.rareza:''}</div>
              ${o.efecto
                ? `<div class="hxev-list-item-efecto">${o.efecto.substring(0,60)}${o.efecto.length>60?'…':''}</div>`
                : ''}
            </div>
            <div class="hxev-obj-add">
              <input class="hxev-obj-qty" id="${qid}" type="number" value="1" min="1"
                onclick="event.stopPropagation()">
              <button class="hxev-obj-btn-add"
                onclick="window._hxevAddObjAdd('${safe}','${sn}','${se}','${qid}')">+</button>
            </div>
          </div>
        </div>`;
      }).join('')
    : `<div class="hxev-list-empty">Sin resultados</div>`;

  return `<div class="hxev-panel">
    <div class="hxev-panel-title">Objetos</div>
    <input class="hxev-list-search" placeholder="Buscar objeto..." value="${evState.busqueda}"
      oninput="window._hxevBuscar(this.value)" onclick="event.stopPropagation()">
    <div class="hxev-list-body">
      <div class="hxev-sec-label">En inventario</div>${invRows}
      <div class="hxev-sec-label"
        style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.05);padding-top:6px;">
        Catálogo</div>${catRows}
    </div>
  </div>`;
}

// ── Handlers ─────────────────────────────────────────────────
window._hxevQuitarCambio = (idx) => { evState.cambios.splice(idx, 1); _render(); };
window._hxevLimpiar      = ()    => { evState.cambios = []; _render(); };
window._hxevBuscar       = (val) => { evState.busqueda = val; _render(); };

window._hxevAddStat = (nombre, campo, delta, label) => {
  evState.cambios.push({ tipo:'stat', pjNombre:nombre, campo, delta, label });
  _render();
};
window._hxevAddStatCustom = (nombre, campo, label) => {
  const inp = document.getElementById(`hxev-c-${campo}`);
  const val = parseInt(inp?.value);
  if (!val || isNaN(val)) { _toast('Ingresa un número', true); return; }
  evState.cambios.push({ tipo:'stat', pjNombre:nombre, campo, delta:val,
    label:`${label} ${val > 0 ? '+' : ''}${val}` });
  if (inp) inp.value = '';
  _render();
};
window._hxevAddAfin = (nombre, layer, key, delta) => {
  const labels = { fisica:'Física', energetica:'Energética', espiritual:'Espiritual',
    mando:'Mando', psiquica:'Psíquica', oscura:'Oscura' };
  const layerLabel = { afin_base:'Base', afin_extra:'Buff', afin_alter:'Alter' };
  evState.cambios.push({ tipo:'afin', pjNombre:nombre, afinLayer:layer, afinKey:key, delta,
    afinLabel:`${layerLabel[layer]} ${labels[key]} ${delta > 0 ? '+' : ''}${delta}` });
  _render();
};
window._hxevAddHzAdd = (nombre, hzNombre, hzId, afinidad, costeHex) => {
  evState.cambios.push({ tipo:'hz_add', pjNombre:nombre, hzNombre, hzId, afinidad,
    costeHex: costeHex || 0 });
  _render();
};
window._hxevAddHzRem = (nombre, hzNombre) => {
  evState.cambios.push({ tipo:'hz_rem', pjNombre:nombre, hzNombre });
  _render();
};
window._hxevAddObjAdd = (nombre, objNombre, efecto, qtyId) => {
  const qty = parseInt(document.getElementById(qtyId)?.value) || 1;
  evState.cambios.push({ tipo:'obj_add', pjNombre:nombre, objNombre, cantidad:qty, efecto });
  _render();
};
window._hxevAddObjRem = (nombre, objNombre, slotId, cantidad) => {
  evState.cambios.push({ tipo:'obj_rem', pjNombre:nombre, objNombre, slotId, cantidad });
  _render();
};

// ── Guardar → bloque en el stack ─────────────────────────────
window._hxevGuardar = () => {
  if (!evState.cambios.length) { _toast('No hay cambios seleccionados', true); return; }
  const nombre = document.getElementById('hxev-nombre-evento')?.value.trim() || 'Evento';
  const color  = SLOT_COLORS[evState.grupo]?.[evState.idx] || SLOT_COLORS.A[0];
  const pj     = evState.pjNombre;

  // Agrupar por tipo para el resumen
  const porTipo = {};
  for (const c of evState.cambios) {
    if (!porTipo[c.tipo]) porTipo[c.tipo] = [];
    porTipo[c.tipo].push(c);
  }
  const lineas = [];

  if (porTipo.stat || porTipo.afin) {
    const items = [...(porTipo.stat||[]), ...(porTipo.afin||[])];
    lineas.push(`Stats (${pj}) : ${items.map(c => c.label || c.afinLabel).join(' · ')}`);
  }
  if (porTipo.hz_add) {
    const hzs = porTipo.hz_add.map(c =>
      `${c.hzNombre}${c.costeHex > 0 ? ` (-${c.costeHex} HEX)` : ' (gratis)'}`);
    lineas.push(`Hechizos aprendidos (${pj}) : ${hzs.join(' | ')}`);
  }
  if (porTipo.hz_rem) {
    lineas.push(`Hechizos olvidados (${pj}) : ${porTipo.hz_rem.map(c => c.hzNombre).join(' | ')}`);
  }
  if (porTipo.obj_add) {
    const mapa = {};
    for (const c of porTipo.obj_add) {
      if (!mapa[c.objNombre]) mapa[c.objNombre] = { efecto: c.efecto, cantidad: 0 };
      mapa[c.objNombre].cantidad += c.cantidad;
    }
    const objLineas = Object.entries(mapa).map(([n, v]) =>
      `${n} x${v.cantidad}${v.efecto ? ' | ' + v.efecto : ''}`);
    lineas.push(`Objetos obtenidos (${pj}) :\n${objLineas.join('\n')}`);
  }
  if (porTipo.obj_rem) {
    lineas.push(`Objetos retirados (${pj}) : ${porTipo.obj_rem.map(c => `${c.objNombre} x${c.cantidad}`).join(' · ')}`);
  }

  const nuevoItem = {
    id:           'ev_' + Date.now(),
    tipoItem:     'evento',
    pjNombre:     pj,
    grupo:        evState.grupo,
    slotIdx:      evState.idx,
    color,
    eventoNombre: nombre,
    eventoDesc:   lineas.join('\n'),
    abierto:      false,
    _payload:     [...evState.cambios],
    _aplicado:    false,
  };

  // Si es edición: reemplazar el item existente en el stack
  if (evState._stackIdx !== null && evState._stackIdx !== undefined) {
    const idx = evState._stackIdx;
    if (typeof window._hxcReplaceStackItem === 'function') {
      window._hxcReplaceStackItem(idx, nuevoItem);
    }
    _toast(`✦ Evento "${nombre}" actualizado`);
  } else {
    hxState.stack.push(nuevoItem);
    _toast(`✦ Evento "${nombre}" guardado en el turno`);
  }

  evState.cambios = [];
  evState._stackIdx = null;
  evState._editNombre = '';
  cerrarEventoPanel();
  if (typeof window._hxcRender === 'function') window._hxcRender();
};

// ── Carga de datos ────────────────────────────────────────────
async function _cargarDatos(nombre) {
  const [hzCat, hzInv, objCat, objInv] = await Promise.all([
    supabase.from('hechizos_nodos').select('hechizo_id,nombre,afinidad,hex_cost,es_estado,efecto').order('nombre'),
    supabase.from('hechizos_inventario').select('hechizo_nombre,hechizo_afinidad,hechizo_hex').eq('personaje_nombre', nombre),
    supabase.from('objetos').select('nombre,tipo,rareza,efecto').eq('es_propuesta', false).order('nombre'),
    supabase.from('inventario_objetos').select('id,objeto_nombre,cantidad,equipado').eq('personaje_nombre', nombre).gt('cantidad', 0),
  ]);
  evState.catalogoHechizos = hzCat.data  || [];
  evState.inventarioHz     = hzInv.data  || [];
  evState.catalogoObjetos  = objCat.data || [];
  evState.inventarioObj    = objInv.data || [];
}

// ── Apertura / cierre ─────────────────────────────────────────
export async function abrirEventoPanel(pjNombre, grupo, idx, editContext = null) {
  _montar();
  evState.pjNombre = pjNombre;
  evState.grupo    = grupo || 'A';
  evState.idx      = idx  ?? 0;
  evState.busqueda = '';
  // Si es edición: precargar cambios y nombre; guardar índice en stack
  if (editContext) {
    evState.cambios   = editContext.cambios || [];
    evState._stackIdx = editContext.stackIdx ?? null;
    evState._editNombre = editContext.nombre || '';
  } else {
    evState.cambios   = [];
    evState._stackIdx = null;
    evState._editNombre = '';
  }
  await _cargarDatos(pjNombre);
  document.getElementById('hxev-overlay')?.classList.add('open');
  document.getElementById('hxev-root')?.classList.add('open');
  _render();
  // Si es edición, poner el nombre en el input
  if (editContext?.nombre) {
    setTimeout(() => {
      const inp = document.getElementById('hxev-nombre-evento');
      if (inp) inp.value = editContext.nombre;
    }, 50);
  }
}
export function cerrarEventoPanel() {
  document.getElementById('hxev-overlay')?.classList.remove('open');
  document.getElementById('hxev-root')?.classList.remove('open');
}
window._hxevCerrar = cerrarEventoPanel;

// ── aplicarPayload — llamado desde panel-hexcast.js ───────────
export async function aplicarPayload(payload, invertir = false) {
  const errores = [];
  for (const c of payload) {
    try {
      const sign = invertir ? -1 : 1;

      if (c.tipo === 'stat') {
        const p = personajes[c.pjNombre]; if (!p) continue;
        const s = calcularStats(p);
        const delta = c.delta * sign;
        if (c.campo === 'vida_azul_actual') {
          p.vida_azul_actual = (p.vida_azul_actual ?? 0) + delta;
          await persistirCampos(c.pjNombre, { vida_azul_actual: p.vida_azul_actual });
        } else if (c.campo === 'vida_roja_max_override') {
          p.vida_roja_max_override = (p.vida_roja_max_override || 0) + delta;
          await persistirCampos(c.pjNombre, { vida_roja_max_op: p.vida_roja_max_override });
        } else if (c.campo === 'guarda_max_override') {
          p.guarda_max_override = (p.guarda_max_override || 0) + delta;
          await persistirCampos(c.pjNombre, { guarda_max_op: p.guarda_max_override });
        } else if (c.campo === 'vex_max_override') {
          p.vex_max_override = (p.vex_max_override || 0) + delta;
          await persistirCampos(c.pjNombre, { vex_max_op: p.vex_max_override });
        } else {
          const caps = { vida_roja_actual: s.vida_roja_max, guarda_actual: s.guarda_max, vex_actual: s.vex_max };
          const max = caps[c.campo] ?? Infinity;
          p[c.campo] = Math.max(0, Math.min(max, (p[c.campo] ?? 0) + delta));
          await persistirCampos(c.pjNombre, { [c.campo]: p[c.campo] });
        }

      } else if (c.tipo === 'afin') {
        const p = personajes[c.pjNombre]; if (!p) continue;
        if (!p[c.afinLayer]) p[c.afinLayer] = {};
        p[c.afinLayer][c.afinKey] = (p[c.afinLayer][c.afinKey] || 0) + c.delta * sign;
        const aliasMap = { afin_base:'afinidadesBase', afin_extra:'afinidadesBf', afin_alter:'afinidadesEf' };
        const alias = aliasMap[c.afinLayer];
        if (alias) { if (!p[alias]) p[alias] = {}; p[alias][c.afinKey] = p[c.afinLayer][c.afinKey]; }
        await persistirCampos(c.pjNombre, { [c.afinLayer]: { ...p[c.afinLayer] } });

      } else if (c.tipo === 'hz_add' && !invertir) {
        await supabase.from('hechizos_inventario').insert({
          personaje_nombre: c.pjNombre, hechizo_nombre: c.hzNombre,
          hechizo_afinidad: c.afinidad || '', hechizo_hex: 0,
          tipo: 'Normal', origen: 'HexCast Evento'
        });
        if (c.costeHex > 0) {
          const p = personajes[c.pjNombre];
          if (p) { p.hex = Math.max(0, (p.hex||0) - c.costeHex); await persistirCampos(c.pjNombre, { hex: p.hex }); }
        }
      } else if (c.tipo === 'hz_add' && invertir) {
        await supabase.from('hechizos_inventario').delete()
          .eq('personaje_nombre', c.pjNombre).eq('hechizo_nombre', c.hzNombre);
        if (c.costeHex > 0) {
          const p = personajes[c.pjNombre];
          if (p) { p.hex = (p.hex||0) + c.costeHex; await persistirCampos(c.pjNombre, { hex: p.hex }); }
        }

      } else if (c.tipo === 'hz_rem' && !invertir) {
        await supabase.from('hechizos_inventario').delete()
          .eq('personaje_nombre', c.pjNombre).eq('hechizo_nombre', c.hzNombre);
      } else if (c.tipo === 'hz_rem' && invertir) {
        await supabase.from('hechizos_inventario').insert({
          personaje_nombre: c.pjNombre, hechizo_nombre: c.hzNombre,
          hechizo_afinidad: '', hechizo_hex: 0, tipo: 'Normal', origen: 'HexCast Revert'
        });

      } else if (c.tipo === 'obj_add' && !invertir) {
        const { data: ex } = await supabase.from('inventario_objetos').select('id,cantidad')
          .eq('personaje_nombre', c.pjNombre).eq('objeto_nombre', c.objNombre).maybeSingle();
        if (ex) await supabase.from('inventario_objetos').update({ cantidad: ex.cantidad + c.cantidad }).eq('id', ex.id);
        else    await supabase.from('inventario_objetos').insert({ personaje_nombre: c.pjNombre, objeto_nombre: c.objNombre, cantidad: c.cantidad, equipado: false });
      } else if (c.tipo === 'obj_add' && invertir) {
        const { data: ex } = await supabase.from('inventario_objetos').select('id,cantidad')
          .eq('personaje_nombre', c.pjNombre).eq('objeto_nombre', c.objNombre).maybeSingle();
        if (ex) {
          if (ex.cantidad <= c.cantidad) await supabase.from('inventario_objetos').delete().eq('id', ex.id);
          else await supabase.from('inventario_objetos').update({ cantidad: ex.cantidad - c.cantidad }).eq('id', ex.id);
        }

      } else if (c.tipo === 'obj_rem' && !invertir) {
        const { data: ex } = await supabase.from('inventario_objetos').select('id,cantidad')
          .eq('id', c.slotId).maybeSingle();
        if (ex) {
          if (ex.cantidad <= c.cantidad) await supabase.from('inventario_objetos').delete().eq('id', ex.id);
          else await supabase.from('inventario_objetos').update({ cantidad: ex.cantidad - c.cantidad }).eq('id', ex.id);
        }
      } else if (c.tipo === 'obj_rem' && invertir) {
        const { data: ex } = await supabase.from('inventario_objetos').select('id,cantidad')
          .eq('personaje_nombre', c.pjNombre).eq('objeto_nombre', c.objNombre).maybeSingle();
        if (ex) await supabase.from('inventario_objetos').update({ cantidad: ex.cantidad + c.cantidad }).eq('id', ex.id);
        else    await supabase.from('inventario_objetos').insert({ personaje_nombre: c.pjNombre, objeto_nombre: c.objNombre, cantidad: c.cantidad, equipado: false });
      }

    } catch(e) { errores.push(e.message); }
  }
  if (typeof window.refreshPanelPJ === 'function') window.refreshPanelPJ();
  if (typeof window.renderCatalogo  === 'function') window.renderCatalogo();
  return errores;
}
