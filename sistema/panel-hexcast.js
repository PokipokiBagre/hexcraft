// ============================================================
// panel-hexcast.js — UI del sistema HexCast
// ============================================================

import { supabase } from '../hex-auth.js';
import { personajes } from './personajes-state.js';
import { hxState, SLOT_COLORS } from './hexcast-state.js';
import {
  _norm, imgPj, imgFallback,
  cargarSesiones, crearSesion, seleccionarSesion, crearTurno,
  cargarInventarioPJ, cargarCatalogo,
  agregarHechizo, removerHechizo, moverAPrioridad,
  evaluarItem, confirmarTurno, getAfinidadEfectiva
} from './hexcast-logic.js';

// ── Estilos ───────────────────────────────────────────────────
function _css() {
  if (document.getElementById('hexcast-styles')) return;
  const st = document.createElement('style');
  st.id = 'hexcast-styles';
  st.textContent = `
/* ══ TRIGGER ══ */
#hxc-trigger {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: rgba(10,6,24,0.95); border: 1px solid rgba(212,175,55,0.4);
  border-radius: 24px; color: #d4af37; font-family: 'Cinzel', serif;
  font-size: 0.8em; letter-spacing: 1.5px; padding: 10px 26px;
  cursor: pointer; z-index: 1100; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  transition: background 0.15s, box-shadow 0.15s; white-space: nowrap; user-select: none;
}
#hxc-trigger:hover { background: rgba(212,175,55,0.12); box-shadow: 0 4px 28px rgba(212,175,55,0.18); }

/* ══ OVERLAY ══ */
#hxc-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 1200; opacity: 0; pointer-events: none; transition: opacity 0.28s;
}
#hxc-overlay.open { opacity: 1; pointer-events: all; }

/* ══ DRAWER ══ */
#hxc-drawer {
  position: fixed; left: 0; right: 0; bottom: 0; height: 90vh;
  background: #08070f; border-top: 1px solid rgba(212,175,55,0.2);
  border-radius: 16px 16px 0 0; z-index: 1201;
  display: flex; flex-direction: column;
  transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
  font-family: 'Inter', system-ui, sans-serif;
  box-shadow: 0 -8px 48px rgba(0,0,0,0.7);
}
#hxc-drawer.open { transform: translateY(0); }

.hxc-handle {
  width: 40px; height: 4px; background: rgba(255,255,255,0.15);
  border-radius: 2px; margin: 10px auto 0; flex-shrink: 0; cursor: grab;
}

/* ══ HEADER ══ */
.hxc-header {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 18px 10px; border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.hxc-header-title {
  font-family: 'Cinzel', serif; font-size: 0.88em; color: #d4af37;
  letter-spacing: 2px; text-transform: uppercase; flex: 1;
}
.hxc-header-sub {
  font-size: 0.7em; color: #666; cursor: pointer; padding: 3px 8px;
  border-radius: 4px; transition: color 0.15s;
}
.hxc-header-sub:hover { color: #aaa; }
.hxc-btn-close {
  background: none; border: none; color: #444; font-size: 1.4em;
  cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: color 0.15s; line-height: 1;
}
.hxc-btn-close:hover { color: #ccc; }

/* ══ BODY 3 COLS ══ */
.hxc-body {
  flex: 1; display: grid;
  grid-template-columns: 190px 1fr 190px;
  overflow: hidden;
}

/* ══ COLUMNAS LATERALES ══ */
.hxc-col {
  display: flex; flex-direction: column;
  border-right: 1px solid rgba(255,255,255,0.06); overflow: hidden;
}
.hxc-col-b { border-right: none; border-left: 1px solid rgba(255,255,255,0.06); }
.hxc-col-title {
  font-size: 0.56em; letter-spacing: 2.5px; text-transform: uppercase;
  color: #555; padding: 8px 14px 5px; flex-shrink: 0; font-weight: 700;
}

/* ══ SLOTS ══ */
.hxc-slot {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  cursor: pointer; position: relative; overflow: hidden;
  transition: background 0.15s;
}
.hxc-slot:last-child { border-bottom: none; }
.hxc-slot-inner {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 6px; height: 100%; padding: 10px 12px;
  transition: background 0.15s;
}
.hxc-slot:hover .hxc-slot-inner { background: rgba(255,255,255,0.025); }
.hxc-slot.activo .hxc-slot-inner { background: var(--slot-bg); }
.hxc-slot.activo { box-shadow: inset 3px 0 0 var(--slot-border); }
.hxc-slot.vacio .hxc-slot-inner { opacity: 0.5; }

.hxc-slot-avatar {
  width: 42px; height: 42px; border-radius: 8px;
  object-fit: cover; object-position: top;
  border: 2px solid var(--slot-border); background: #111; flex-shrink: 0;
}
.hxc-slot-nombre {
  font-size: 0.68em; font-weight: 700; color: #fff;
  text-align: center; line-height: 1.2; width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hxc-slot-plus { font-size: 1.6em; color: rgba(255,255,255,0.2); transition: color 0.15s; }
.hxc-slot:hover .hxc-slot-plus { color: rgba(255,255,255,0.4); }
.hxc-slot-hex { font-size: 0.6em; color: #666; font-family: 'Cinzel', serif; }
.hxc-slot-label { font-size: 0.58em; color: #444; margin-top: 2px; }

/* ══ INVENTARIO PANEL ══ */
.hxc-inv-panel {
  position: absolute; inset: 0; background: rgba(8,7,15,0.98);
  display: flex; flex-direction: column; z-index: 2;
  border: 1px solid var(--slot-border); border-radius: 4px; overflow: hidden;
}
.hxc-inv-header {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px 6px; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
}
.hxc-inv-nombre { font-size: 0.72em; font-weight: 700; color: #fff; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hxc-inv-close { background: none; border: none; color: #555; font-size: 1em; cursor: pointer; padding: 1px 5px; }
.hxc-inv-close:hover { color: #ccc; }
.hxc-inv-search {
  margin: 6px 8px 4px; background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12); border-radius: 5px;
  color: #fff; font-size: 0.72em; padding: 5px 8px; outline: none; font-family: inherit; flex-shrink: 0;
}
.hxc-inv-search::placeholder { color: #444; }
.hxc-inv-search:focus { border-color: var(--slot-border); }
.hxc-inv-list { flex: 1; overflow-y: auto; padding: 4px 6px 8px; scrollbar-width: thin; }
.hxc-inv-hz {
  display: flex; align-items: center; gap: 6px; padding: 7px 8px;
  border-radius: 5px; cursor: pointer; border: 1px solid transparent; margin-bottom: 3px;
  transition: background 0.12s, border-color 0.12s;
}
.hxc-inv-hz:hover { background: var(--slot-bg); border-color: var(--slot-border); }
.hxc-inv-hz-nombre { font-size: 0.72em; color: #eee; flex: 1; line-height: 1.2; }
.hxc-inv-hz-afin { font-size: 0.6em; color: #666; white-space: nowrap; }
.hxc-inv-hz-cost { font-size: 0.64em; color: #d4af37; font-family: 'Cinzel', serif; flex-shrink: 0; }
.hxc-inv-empty { font-size: 0.7em; color: #333; text-align: center; padding: 20px 8px; }

/* ══ COLUMNA CENTRAL ══ */
.hxc-center { display: flex; flex-direction: column; overflow: hidden; }
.hxc-center-top {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px 8px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
}
.hxc-turno-label { font-size: 0.65em; color: #777; letter-spacing: 0.5px; flex: 1; }
.hxc-turno-label strong { color: #bbb; }

/* Selector de turno */
.hxc-turno-nav { display: flex; align-items: center; gap: 6px; }
.hxc-turno-nav-btn {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  color: #888; font-size: 0.75em; width: 24px; height: 24px; border-radius: 4px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.12s, color 0.12s;
}
.hxc-turno-nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #fff; }
.hxc-turno-nav-btn:disabled { opacity: 0.3; cursor: default; }
.hxc-turno-select {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  color: #ccc; font-size: 0.65em; padding: 3px 8px; border-radius: 4px;
  font-family: inherit; cursor: pointer; outline: none;
}
.hxc-turno-select option { background: #0d0c1a; }

.hxc-btn-confirmar {
  background: rgba(212,175,55,0.12); border: 1px solid rgba(212,175,55,0.4);
  color: #d4af37; font-size: 0.72em; font-family: 'Cinzel', serif;
  letter-spacing: 0.8px; padding: 7px 16px; border-radius: 6px;
  cursor: pointer; transition: background 0.15s;
}
.hxc-btn-confirmar:hover { background: rgba(212,175,55,0.25); }
.hxc-btn-nuevo-turno {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  color: #888; font-size: 0.65em; padding: 6px 12px; border-radius: 5px;
  cursor: pointer; transition: background 0.12s; font-family: inherit;
}
.hxc-btn-nuevo-turno:hover { background: rgba(255,255,255,0.09); color: #ccc; }

.hxc-stack { flex: 1; overflow-y: auto; padding: 10px 14px 14px; scrollbar-width: thin; }
.hxc-stack-empty {
  text-align: center; padding: 50px 20px;
  font-size: 0.75em; color: #333; line-height: 1.9;
}

/* ══ ITEMS DEL STACK ══ */
.hxc-item {
  border-radius: 8px; border: 1px solid var(--slot-border);
  background: var(--slot-bg); margin-bottom: 7px;
  transition: box-shadow 0.15s; overflow: hidden;
}
.hxc-item.prioridad { box-shadow: 0 0 14px var(--slot-glow); }
.hxc-item.res-exito  { border-color: rgba(62,207,110,0.5); }
.hxc-item.res-fallo  { border-color: rgba(224,64,64,0.5); }
.hxc-item.res-infalible { border-color: rgba(212,175,55,0.6); }

.hxc-item-row {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; cursor: pointer;
}
.hxc-item-color-dot {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--slot-border); flex-shrink: 0;
}
.hxc-item-pj {
  font-size: 0.68em; font-weight: 700; color: var(--slot-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;
}
.hxc-item-hz { font-size: 0.78em; color: #fff; flex: 1; line-height: 1.2; font-weight: 500; }
.hxc-item-mult { font-size: 0.62em; color: #e8a030; white-space: nowrap; font-family: 'Cinzel', serif; }
.hxc-prioridad-flag { font-size: 0.62em; color: #d4af37; }

/* Dado */
.hxc-item-dado-wrap { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.hxc-item-dado {
  width: 54px; background: rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.18); border-radius: 5px;
  color: #fff; font-size: 0.8em; text-align: center; padding: 5px 4px;
  font-family: 'Cinzel', serif; outline: none; transition: border-color 0.15s;
  -moz-appearance: textfield;
}
.hxc-item-dado::-webkit-inner-spin-button,
.hxc-item-dado::-webkit-outer-spin-button { -webkit-appearance: none; }
.hxc-item-dado:focus { border-color: var(--slot-border); background: rgba(0,0,0,0.7); }

.hxc-item-resultado {
  font-size: 0.72em; font-weight: 700; min-width: 60px; text-align: right;
  white-space: nowrap; font-family: 'Cinzel', serif;
}
.hxc-res-exito     { color: #3ecf6e; }
.hxc-res-fallo     { color: #e85050; }
.hxc-res-infalible { color: #d4af37; }

.hxc-item-del {
  background: none; border: none; color: #333; font-size: 1em;
  cursor: pointer; padding: 2px 6px; border-radius: 3px; transition: color 0.15s; flex-shrink: 0;
}
.hxc-item-del:hover { color: #e04040; }

/* ══ DETALLE COLAPSABLE ══ */
.hxc-item-detail {
  border-top: 1px solid rgba(255,255,255,0.07);
  padding: 10px 14px 12px; background: rgba(0,0,0,0.3);
}
.hxc-detail-opts { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 10px; }
.hxc-opt-btn {
  font-size: 0.65em; padding: 5px 12px; border-radius: 5px;
  cursor: pointer; border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.06); color: #aaa;
  transition: all 0.12s; font-family: inherit;
}
.hxc-opt-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
.hxc-opt-btn.on { background: var(--slot-bg); border-color: var(--slot-border); color: var(--slot-text); }

/* Stats del hechizo */
.hxc-detail-stats {
  display: flex; gap: 16px; flex-wrap: wrap;
  font-size: 0.68em; color: #999; margin-bottom: 8px;
  padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.hxc-detail-stats span { color: #ccc; font-weight: 600; }
.hxc-nc-calc {
  font-size: 0.7em; color: #aaa; margin-bottom: 8px;
  padding: 5px 10px; background: rgba(0,0,0,0.3); border-radius: 4px;
  border-left: 2px solid var(--slot-border);
}
.hxc-nc-calc strong { color: #fff; font-size: 1.1em; }

/* Campos de texto del hechizo */
.hxc-hz-field { margin-bottom: 6px; }
.hxc-hz-field-label {
  font-size: 0.58em; letter-spacing: 1.2px; text-transform: uppercase;
  color: var(--slot-text); opacity: 0.8; margin-bottom: 2px; font-weight: 700;
}
.hxc-hz-field-val { font-size: 0.7em; color: #ddd; line-height: 1.55; }

/* ══ SESIONES GRID ══ */
#hxc-view-sesiones { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.hxc-ses-wrap { max-width: 700px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; height: 100%; padding: 0 16px; box-sizing: border-box; }
.hxc-ses-top {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 0 14px; flex-shrink: 0;
}
.hxc-ses-title { font-family: 'Cinzel', serif; font-size: 0.9em; color: #d4af37; letter-spacing: 2px; text-transform: uppercase; }
.hxc-btn-nueva-ses {
  background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.35);
  color: #d4af37; font-size: 0.7em; padding: 7px 16px; border-radius: 6px;
  cursor: pointer; font-family: 'Cinzel', serif; transition: background 0.15s;
}
.hxc-btn-nueva-ses:hover { background: rgba(212,175,55,0.2); }

.hxc-ses-list {
  flex: 1; overflow-y: auto; padding-bottom: 20px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-content: start;
}
.hxc-ses-card {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px; padding: 14px 16px;
  cursor: pointer; transition: background 0.13s, border-color 0.13s;
  display: flex; align-items: center; gap: 12px;
}
.hxc-ses-card:hover { background: rgba(212,175,55,0.06); border-color: rgba(212,175,55,0.3); }
.hxc-ses-card-info { flex: 1; min-width: 0; }
.hxc-ses-card-nombre { font-size: 0.85em; font-weight: 600; color: #fff; margin-bottom: 4px; }
.hxc-ses-card-meta { font-size: 0.63em; color: #666; }
.hxc-ses-card-chevron { color: #444; font-size: 1em; flex-shrink: 0; }
.hxc-ses-empty { text-align: center; color: #333; font-size: 0.75em; padding: 40px 20px; line-height: 1.8; grid-column: 1/-1; }

/* ══ MODALES ══ */
.hxc-modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.65);
  z-index: 1300; display: flex; align-items: center; justify-content: center;
}
.hxc-modal {
  background: #0d0c1a; border: 1px solid rgba(212,175,55,0.28);
  border-radius: 12px; padding: 24px 28px; width: 380px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.8);
}
.hxc-modal-title { font-family: 'Cinzel', serif; font-size: 0.88em; color: #d4af37; margin-bottom: 16px; letter-spacing: 1px; }
.hxc-modal label { font-size: 0.7em; color: #999; display: block; margin-bottom: 4px; margin-top: 12px; }
.hxc-modal input, .hxc-modal textarea {
  width: 100%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px; color: #fff; font-size: 0.8em; padding: 8px 10px;
  font-family: inherit; outline: none; box-sizing: border-box;
}
.hxc-modal input::placeholder, .hxc-modal textarea::placeholder { color: #444; }
.hxc-modal input:focus, .hxc-modal textarea:focus { border-color: rgba(212,175,55,0.5); }
.hxc-modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; }
.hxc-btn-cancel-modal {
  background: none; border: 1px solid rgba(255,255,255,0.12); color: #777;
  font-size: 0.7em; padding: 7px 14px; border-radius: 5px; cursor: pointer; font-family: inherit;
}
.hxc-btn-cancel-modal:hover { color: #ccc; }
.hxc-btn-ok-modal {
  background: rgba(212,175,55,0.12); border: 1px solid rgba(212,175,55,0.4);
  color: #d4af37; font-size: 0.7em; padding: 7px 18px; border-radius: 5px;
  cursor: pointer; font-family: 'Cinzel', serif; transition: background 0.15s;
}
.hxc-btn-ok-modal:hover { background: rgba(212,175,55,0.25); }

/* ══ SELECTOR PJ ══ */
.hxc-pj-modal {
  background: #0d0c1a; border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px; padding: 16px 18px; width: 340px; max-height: 72vh;
  display: flex; flex-direction: column; box-shadow: 0 8px 40px rgba(0,0,0,0.8);
}
.hxc-pj-modal-title { font-size: 0.72em; color: #999; margin-bottom: 10px; letter-spacing: 1px; text-transform: uppercase; }
.hxc-pj-modal-list { overflow-y: auto; flex: 1; }
.hxc-pj-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 7px; cursor: pointer; transition: background 0.12s; }
.hxc-pj-row:hover { background: rgba(255,255,255,0.06); }
.hxc-pj-row img { width: 34px; height: 34px; border-radius: 6px; object-fit: cover; object-position: top; border: 1px solid rgba(255,255,255,0.12); background: #111; }
.hxc-pj-row-info { flex: 1; min-width: 0; }
.hxc-pj-row-nombre { font-size: 0.78em; color: #fff; }
.hxc-pj-row-hex { font-size: 0.62em; color: #666; font-family: 'Cinzel', serif; }

/* ══ TOAST ══ */
.hxc-toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  background: rgba(15,12,28,0.98); border: 1px solid rgba(212,175,55,0.35);
  color: #d4af37; font-size: 0.8em; padding: 10px 22px; border-radius: 8px;
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
  if (!el) { el = document.createElement('div'); el.id = 'hxc-toast'; el.className = 'hxc-toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.style.borderColor = err ? 'rgba(220,80,80,0.4)' : 'rgba(212,175,55,0.35)';
  el.style.color = err ? '#e07070' : '#d4af37';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

function _colorVars(color) {
  return `--slot-bg:${color.bg};--slot-border:${color.border};--slot-text:${color.text};--slot-glow:${color.glow};`;
}

// ── Render principal ──────────────────────────────────────────
function _render() {
  const drawer = document.getElementById('hxc-drawer');
  if (!drawer) return;
  if (hxState.vistaActiva === 'sesiones') _renderSesiones(drawer);
  else _renderCast(drawer);
}

// ── Vista: sesiones ───────────────────────────────────────────
function _renderSesiones(drawer) {
  const cards = hxState.sesiones.length > 0
    ? hxState.sesiones.map(s => {
        const d = new Date(s.actualizada_en || s.creada_en);
        const fecha = d.toLocaleDateString('es', { day:'numeric', month:'short', year:'numeric' });
        return `<div class="hxc-ses-card" onclick="window._hxcSelSesion(${s.id})">
          <div class="hxc-ses-card-info">
            <div class="hxc-ses-card-nombre">${s.nombre || 'Sesión ' + s.id}</div>
            <div class="hxc-ses-card-meta">${fecha}${s.descripcion ? ' · ' + s.descripcion : ''}</div>
          </div>
          <span class="hxc-ses-card-chevron">›</span>
        </div>`;
      }).join('')
    : `<div class="hxc-ses-empty">Sin sesiones aún.<br>Crea una nueva para comenzar.</div>`;

  drawer.innerHTML = `
    <div class="hxc-handle"></div>
    <div class="hxc-header">
      <span class="hxc-header-title">✦ HexCast</span>
      <button class="hxc-btn-close" onclick="window._hxcCerrar()">×</button>
    </div>
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
  const sesNombre = hxState.sesionActiva?.nombre || 'Sesión';
  drawer.innerHTML = `
    <div class="hxc-handle"></div>
    <div class="hxc-header">
      <span class="hxc-header-title">✦ HexCast</span>
      <span class="hxc-header-sub" onclick="window._hxcVolverSesiones()">‹ ${sesNombre}</span>
      <span style="flex:1"></span>
      <button class="hxc-btn-close" onclick="window._hxcCerrar()">×</button>
    </div>
    <div class="hxc-body">
      ${_renderColGrupo('A')}
      ${_renderCenter()}
      ${_renderColGrupo('B')}
    </div>`;

  // Bind dado inputs: Enter/Tab salta al siguiente
  _bindDadoNav();
}

