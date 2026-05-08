// ============================================================
// panel-hexcast.js — UI del sistema HexCast
// Se monta como drawer desde abajo. Llamar: abrirHexCast()
// ============================================================

import { supabase } from '../hex-auth.js';
import { personajes, estadoUI } from '../personajes/personajes-state.js';
import { hxState, SLOT_COLORS } from './hexcast-state.js';
import {
  _norm, imgPj, imgFallback,
  cargarSesiones, crearSesion, seleccionarSesion, crearTurno,
  cargarInventarioPJ, cargarCatalogo,
  agregarHechizo, removerHechizo, moverAPrioridad,
  evaluarItem, confirmarTurno, getAfinidadEfectiva
} from './hexcast-logic.js';

// ── Inyección de estilos ──────────────────────────────────────
function _css() {
  if (document.getElementById('hexcast-styles')) return;
  const st = document.createElement('style');
  st.id = 'hexcast-styles';
  st.textContent = `
/* ══════════════════════════════════════════
   TRIGGER BUTTON
══════════════════════════════════════════ */
#hxc-trigger {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: rgba(10,6,24,0.95); border: 1px solid rgba(212,175,55,0.35);
  border-radius: 24px; color: #d4af37; font-family: 'Cinzel', serif;
  font-size: 0.75em; letter-spacing: 1.5px; padding: 9px 22px;
  cursor: pointer; z-index: 1100; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  white-space: nowrap; user-select: none;
}
#hxc-trigger:hover {
  background: rgba(212,175,55,0.1); border-color: rgba(212,175,55,0.6);
  box-shadow: 0 4px 28px rgba(212,175,55,0.15);
}

/* ══════════════════════════════════════════
   OVERLAY
══════════════════════════════════════════ */
#hxc-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  z-index: 1200; opacity: 0; pointer-events: none;
  transition: opacity 0.28s;
}
#hxc-overlay.open { opacity: 1; pointer-events: all; }

/* ══════════════════════════════════════════
   DRAWER PRINCIPAL
══════════════════════════════════════════ */
#hxc-drawer {
  position: fixed; left: 0; right: 0; bottom: 0;
  height: 88vh; background: #07060f;
  border-top: 1px solid rgba(212,175,55,0.18);
  border-radius: 16px 16px 0 0;
  z-index: 1201; display: flex; flex-direction: column;
  transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
  font-family: 'Inter', system-ui, sans-serif;
  box-shadow: 0 -8px 48px rgba(0,0,0,0.7);
}
#hxc-drawer.open { transform: translateY(0); }

/* Handle de arrastre */
.hxc-handle {
  width: 40px; height: 4px; background: rgba(255,255,255,0.12);
  border-radius: 2px; margin: 10px auto 0; flex-shrink: 0;
}

/* Header del drawer */
.hxc-header {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px 10px; border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.hxc-header-title {
  font-family: 'Cinzel', serif; font-size: 0.85em; color: #d4af37;
  letter-spacing: 1.5px; text-transform: uppercase; flex: 1;
}
.hxc-header-sub { font-size: 0.68em; color: #555; }
.hxc-btn-close {
  background: none; border: none; color: #3a3a58; font-size: 1.3em;
  cursor: pointer; padding: 2px 6px; border-radius: 4px;
  transition: color 0.15s;
}
.hxc-btn-close:hover { color: #888; }

/* Cuerpo: layout de 3 columnas */
.hxc-body {
  flex: 1; display: grid;
  grid-template-columns: 200px 1fr 200px;
  gap: 0; overflow: hidden;
}

/* ══════════════════════════════════════════
   COLUMNAS LATERALES (slots de PJs)
══════════════════════════════════════════ */
.hxc-col {
  display: flex; flex-direction: column; gap: 0;
  border-right: 1px solid rgba(255,255,255,0.04);
  overflow: hidden;
}
.hxc-col-b { border-right: none; border-left: 1px solid rgba(255,255,255,0.04); }
.hxc-col-title {
  font-size: 0.55em; letter-spacing: 2px; text-transform: uppercase;
  color: #3a3a58; padding: 8px 12px 5px; flex-shrink: 0;
}

/* Slot de personaje */
.hxc-slot {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  cursor: pointer; transition: background 0.15s; position: relative;
  overflow: hidden;
}
.hxc-slot:last-child { border-bottom: none; }
.hxc-slot.vacio { opacity: 0.55; }
.hxc-slot.activo { box-shadow: inset 2px 0 0 var(--slot-border); }
.hxc-slot-inner {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 5px; height: 100%; padding: 8px 10px;
  transition: background 0.15s;
}
.hxc-slot:hover .hxc-slot-inner { background: rgba(255,255,255,0.03); }
.hxc-slot.activo .hxc-slot-inner { background: var(--slot-bg); }

.hxc-slot-avatar {
  width: 38px; height: 38px; border-radius: 8px;
  object-fit: cover; object-position: top;
  border: 2px solid var(--slot-border);
  background: #111; flex-shrink: 0;
}
.hxc-slot-nombre {
  font-size: 0.62em; font-weight: 600; color: var(--slot-text);
  text-align: center; line-height: 1.2;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  width: 100%;
}
.hxc-slot-plus {
  font-size: 1.4em; color: rgba(255,255,255,0.15);
  transition: color 0.15s;
}
.hxc-slot:hover .hxc-slot-plus { color: rgba(255,255,255,0.3); }
.hxc-slot-hex {
  font-size: 0.58em; color: #3a3a58;
  font-family: 'Cinzel', serif;
}

/* Inventario desplegado debajo del slot */
.hxc-inv-panel {
  position: absolute; inset: 0; background: rgba(7,6,15,0.97);
  display: flex; flex-direction: column; z-index: 2;
  border: 1px solid var(--slot-border); border-radius: 4px;
  overflow: hidden;
}
.hxc-inv-header {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 8px 5px; border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.hxc-inv-nombre {
  font-size: 0.68em; font-weight: 700; color: var(--slot-text); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hxc-inv-close {
  background: none; border: none; color: #3a3a58; font-size: 0.9em;
  cursor: pointer; padding: 1px 4px; border-radius: 3px;
}
.hxc-inv-close:hover { color: #888; }
.hxc-inv-search {
  margin: 5px 8px; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 5px;
  color: #ccc; font-size: 0.7em; padding: 5px 8px;
  outline: none; font-family: inherit; flex-shrink: 0;
}
.hxc-inv-search:focus { border-color: var(--slot-border); }
.hxc-inv-list {
  flex: 1; overflow-y: auto; padding: 4px 6px 8px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent;
}
.hxc-inv-hz {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; border-radius: 5px; cursor: pointer;
  border: 1px solid transparent; margin-bottom: 3px;
  transition: background 0.12s, border-color 0.12s;
}
.hxc-inv-hz:hover {
  background: var(--slot-bg); border-color: var(--slot-border);
}
.hxc-inv-hz-nombre { font-size: 0.7em; color: #ddd; flex: 1; line-height: 1.2; }
.hxc-inv-hz-afin { font-size: 0.58em; color: #555; white-space: nowrap; }
.hxc-inv-hz-cost { font-size: 0.6em; color: #d4af37; font-family: 'Cinzel', serif; flex-shrink: 0; }
.hxc-inv-empty { font-size: 0.68em; color: #333; text-align: center; padding: 20px 8px; }

/* ══════════════════════════════════════════
   COLUMNA CENTRAL — Stack de hechizos
══════════════════════════════════════════ */
.hxc-center {
  display: flex; flex-direction: column; overflow: hidden;
}
.hxc-center-top {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px 7px; border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;
}
.hxc-turno-label {
  font-size: 0.62em; color: #555; letter-spacing: 1px; flex: 1;
}
.hxc-turno-label strong { color: #888; }
.hxc-btn-confirmar {
  background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.35);
  color: #d4af37; font-size: 0.7em; font-family: 'Cinzel', serif;
  letter-spacing: 0.8px; padding: 6px 14px; border-radius: 6px;
  cursor: pointer; transition: background 0.15s;
}
.hxc-btn-confirmar:hover { background: rgba(212,175,55,0.22); }
.hxc-btn-nuevo-turno {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  color: #666; font-size: 0.65em; padding: 5px 10px; border-radius: 5px;
  cursor: pointer; transition: background 0.12s; font-family: inherit;
}
.hxc-btn-nuevo-turno:hover { background: rgba(255,255,255,0.08); color: #999; }

.hxc-stack {
  flex: 1; overflow-y: auto; padding: 8px 12px 12px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent;
}
.hxc-stack-empty {
  text-align: center; padding: 40px 20px;
  font-size: 0.72em; color: #2a2a3a; line-height: 1.7;
}

/* ── Item del stack ── */
.hxc-item {
  border-radius: 8px; border: 1px solid var(--slot-border);
  background: var(--slot-bg); margin-bottom: 6px;
  transition: box-shadow 0.15s; overflow: hidden;
}
.hxc-item.prioridad { order: -1; box-shadow: 0 0 12px var(--slot-glow); }

.hxc-item-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; cursor: pointer;
}
.hxc-item-color-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--slot-border); flex-shrink: 0;
}
.hxc-item-pj {
  font-size: 0.62em; color: var(--slot-text); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; min-width: 0; max-width: 70px;
}
.hxc-item-hz { font-size: 0.74em; color: #ddd; flex: 1; line-height: 1.2; }
.hxc-item-mult {
  font-size: 0.58em; color: #e8a030; white-space: nowrap;
  font-family: 'Cinzel', serif;
}
/* Campo dado siempre visible */
.hxc-item-dado-wrap {
  display: flex; align-items: center; gap: 4px; flex-shrink: 0;
}
.hxc-item-dado {
  width: 50px; background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.12); border-radius: 5px;
  color: #fff; font-size: 0.75em; text-align: center; padding: 4px 5px;
  font-family: 'Cinzel', serif; outline: none;
  transition: border-color 0.15s;
}
.hxc-item-dado:focus { border-color: var(--slot-border); }
.hxc-item-resultado {
  font-size: 0.7em; font-weight: 700; min-width: 56px; text-align: right;
  white-space: nowrap; font-family: 'Cinzel', serif;
}
.hxc-res-exito    { color: #3ecf6e; }
.hxc-res-fallo    { color: #e04040; }
.hxc-res-infalible{ color: #d4af37; }

.hxc-item-del {
  background: none; border: none; color: #2a2a3a; font-size: 0.85em;
  cursor: pointer; padding: 2px 5px; border-radius: 3px;
  transition: color 0.15s; flex-shrink: 0;
}
.hxc-item-del:hover { color: #c44; }

/* Detalle colapsable del ítem */
.hxc-item-detail {
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 8px 12px 10px; background: rgba(0,0,0,0.25);
}
.hxc-detail-opts {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;
}
.hxc-opt-btn {
  font-size: 0.62em; padding: 4px 10px; border-radius: 5px;
  cursor: pointer; border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04); color: #666;
  transition: all 0.12s; font-family: inherit;
}
.hxc-opt-btn:hover { background: rgba(255,255,255,0.09); color: #aaa; }
.hxc-opt-btn.on { background: var(--slot-bg); border-color: var(--slot-border); color: var(--slot-text); }
.hxc-detail-info { font-size: 0.65em; color: #3a3a58; line-height: 1.6; }
.hxc-detail-info span { color: #5a5a78; }
.hxc-nc-calc { font-size: 0.68em; color: #555; margin-top: 4px; }
.hxc-nc-calc strong { color: var(--slot-text); }
.hxc-prioridad-flag {
  font-size: 0.56em; color: #d4af37; letter-spacing: 0.5px;
  text-transform: uppercase;
}

/* ══════════════════════════════════════════
   VISTA: SELECTOR DE SESIONES
══════════════════════════════════════════ */
#hxc-view-sesiones {
  flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 0;
}
.hxc-ses-wrap {
  max-width: 560px; width: 100%; margin: 0 auto;
  display: flex; flex-direction: column; height: 100%;
}
.hxc-ses-top {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 14px; flex-shrink: 0;
}
.hxc-ses-title {
  font-family: 'Cinzel', serif; font-size: 0.9em; color: #d4af37;
  letter-spacing: 2px; text-transform: uppercase;
}
.hxc-btn-nueva-ses {
  background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.3);
  color: #d4af37; font-size: 0.68em; padding: 6px 14px; border-radius: 6px;
  cursor: pointer; font-family: 'Cinzel', serif; letter-spacing: 0.5px;
  transition: background 0.15s;
}
.hxc-btn-nueva-ses:hover { background: rgba(212,175,55,0.18); }

.hxc-ses-list { flex: 1; overflow-y: auto; padding: 0 24px 24px; }
.hxc-ses-card {
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 14px 16px; margin-bottom: 8px;
  cursor: pointer; transition: background 0.13s, border-color 0.13s;
  display: flex; align-items: center; gap: 14px;
}
.hxc-ses-card:hover { background: rgba(212,175,55,0.05); border-color: rgba(212,175,55,0.25); }
.hxc-ses-card-info { flex: 1; min-width: 0; }
.hxc-ses-card-nombre {
  font-size: 0.85em; font-weight: 600; color: #e0e0e0; margin-bottom: 3px;
}
.hxc-ses-card-meta { font-size: 0.62em; color: #444; }
.hxc-ses-card-chevron { color: #2a2a3a; font-size: 0.9em; flex-shrink: 0; }
.hxc-ses-empty { text-align: center; color: #2a2a3a; font-size: 0.75em; padding: 40px 20px; line-height: 1.8; }

/* Modal nueva sesión */
.hxc-modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 1300; display: flex; align-items: center; justify-content: center;
}
.hxc-modal {
  background: #0d0c1a; border: 1px solid rgba(212,175,55,0.25);
  border-radius: 12px; padding: 24px 28px; width: 360px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.7);
}
.hxc-modal-title { font-family: 'Cinzel', serif; font-size: 0.85em; color: #d4af37; margin-bottom: 16px; letter-spacing: 1px; }
.hxc-modal label { font-size: 0.68em; color: #666; display: block; margin-bottom: 4px; margin-top: 12px; }
.hxc-modal input, .hxc-modal textarea {
  width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; color: #ddd; font-size: 0.78em; padding: 7px 10px;
  font-family: inherit; outline: none; box-sizing: border-box;
}
.hxc-modal input:focus, .hxc-modal textarea:focus { border-color: rgba(212,175,55,0.4); }
.hxc-modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; }
.hxc-btn-cancel-modal {
  background: none; border: 1px solid rgba(255,255,255,0.1); color: #555;
  font-size: 0.68em; padding: 6px 14px; border-radius: 5px; cursor: pointer; font-family: inherit;
}
.hxc-btn-cancel-modal:hover { color: #888; }
.hxc-btn-ok-modal {
  background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.35);
  color: #d4af37; font-size: 0.68em; padding: 6px 16px; border-radius: 5px;
  cursor: pointer; font-family: 'Cinzel', serif; transition: background 0.15s;
}
.hxc-btn-ok-modal:hover { background: rgba(212,175,55,0.22); }

/* ══════════════════════════════════════════
   SELECTOR DE PERSONAJE (modal)
══════════════════════════════════════════ */
.hxc-pj-modal {
  background: #0d0c1a; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px; padding: 16px 18px; width: 320px; max-height: 70vh;
  display: flex; flex-direction: column; box-shadow: 0 8px 40px rgba(0,0,0,0.7);
}
.hxc-pj-modal-title { font-size: 0.72em; color: #888; margin-bottom: 10px; letter-spacing: 1px; text-transform: uppercase; }
.hxc-pj-modal-list { overflow-y: auto; flex: 1; }
.hxc-pj-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  border-radius: 7px; cursor: pointer; transition: background 0.12s;
}
.hxc-pj-row:hover { background: rgba(255,255,255,0.05); }
.hxc-pj-row img {
  width: 32px; height: 32px; border-radius: 6px; object-fit: cover;
  object-position: top; border: 1px solid rgba(255,255,255,0.1); background: #111;
}
.hxc-pj-row-info { flex: 1; min-width: 0; }
.hxc-pj-row-nombre { font-size: 0.76em; color: #ddd; }
.hxc-pj-row-hex { font-size: 0.6em; color: #555; font-family: 'Cinzel', serif; }

/* Highlight resultado en item */
.hxc-item.res-exito     { border-color: rgba(62,207,110,0.4); }
.hxc-item.res-fallo     { border-color: rgba(224,64,64,0.4);  }
.hxc-item.res-infalible { border-color: rgba(212,175,55,0.5); }

/* Toast */
.hxc-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: rgba(20,18,36,0.97); border: 1px solid rgba(212,175,55,0.3);
  color: #d4af37; font-size: 0.78em; padding: 10px 20px; border-radius: 8px;
  z-index: 2000; pointer-events: none; opacity: 0; transition: opacity 0.25s;
  font-family: 'Inter', sans-serif; white-space: nowrap;
}
.hxc-toast.show { opacity: 1; }
`;
  document.head.appendChild(st);
}