function _renderColGrupo(grupo) {
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const isB = grupo === 'B';
  return `
    <div class="hxc-col ${isB ? 'hxc-col-b' : ''}">
      <div class="hxc-col-title">Grupo ${grupo}</div>
      ${slots.map((pj, idx) => _renderSlot(pj, grupo, idx)).join('')}
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
      <span class="hxc-slot-label">Asignar PJ</span>
    </div>`;
  } else {
    const hex = personajes[pj.nombre]?.hex ?? '?';
    inner = `<div class="hxc-slot-inner">
      <img class="hxc-slot-avatar" src="${imgPj(pj.nombre)}" onerror="this.src='${imgFallback()}'" title="${pj.nombre}">
      <span class="hxc-slot-nombre">${pj.nombre}</span>
      <span class="hxc-slot-hex">${hex} HEX</span>
    </div>`;
  }

  const invPanel = (seleccionado && pj) ? _renderInvPanel(pj, grupo, idx, color) : '';
  const actCls = seleccionado && pj ? 'activo' : (pj ? '' : 'vacio');

  return `
    <div class="hxc-slot ${actCls}" style="${vars}" onclick="window._hxcClickSlot('${grupo}',${idx})">
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
    ? filtrado.map(h => {
        const hzKey = _norm(h.hechizo_id || h.nombre);
        return `<div class="hxc-inv-hz" style="${vars}"
          onclick="event.stopPropagation();window._hxcAgregarHz('${grupo}',${idx},'${hzKey}')">
          <div style="flex:1;min-width:0;">
            <div class="hxc-inv-hz-nombre">${h.nombre}</div>
            <div class="hxc-inv-hz-afin">${h.afinidad || '—'}</div>
          </div>
          <span class="hxc-inv-hz-cost">${h.hex_cost || 0}</span>
        </div>`;
      }).join('')
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
  const turnoActivo = hxState.turnoActivo;
  const turnos = hxState.turnos;
  const turnoIdx = turnoActivo ? turnos.findIndex(t => t.id === turnoActivo.id) : turnos.length - 1;
  const turnoNum = turnoActivo?.numero ?? 1;
  const totalTurnos = turnos.length;

  // Selector de turno
  const turnoOptions = turnos.map((t, i) =>
    `<option value="${i}" ${i === turnoIdx ? 'selected' : ''}>Turno ${t.numero}${t.nombre ? ' — '+t.nombre : ''}</option>`
  ).join('');

  const navPrev = turnoIdx > 0
    ? `<button class="hxc-turno-nav-btn" onclick="window._hxcIrTurno(${turnoIdx-1})">‹</button>`
    : `<button class="hxc-turno-nav-btn" disabled>‹</button>`;
  const navNext = turnoIdx < totalTurnos - 1
    ? `<button class="hxc-turno-nav-btn" onclick="window._hxcIrTurno(${turnoIdx+1})">›</button>`
    : `<button class="hxc-turno-nav-btn" disabled>›</button>`;

  // Indicador si estamos viendo un turno pasado
  const esHistorico = turnoActivo && turnoIdx < totalTurnos - 1;
  const historicoBadge = esHistorico
    ? `<span style="font-size:0.6em;color:#e8a030;background:rgba(232,160,48,0.1);border:1px solid rgba(232,160,48,0.3);padding:2px 8px;border-radius:4px;">Vista histórica</span>`
    : '';

  return `
    <div class="hxc-center">
      <div class="hxc-center-top">
        <span class="hxc-turno-label">Turno <strong>${turnoNum}</strong> · ${totalTurnos} en sesión</span>
        ${historicoBadge}
        <div class="hxc-turno-nav">
          ${navPrev}
          <select class="hxc-turno-select" onchange="window._hxcIrTurno(this.value)">${turnoOptions}</select>
          ${navNext}
        </div>
        <button class="hxc-btn-nuevo-turno" onclick="window._hxcNuevoTurno()">+ Turno</button>
        ${!esHistorico ? `<button class="hxc-btn-confirmar" onclick="window._hxcConfirmar()">Confirmar ›</button>` : ''}
      </div>
      <div class="hxc-stack" id="hxc-stack-list">
        ${_renderStack(esHistorico)}
      </div>
    </div>`;
}

function _renderStack(esHistorico) {
  if (hxState.stack.length === 0) {
    if (esHistorico) {
      return `<div class="hxc-stack-empty" style="color:#444;">
        Turno histórico vacío o sin datos cargados.<br>
        <span style="font-size:0.85em;">Navega al último turno para lanzar hechizos.</span>
      </div>`;
    }
    return `<div class="hxc-stack-empty">
      Selecciona un personaje a la izquierda o derecha<br>
      y haz clic en un hechizo de su inventario.<br>
      <span style="color:#222;">Se apilan aquí para el turno.</span>
    </div>`;
  }

  return hxState.stack.map((item, i) => {
    const vars   = _colorVars(item.color);
    const priCls = item.esPrioridad ? 'prioridad' : '';
    const resCls = item.resultado ? `res-${item.resultado}` : '';
    const multStr = item.mult > 1 ? `×${item.mult.toFixed(1)} CD` : '';

    let resHtml;
    if (item.resultado === 'exito')      resHtml = `<span class="hxc-item-resultado hxc-res-exito">¡Éxito!</span>`;
    else if (item.resultado === 'fallo') resHtml = `<span class="hxc-item-resultado hxc-res-fallo">¡Fallo!</span>`;
    else if (item.resultado === 'infalible') resHtml = `<span class="hxc-item-resultado hxc-res-infalible">Infalible</span>`;
    else resHtml = `<span class="hxc-item-resultado" style="color:#555;">${item.costoEfectivo} HEX</span>`;

    let detail = '';
    if (item.abierto) {
      const nc    = item.ncCalc !== null ? item.ncCalc : null;
      const ncReq = item.costoEfectivo;
      const hz    = item.hechizo;

      // Campos de texto del hechizo — todos los que existan
      const campos = [
        { label: 'Resumen',   val: hz.resumen   },
        { label: 'Efecto',    val: hz.efecto     },
        { label: 'Overcast',  val: hz.overcast   },
        { label: 'Undercast', val: hz.undercast  },
        { label: 'Especial',  val: hz.especial   },
      ].filter(c => c.val && c.val.trim() && c.val !== '0' && c.val.toLowerCase() !== 'null');

      const camposHtml = campos.map(c => `
        <div class="hxc-hz-field">
          <div class="hxc-hz-field-label">${c.label}</div>
          <div class="hxc-hz-field-val">${c.val}</div>
        </div>`).join('');

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
          <div class="hxc-detail-stats">
            <div>Afinidad PJ: <span>${item.afinidadEfectiva}</span></div>
            <div>Costo base: <span>${item.costoBase}</span></div>
            ${item.mult > 1 ? `<div>Costo CD: <span style="color:#e8a030;">${item.costoEfectivo}</span></div>` : ''}
            <div>Afinidad Hz: <span>${hz.afinidad || '—'}</span></div>
            ${hz.clase ? `<div>Clase: <span>${hz.clase}</span></div>` : ''}
          </div>
          ${nc !== null ? `<div class="hxc-nc-calc">NC: <strong>${nc}</strong> / necesario: ${ncReq} — ${nc >= ncReq ? '<span style="color:#3ecf6e;">ÉXITO</span>' : '<span style="color:#e85050;">FALLO</span>'}</div>` : ''}
          ${camposHtml || '<div style="font-size:0.68em;color:#333;font-style:italic;">Sin descripción disponible.</div>'}
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
            <input class="hxc-item-dado" type="text" inputmode="numeric"
              placeholder="d100" value="${item.dado !== '' ? item.dado : ''}"
              data-hxc-item="${i}"
              onclick="event.stopPropagation()"
              oninput="window._hxcSetDado(${i},this.value)"
              onkeydown="window._hxcDadoKeydown(event,${i})">
          </div>
          ${resHtml}
          <button class="hxc-item-del" onclick="event.stopPropagation();window._hxcRemover(${i})" title="Quitar">×</button>
        </div>
        ${detail}
      </div>`;
  }).join('');
}

// Bind Enter/Tab para navegar entre dados sin flecha
function _bindDadoNav() {
  // Se maneja con onkeydown en el template
}

// ── Montaje ───────────────────────────────────────────────────
function _montar() {
  if (document.getElementById('hxc-trigger')) return;
  _css();

  const btn = document.createElement('button');
  btn.id = 'hxc-trigger'; btn.textContent = '✦ HexCast';
  btn.onclick = () => abrirHexCast();
  document.body.appendChild(btn);

  const overlay = document.createElement('div');
  overlay.id = 'hxc-overlay'; overlay.onclick = () => cerrarHexCast();
  document.body.appendChild(overlay);

  const drawer = document.createElement('div');
  drawer.id = 'hxc-drawer'; drawer.innerHTML = '<div class="hxc-handle"></div>';
  document.body.appendChild(drawer);
}

// ── API pública ───────────────────────────────────────────────
export async function abrirHexCast() {
  _montar();
  if (hxState.catalogoDB.length === 0) await cargarCatalogo();
  await cargarSesiones();
  document.getElementById('hxc-overlay')?.classList.add('open');
  document.getElementById('hxc-drawer')?.classList.add('open');
  _render();
}

export function cerrarHexCast() {
  document.getElementById('hxc-overlay')?.classList.remove('open');
  document.getElementById('hxc-drawer')?.classList.remove('open');
}