// ── Toast ─────────────────────────────────────────────────────
function _toast(msg, err = false) {
  let el = document.getElementById('hxc-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hxc-toast'; el.className = 'hxc-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.borderColor = err ? 'rgba(220,80,80,0.4)' : 'rgba(212,175,55,0.3)';
  el.style.color = err ? '#e07070' : '#d4af37';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ── Helpers de color CSS vars ─────────────────────────────────
function _colorVars(color) {
  return `--slot-bg:${color.bg};--slot-border:${color.border};--slot-text:${color.text};--slot-glow:${color.glow};`;
}

// ── Render principal ──────────────────────────────────────────
function _render() {
  const drawer = document.getElementById('hxc-drawer');
  if (!drawer) return;

  if (hxState.vistaActiva === 'sesiones') {
    _renderSesiones(drawer);
  } else {
    _renderCast(drawer);
  }
}

// ── Vista: selector de sesiones ───────────────────────────────
function _renderSesiones(drawer) {
  drawer.querySelector('.hxc-handle').outerHTML; // keep handle
  const handle = '<div class="hxc-handle"></div>';
  const header = `
    <div class="hxc-header">
      <span class="hxc-header-title">✦ HexCast</span>
      <button class="hxc-btn-close" onclick="window._hxcCerrar()">×</button>
    </div>`;

  const cards = hxState.sesiones.length > 0
    ? hxState.sesiones.map(s => {
        const d = new Date(s.actualizada_en || s.creada_en);
        const fecha = d.toLocaleDateString('es', { day:'numeric', month:'short', year:'numeric' });
        return `<div class="hxc-ses-card" onclick="window._hxcSelSesion(${s.id})">
          <div class="hxc-ses-card-info">
            <div class="hxc-ses-card-nombre">${s.nombre || 'Sesión ' + s.id}</div>
            <div class="hxc-ses-card-meta">Última actividad: ${fecha}${s.descripcion ? ' · '+s.descripcion : ''}</div>
          </div>
          <span class="hxc-ses-card-chevron">›</span>
        </div>`;
      }).join('')
    : `<div class="hxc-ses-empty">Sin sesiones aún.<br>Crea una nueva para empezar a lanzar hechizos.</div>`;

  drawer.innerHTML = `
    ${handle}
    ${header}
    <div id="hxc-view-sesiones">
      <div class="hxc-ses-wrap">
        <div class="hxc-ses-top">
          <span class="hxc-ses-title">Sesiones</span>
          <button class="hxc-btn-nueva-ses" onclick="window._hxcModalNuevaSesion()">+ Nueva sesión</button>
        </div>
        <div class="hxc-ses-list">${cards}</div>
      </div>
    </div>`;
}

// ── Vista: cast ───────────────────────────────────────────────
function _renderCast(drawer) {
  const handle = '<div class="hxc-handle"></div>';
  const turnoNum = hxState.turnoActivo?.numero ?? 1;
  const sesNombre = hxState.sesionActiva?.nombre || 'Sesión';
  const header = `
    <div class="hxc-header">
      <span class="hxc-header-title">✦ HexCast</span>
      <span class="hxc-header-sub" style="cursor:pointer;color:#4a4a68;" onclick="window._hxcVolverSesiones()">‹ ${sesNombre}</span>
      <span style="flex:1"></span>
      <button class="hxc-btn-close" onclick="window._hxcCerrar()">×</button>
    </div>`;

  drawer.innerHTML = `
    ${handle}
    ${header}
    <div class="hxc-body">
      ${_renderColGrupo('A')}
      ${_renderCenter()}
      ${_renderColGrupo('B')}
    </div>`;

  // Bind inputs de dado (no se pueden hacer con onclick inline fácilmente)
  _bindDadoInputs();
}

function _renderColGrupo(grupo) {
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const isB = grupo === 'B';
  const items = slots.map((pj, idx) => _renderSlot(pj, grupo, idx)).join('');
  return `
    <div class="hxc-col ${isB ? 'hxc-col-b' : ''}">
      <div class="hxc-col-title">Grupo ${grupo}</div>
      ${items}
    </div>`;
}

function _renderSlot(pj, grupo, idx) {
  const color = SLOT_COLORS[grupo][idx];
  const vars  = _colorVars(color);
  const seleccionado = hxState.pjSeleccionado?.nombre === pj?.nombre
    && hxState.pjSeleccionado?.grupo === grupo
    && hxState.pjSeleccionado?.idx === idx;

  let inner;
  if (!pj) {
    inner = `<div class="hxc-slot-inner">
      <span class="hxc-slot-plus">+</span>
      <span style="font-size:0.55em;color:#2a2a3a;">Asignar PJ</span>
    </div>`;
  } else {
    const hex = personajes[pj.nombre]?.hex ?? '?';
    inner = `<div class="hxc-slot-inner">
      <img class="hxc-slot-avatar"
        src="${imgPj(pj.nombre)}"
        onerror="this.src='${imgFallback()}'"
        title="${pj.nombre}">
      <span class="hxc-slot-nombre">${pj.nombre}</span>
      <span class="hxc-slot-hex">${hex} HEX</span>
    </div>`;
  }

  // Panel de inventario
  let invPanel = '';
  if (seleccionado && pj) {
    invPanel = _renderInvPanel(pj, grupo, idx, color);
  }

  const actCls = seleccionado && pj ? 'activo' : (pj ? '' : 'vacio');
  return `
    <div class="hxc-slot ${actCls}" style="${vars}"
      onclick="window._hxcClickSlot('${grupo}',${idx})">
      ${inner}
      ${invPanel}
    </div>`;
}

function _renderInvPanel(pj, grupo, idx, color) {
  const inv = hxState.inventarioPJ[pj.nombre] || [];
  const busq = hxState.busquedaHz.toLowerCase();
  const filtrado = busq
    ? inv.filter(h => (h.nombre||'').toLowerCase().includes(busq) || (h.afinidad||'').toLowerCase().includes(busq))
    : inv;
  const vars = _colorVars(color);

  const rows = filtrado.length > 0
    ? filtrado.map(h => `
        <div class="hxc-inv-hz" style="${vars}"
          onclick="event.stopPropagation(); window._hxcAgregarHz('${grupo}',${idx},'${_norm(h.hechizo_id||h.nombre)}')">
          <div>
            <div class="hxc-inv-hz-nombre">${h.nombre}</div>
            <div class="hxc-inv-hz-afin">${h.afinidad || '—'}</div>
          </div>
          <span class="hxc-inv-hz-cost">${h.hex_cost || 0}</span>
        </div>`).join('')
    : `<div class="hxc-inv-empty">${busq ? 'Sin resultados' : 'Sin hechizos'}</div>`;

  return `<div class="hxc-inv-panel" style="${vars}" onclick="event.stopPropagation()">
    <div class="hxc-inv-header">
      <span class="hxc-inv-nombre">${pj.nombre}</span>
      <button class="hxc-inv-close" onclick="event.stopPropagation();window._hxcCerrarInv()">×</button>
    </div>
    <input class="hxc-inv-search" placeholder="Buscar hechizo..."
      value="${hxState.busquedaHz}"
      oninput="event.stopPropagation();window._hxcBuscarHz(this.value)"
      onclick="event.stopPropagation()">
    <div class="hxc-inv-list">${rows}</div>
  </div>`;
}

function _renderCenter() {
  const turnoNum = hxState.turnoActivo?.numero ?? 1;
  const turnosLen = hxState.turnos.length;
  const stack = _renderStack();
  return `
    <div class="hxc-center">
      <div class="hxc-center-top">
        <span class="hxc-turno-label">Turno <strong>${turnoNum}</strong> · ${turnosLen} en sesión</span>
        <button class="hxc-btn-nuevo-turno" onclick="window._hxcNuevoTurno()">+ Turno</button>
        <button class="hxc-btn-confirmar" onclick="window._hxcConfirmar()">Confirmar ›</button>
      </div>
      <div class="hxc-stack" id="hxc-stack-list">
        ${stack}
      </div>
    </div>`;
}

function _renderStack() {
  if (hxState.stack.length === 0) {
    return `<div class="hxc-stack-empty">
      Selecciona un personaje a la izquierda o derecha<br>
      y luego un hechizo de su inventario.<br>
      <span style="color:#1a1a28;">Se apilan aquí para el turno.</span>
    </div>`;
  }

  return hxState.stack.map((item, i) => {
    const vars  = _colorVars(item.color);
    const priCls = item.esPrioridad ? 'prioridad' : '';
    const resCls = item.resultado ? `res-${item.resultado}` : '';
    const dado   = item.dado !== '' ? item.dado : '';
    const multStr = item.mult > 1 ? `×${item.mult.toFixed(1)} CD` : '';

    let resHtml = '';
    if (item.resultado === 'exito')     resHtml = `<span class="hxc-item-resultado hxc-res-exito">¡Éxito!</span>`;
    else if (item.resultado === 'fallo') resHtml = `<span class="hxc-item-resultado hxc-res-fallo">¡Fallo!</span>`;
    else if (item.resultado === 'infalible') resHtml = `<span class="hxc-item-resultado hxc-res-infalible">Infalible</span>`;
    else resHtml = `<span class="hxc-item-resultado" style="color:#2a2a3a;">${item.costoEfectivo} HEX</span>`;

    let detail = '';
    if (item.abierto) {
      const nc = item.ncCalc !== null ? item.ncCalc : '—';
      const ncReq = item.costoEfectivo;
      detail = `
        <div class="hxc-item-detail">
          <div class="hxc-detail-opts">
            <button class="hxc-opt-btn ${item.cobrarHex ? 'on' : ''}"
              onclick="event.stopPropagation();window._hxcToggleOpt(${i},'cobrarHex')">
              💰 Cobrar HEX
            </button>
            <button class="hxc-opt-btn ${item.infalible ? 'on' : ''}"
              onclick="event.stopPropagation();window._hxcToggleOpt(${i},'infalible')">
              ⚡ Infalible
            </button>
            <button class="hxc-opt-btn ${item.esPrioridad ? 'on' : ''}"
              onclick="event.stopPropagation();window._hxcSetPrioridad(${i})">
              ↑ Prioridad
            </button>
          </div>
          <div class="hxc-detail-info">
            <span>Afinidad:</span> ${item.afinidadEfectiva} &nbsp;
            <span>Costo:</span> ${item.costoBase}${item.mult > 1 ? ` → <b style="color:#e8a030;">${item.costoEfectivo}</b>` : ''} &nbsp;
            <span>Afinidad Hz:</span> ${item.hechizo.afinidad || '—'}
          </div>
          ${item.ncCalc !== null ? `<div class="hxc-nc-calc">NC: <strong>${nc}</strong> / requerido: ${ncReq}</div>` : ''}
          ${item.hechizo.resumen ? `<div class="hxc-detail-info" style="margin-top:5px;color:#3a3a58;">${item.hechizo.resumen}</div>` : ''}
        </div>`;
    }

    return `
      <div class="hxc-item ${priCls} ${resCls}" style="${vars}" data-hxc-idx="${i}">
        <div class="hxc-item-row" onclick="window._hxcToggleItem(${i})">
          <div class="hxc-item-color-dot"></div>
          <span class="hxc-item-pj">${item.pjNombre}</span>
          <span class="hxc-item-hz">${item.hechizo.nombre}</span>
          ${item.esPrioridad ? `<span class="hxc-prioridad-flag">↑</span>` : ''}
          ${multStr ? `<span class="hxc-item-mult">${multStr}</span>` : ''}
          <div class="hxc-item-dado-wrap">
            <input class="hxc-item-dado" type="number" min="1" max="100"
              placeholder="d100" value="${dado}"
              data-hxc-item="${i}"
              onclick="event.stopPropagation()"
              onchange="window._hxcSetDado(${i},this.value)"
              oninput="window._hxcSetDado(${i},this.value)">
          </div>
          ${resHtml}
          <button class="hxc-item-del" onclick="event.stopPropagation();window._hxcRemover(${i})" title="Quitar">×</button>
        </div>
        ${detail}
      </div>`;
  }).join('');
}

function _bindDadoInputs() {
  // Ya están manejados con data-attributes y globals
}

// ── Montaje del DOM ───────────────────────────────────────────
function _montar() {
  if (document.getElementById('hxc-trigger')) return;

  _css();

  // Trigger button
  const btn = document.createElement('button');
  btn.id = 'hxc-trigger';
  btn.textContent = '✦ HexCast';
  btn.onclick = () => abrirHexCast();
  document.body.appendChild(btn);

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = 'hxc-overlay';
  overlay.onclick = () => cerrarHexCast();
  document.body.appendChild(overlay);

  // Drawer
  const drawer = document.createElement('div');
  drawer.id = 'hxc-drawer';
  drawer.innerHTML = '<div class="hxc-handle"></div>';
  document.body.appendChild(drawer);
}

// ── API pública ───────────────────────────────────────────────
export async function abrirHexCast() {
  _montar();
  // Cargar catálogo si no está
  if (hxState.catalogoDB.length === 0) await cargarCatalogo();
  // Cargar sesiones
  await cargarSesiones();

  const overlay = document.getElementById('hxc-overlay');
  const drawer  = document.getElementById('hxc-drawer');
  overlay.classList.add('open');
  drawer.classList.add('open');

  _render();
}

export function cerrarHexCast() {
  document.getElementById('hxc-overlay')?.classList.remove('open');
  document.getElementById('hxc-drawer')?.classList.remove('open');
}

// ── Globals de eventos ────────────────────────────────────────
window._hxcCerrar = cerrarHexCast;

window._hxcVolverSesiones = () => {
  hxState.vistaActiva = 'sesiones';
  hxState.sesionActiva = null;
  hxState.turnoActivo = null;
  hxState.stack = [];
  hxState.grupoA = [null,null,null];
  hxState.grupoB = [null,null,null];
  hxState.pjSeleccionado = null;
  _render();
};

window._hxcSelSesion = async (id) => {
  try {
    await seleccionarSesion(id);
    hxState.vistaActiva = 'cast';
    _render();
  } catch(e) { _toast('Error cargando sesión', true); }
};

window._hxcModalNuevaSesion = () => {
  const backdrop = document.createElement('div');
  backdrop.className = 'hxc-modal-backdrop';
  backdrop.innerHTML = `
    <div class="hxc-modal" onclick="event.stopPropagation()">
      <div class="hxc-modal-title">Nueva Sesión</div>
      <label>Nombre</label>
      <input id="hxc-ns-nombre" placeholder="Sesión 1, Batalla del bosque...">
      <label>Descripción (opcional)</label>
      <textarea id="hxc-ns-desc" rows="2" placeholder="Contexto de la sesión..."></textarea>
      <div class="hxc-modal-footer">
        <button class="hxc-btn-cancel-modal" onclick="this.closest('.hxc-modal-backdrop').remove()">Cancelar</button>
        <button class="hxc-btn-ok-modal" onclick="window._hxcCrearSesion()">Crear</button>
      </div>
    </div>`;
  backdrop.onclick = () => backdrop.remove();
  document.body.appendChild(backdrop);
  setTimeout(() => document.getElementById('hxc-ns-nombre')?.focus(), 50);
};

window._hxcCrearSesion = async () => {
  const nombre = document.getElementById('hxc-ns-nombre')?.value.trim();
  if (!nombre) { _toast('El nombre es requerido', true); return; }
  const desc = document.getElementById('hxc-ns-desc')?.value.trim() || '';
  try {
    await crearSesion(nombre, desc);
    document.querySelector('.hxc-modal-backdrop')?.remove();
    _render();
    _toast('Sesión creada');
  } catch(e) { _toast('Error al crear sesión', true); }
};

// Click en slot: si vacío → abrir selector de PJ; si tiene PJ → toggle inventario
window._hxcClickSlot = async (grupo, idx) => {
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const pj = slots[idx];

  if (!pj) {
    // Abrir selector de PJ
    _abrirSelectorPJ(grupo, idx);
    return;
  }

  // Toggle inventario
  const actual = hxState.pjSeleccionado;
  if (actual?.nombre === pj.nombre && actual?.grupo === grupo && actual?.idx === idx) {
    hxState.pjSeleccionado = null;
  } else {
    hxState.pjSeleccionado = { nombre: pj.nombre, grupo, idx };
    hxState.busquedaHz = '';
    await cargarInventarioPJ(pj.nombre);
  }
  _render();
};

function _abrirSelectorPJ(grupo, idx) {
  // Filtrar PJs ya asignados
  const asignados = new Set([
    ...hxState.grupoA.filter(Boolean).map(p => p.nombre),
    ...hxState.grupoB.filter(Boolean).map(p => p.nombre)
  ]);
  const disponibles = Object.entries(personajes)
    .filter(([n]) => !asignados.has(n))
    .sort(([a],[b]) => a.localeCompare(b));

  const rows = disponibles.map(([nombre, p]) => `
    <div class="hxc-pj-row" onclick="window._hxcAsignarPJ('${grupo}',${idx},'${nombre.replace(/'/g,"\\'")}')">
      <img src="${imgPj(nombre)}" onerror="this.src='${imgFallback()}'">
      <div class="hxc-pj-row-info">
        <div class="hxc-pj-row-nombre">${nombre}</div>
        <div class="hxc-pj-row-hex">${p.hex ?? 0} HEX</div>
      </div>
    </div>`).join('');

  const backdrop = document.createElement('div');
  backdrop.className = 'hxc-modal-backdrop';
  backdrop.innerHTML = `
    <div class="hxc-pj-modal" onclick="event.stopPropagation()">
      <div class="hxc-pj-modal-title">Asignar personaje — Grupo ${grupo}</div>
      <div class="hxc-pj-modal-list">${rows || '<div style="color:#333;font-size:0.7em;padding:12px;">Sin personajes disponibles</div>'}</div>
    </div>`;
  backdrop.onclick = () => backdrop.remove();
  document.body.appendChild(backdrop);
}

window._hxcAsignarPJ = (grupo, idx, nombre) => {
  document.querySelector('.hxc-modal-backdrop')?.remove();
  const color = SLOT_COLORS[grupo][idx];
  const pjObj = { nombre, color };
  if (grupo === 'A') hxState.grupoA[idx] = pjObj;
  else               hxState.grupoB[idx] = pjObj;

  // Cargar cooldowns del PJ
  const { initCdPj: _init } = { initCdPj: (n) => {
    const p = personajes[n];
    if (!p) return;
    hxState.cdPorPj[n] = {
      fisica:     p.cd_fisica     ?? 0.5,
      energetica: p.cd_energetica ?? 0.5,
      espiritual: p.cd_espiritual ?? 0.5,
      mando:      p.cd_mando      ?? 0.5,
      psiquica:   p.cd_psiquica   ?? 0.5,
      oscura:     p.cd_oscura     ?? 0.5,
    };
  }};
  const p = personajes[nombre];
  if (p) {
    hxState.cdPorPj[nombre] = {
      fisica:     p.cd_fisica     ?? 0.5,
      energetica: p.cd_energetica ?? 0.5,
      espiritual: p.cd_espiritual ?? 0.5,
      mando:      p.cd_mando      ?? 0.5,
      psiquica:   p.cd_psiquica   ?? 0.5,
      oscura:     p.cd_oscura     ?? 0.5,
    };
  }
  _render();
};

window._hxcCerrarInv = () => {
  hxState.pjSeleccionado = null;
  _render();
};

window._hxcBuscarHz = (val) => {
  hxState.busquedaHz = val;
  _render();
};

window._hxcAgregarHz = (grupo, idx, hzId) => {
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const pj = slots[idx];
  if (!pj) return;

  // Buscar hechizo en catálogo o inventario
  const inv = hxState.inventarioPJ[pj.nombre] || [];
  const hz = hxState.catalogoDB.find(h => _norm(h.hechizo_id) === hzId || _norm(h.nombre) === hzId)
    || inv.find(h => _norm(h.hechizo_id||h.nombre) === hzId);
  if (!hz) return;

  agregarHechizo(pj.nombre, grupo, idx, hz);
  _render();
};

window._hxcToggleItem = (idx) => {
  hxState.stack[idx].abierto = !hxState.stack[idx].abierto;
  _render();
};

window._hxcSetDado = (idx, val) => {
  const item = hxState.stack[idx];
  if (!item) return;
  item.dado = val;
  evaluarItem(item);
  // Solo actualizar el resultado visualmente sin re-render completo
  const el = document.querySelector(`[data-hxc-idx="${idx}"]`);
  if (el) {
    // Re-render solo del resultado
    _actualizarResultadoEl(el, item);
  }
};

function _actualizarResultadoEl(el, item) {
  const resEl = el.querySelector('.hxc-item-resultado');
  if (!resEl) return;
  // Limpiar clases resultado
  el.classList.remove('res-exito','res-fallo','res-infalible');
  if (item.resultado === 'exito') {
    resEl.innerHTML = '¡Éxito!'; resEl.className = 'hxc-item-resultado hxc-res-exito';
    el.classList.add('res-exito');
  } else if (item.resultado === 'fallo') {
    resEl.innerHTML = '¡Fallo!'; resEl.className = 'hxc-item-resultado hxc-res-fallo';
    el.classList.add('res-fallo');
  } else if (item.resultado === 'infalible') {
    resEl.innerHTML = 'Infalible'; resEl.className = 'hxc-item-resultado hxc-res-infalible';
    el.classList.add('res-infalible');
  } else {
    resEl.innerHTML = `${item.costoEfectivo} HEX`; resEl.className = 'hxc-item-resultado';
    resEl.style.color = '#2a2a3a';
  }
}

window._hxcToggleOpt = (idx, campo) => {
  const item = hxState.stack[idx];
  if (!item) return;
  item[campo] = !item[campo];
  if (campo === 'infalible') evaluarItem(item);
  _render();
};

window._hxcSetPrioridad = (idx) => {
  moverAPrioridad(hxState.stack[idx].id);
  _render();
};

window._hxcRemover = (idx) => {
  const item = hxState.stack[idx];
  if (!item) return;
  removerHechizo(item.id);
  _render();
};

window._hxcNuevoTurno = async () => {
  if (!hxState.sesionActiva) return;
  // Primero confirmar si hay stack
  if (hxState.stack.length > 0) {
    if (!confirm('¿Confirmar el turno actual y comenzar uno nuevo?')) return;
    const res = await confirmarTurno();
    if (!res.ok) { _toast('Error: ' + res.msg, true); return; }
    _toast('Turno confirmado');
  } else {
    const nuevoNum = hxState.turnos.length + 1;
    hxState.turnoActivo = await crearTurno(hxState.sesionActiva.id, nuevoNum);
  }
  _render();
};

window._hxcConfirmar = async () => {
  if (hxState.stack.length === 0) { _toast('El stack está vacío', true); return; }
  const res = await confirmarTurno();
  if (!res.ok) { _toast('Error: ' + res.msg, true); return; }
  _toast('✦ Turno confirmado — Turno ' + (hxState.turnoActivo?.numero ?? ''));
  _render();
};

// ── Auto-montaje ──────────────────────────────────────────────
_montar();