// ── Globals ───────────────────────────────────────────────────
window._hxcCerrar = cerrarHexCast;

window._hxcVolverSesiones = () => {
  hxState.vistaActiva = 'sesiones';
  hxState.sesionActiva = null; hxState.turnoActivo = null;
  hxState.stack = []; hxState.turnos = [];
  hxState.grupoA = [null,null,null]; hxState.grupoB = [null,null,null];
  hxState.pjSeleccionado = null;
  _render();
};

window._hxcSelSesion = async (id) => {
  try { await seleccionarSesion(id); hxState.vistaActiva = 'cast'; _render(); }
  catch(e) { _toast('Error cargando sesión', true); }
};

window._hxcModalNuevaSesion = () => {
  const backdrop = document.createElement('div');
  backdrop.className = 'hxc-modal-backdrop';
  backdrop.innerHTML = `
    <div class="hxc-modal" onclick="event.stopPropagation()">
      <div class="hxc-modal-title">Nueva Sesión</div>
      <label>Nombre</label>
      <input id="hxc-ns-nombre" placeholder="Batalla del bosque, Sesión 3...">
      <label>Descripción (opcional)</label>
      <textarea id="hxc-ns-desc" rows="2" placeholder="Contexto breve..."></textarea>
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
    _render(); _toast('Sesión creada');
  } catch(e) { _toast('Error al crear sesión', true); }
};

// Navegar a un turno por índice — carga sus lanzamientos si es histórico
window._hxcIrTurno = async (idxRaw) => {
  const idx = parseInt(idxRaw);
  const turno = hxState.turnos[idx];
  if (!turno) return;
  hxState.turnoActivo = turno;

  // Si es turno histórico, cargar sus lanzamientos
  const esUltimo = idx === hxState.turnos.length - 1;
  if (!esUltimo) {
    const { data } = await supabase
      .from('hexcast_lanzamientos')
      .select('*')
      .eq('turno_id', turno.id)
      .order('orden');
    // Reconstruir stack desde DB para visualización
    hxState.stack = (data || []).map(row => {
      const color = SLOT_COLORS[row.grupo]?.[
        (row.grupo === 'A' ? hxState.grupoA : hxState.grupoB).findIndex(p => p?.nombre === row.personaje_nombre)
      ] || SLOT_COLORS[row.grupo]?.[0] || SLOT_COLORS.A[0];
      return {
        id: row.id, pjNombre: row.personaje_nombre, grupo: row.grupo, slotIdx: 0,
        color,
        hechizo: {
          hechizo_id: row.hechizo_id, nombre: row.hechizo_nombre,
          afinidad: row.hechizo_afinidad, hex_cost: row.hechizo_hex_cost,
          resumen: '', efecto: '', overcast: '', undercast: '', especial: ''
        },
        infalible: row.infalible, cobrarHex: row.cobrar_hex, esPrioridad: row.es_prioridad,
        dado: row.dado_d100 ?? '', afinidadEfectiva: row.afinidad_efectiva,
        mult: row.multiplicador_cd, costoBase: row.hechizo_hex_cost,
        costoEfectivo: row.costo_efectivo, abierto: false,
        resultado: row.resultado, ncCalc: row.nc, hexGastado: row.hex_gastado
      };
    });
  } else {
    hxState.stack = [];
  }
  _render();
};

window._hxcClickSlot = async (grupo, idx) => {
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const pj = slots[idx];

  if (!pj) { _abrirSelectorPJ(grupo, idx); return; }

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
      <div class="hxc-pj-modal-list">${rows || '<div style="color:#444;font-size:0.7em;padding:12px;">Sin personajes disponibles</div>'}</div>
    </div>`;
  backdrop.onclick = () => backdrop.remove();
  document.body.appendChild(backdrop);
}

window._hxcAsignarPJ = (grupo, idx, nombre) => {
  document.querySelector('.hxc-modal-backdrop')?.remove();
  const color = SLOT_COLORS[grupo][idx];
  if (grupo === 'A') hxState.grupoA[idx] = { nombre, color };
  else               hxState.grupoB[idx] = { nombre, color };
  // Cargar cooldowns
  const p = personajes[nombre];
  if (p) {
    hxState.cdPorPj[nombre] = {
      fisica:     p.cd_fisica     ?? 0.5, energetica: p.cd_energetica ?? 0.5,
      espiritual: p.cd_espiritual ?? 0.5, mando:      p.cd_mando      ?? 0.5,
      psiquica:   p.cd_psiquica   ?? 0.5, oscura:     p.cd_oscura     ?? 0.5,
    };
  }
  _render();
};

window._hxcCerrarInv = () => { hxState.pjSeleccionado = null; _render(); };
window._hxcBuscarHz  = (val) => { hxState.busquedaHz = val; _render(); };

window._hxcAgregarHz = (grupo, idx, hzId) => {
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const pj = slots[idx];
  if (!pj) return;
  const inv = hxState.inventarioPJ[pj.nombre] || [];
  const hz = hxState.catalogoDB.find(h => _norm(h.hechizo_id) === hzId || _norm(h.nombre) === hzId)
          || inv.find(h => _norm(h.hechizo_id || h.nombre) === hzId);
  if (!hz) return;
  agregarHechizo(pj.nombre, grupo, idx, hz);
  _render();
};

window._hxcToggleItem = (idx) => {
  hxState.stack[idx].abierto = !hxState.stack[idx].abierto;
  _render();
};

// Dado: oninput → evalúa en tiempo real, actualiza solo el resultado
window._hxcSetDado = (idx, val) => {
  const item = hxState.stack[idx];
  if (!item) return;
  item.dado = val;
  evaluarItem(item);
  // Actualizar resultado sin re-render completo
  const el = document.querySelector(`[data-hxc-idx="${idx}"]`);
  if (el) _actualizarResultadoEl(el, item);
};

// Enter/Tab → foco al siguiente dado
window._hxcDadoKeydown = (e, idx) => {
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    const next = document.querySelector(`[data-hxc-item="${idx + 1}"]`);
    if (next) { next.focus(); next.select(); }
  }
};

function _actualizarResultadoEl(el, item) {
  const resEl = el.querySelector('.hxc-item-resultado');
  if (!resEl) return;
  el.classList.remove('res-exito','res-fallo','res-infalible');
  if (item.resultado === 'exito') {
    resEl.innerHTML = '¡Éxito!'; resEl.className = 'hxc-item-resultado hxc-res-exito'; el.classList.add('res-exito');
  } else if (item.resultado === 'fallo') {
    resEl.innerHTML = '¡Fallo!'; resEl.className = 'hxc-item-resultado hxc-res-fallo'; el.classList.add('res-fallo');
  } else if (item.resultado === 'infalible') {
    resEl.innerHTML = 'Infalible'; resEl.className = 'hxc-item-resultado hxc-res-infalible'; el.classList.add('res-infalible');
  } else {
    resEl.textContent = `${item.costoEfectivo} HEX`; resEl.className = 'hxc-item-resultado'; resEl.style.color = '#555';
  }
  // Actualizar nc-calc si está abierto
  const ncEl = el.querySelector('.hxc-nc-calc');
  if (ncEl && item.ncCalc !== null) {
    const nc = item.ncCalc; const ncReq = item.costoEfectivo;
    ncEl.innerHTML = `NC: <strong>${nc}</strong> / necesario: ${ncReq} — ${nc >= ncReq ? '<span style="color:#3ecf6e;">ÉXITO</span>' : '<span style="color:#e85050;">FALLO</span>'}`;
  }
}

window._hxcToggleOpt = (idx, campo) => {
  const item = hxState.stack[idx]; if (!item) return;
  item[campo] = !item[campo];
  if (campo === 'infalible') evaluarItem(item);
  _render();
};

window._hxcSetPrioridad = (idx) => {
  moverAPrioridad(hxState.stack[idx].id); _render();
};

window._hxcRemover = (idx) => {
  const item = hxState.stack[idx]; if (!item) return;
  removerHechizo(item.id); _render();
};

window._hxcNuevoTurno = async () => {
  if (!hxState.sesionActiva) return;
  if (hxState.stack.length > 0) {
    if (!confirm('¿Confirmar el turno actual y comenzar uno nuevo?')) return;
    const res = await confirmarTurno();
    if (!res.ok) { _toast('Error: ' + res.msg, true); return; }
    _toast('Turno confirmado');
  } else {
    const nuevoNum = hxState.turnos.length + 1;
    hxState.turnoActivo = await crearTurno(hxState.sesionActiva.id, nuevoNum);
    hxState.stack = [];
  }
  _render();
};

window._hxcConfirmar = async () => {
  if (hxState.stack.length === 0) { _toast('El stack está vacío', true); return; }
  const res = await confirmarTurno();
  if (!res.ok) { _toast('Error: ' + res.msg, true); return; }
  _toast('✦ Turno ' + (hxState.turnoActivo?.numero ?? '') + ' confirmado');
  _render();
};

// ── Auto-montaje ──────────────────────────────────────────────
_montar();
