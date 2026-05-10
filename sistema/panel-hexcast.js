// ============================================================
// panel-hexcast.js — UI del sistema HexCast
// ============================================================

import { supabase } from '../hex-auth.js';
import { personajes, estadoUI } from './personajes-state.js';
import { hxState, SLOT_COLORS } from './hexcast-state.js';
import {
  _norm, imgPj, imgFallback,
  cargarSesiones, crearSesion, seleccionarSesion, crearTurno,
  cargarInventarioPJ, cargarCatalogo, cargarHistorialSesion,
  agregarHechizo, removerHechizo, moverAPrioridad,
  evaluarItem, confirmarTurno, getAfinidadEfectiva
} from './hexcast-logic.js';
import { renderToolbarFlechas, renderCanalSVG, montarOverlay, observarStack, fxClickSlot, fxClickItem, fxMouseDownSlot, fxMouseDownItem, cargarFlechasTurno, resetFlechas } from './panel-hexcast-flechas.js';

// ── CSS ───────────────────────────────────────────────────────
function _css() {
  if (document.getElementById('hexcast-styles')) return;
  const st = document.createElement('style');
  st.id = 'hexcast-styles';
  st.textContent = `
#hxc-trigger {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: rgba(10,6,24,0.96); border: 1px solid rgba(212,175,55,0.4);
  border-radius: 24px; color: #d4af37; font-family: 'Cinzel', serif;
  font-size: 0.8em; letter-spacing: 1.5px; padding: 10px 28px;
  cursor: pointer; z-index: 1100; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  transition: background 0.15s, box-shadow 0.15s; white-space: nowrap; user-select: none;
}
#hxc-trigger:hover { background: rgba(212,175,55,0.12); box-shadow: 0 4px 28px rgba(212,175,55,0.18); }
#hxc-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1200; opacity: 0; pointer-events: none; transition: opacity 0.28s; }
#hxc-overlay.open { opacity: 1; pointer-events: all; }
#hxc-drawer { position: fixed; left: 0; right: 0; bottom: 0; height: 92vh; background: #08070f; border-top: 1px solid rgba(212,175,55,0.2); border-radius: 14px 14px 0 0; z-index: 1201; display: flex; flex-direction: column; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); font-family: 'Inter', system-ui, sans-serif; }
#hxc-drawer.open { transform: translateY(0); }
.hxc-handle { width: 36px; height: 4px; background: rgba(255,255,255,0.12); border-radius: 2px; margin: 8px auto 0; flex-shrink: 0; }
.hxc-header { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
.hxc-header-title { font-family: 'Cinzel', serif; font-size: 0.85em; color: #d4af37; letter-spacing: 2px; text-transform: uppercase; flex: 1; }
.hxc-header-sub { font-size: 0.68em; color: #666; cursor: pointer; padding: 3px 8px; border-radius: 4px; transition: color 0.15s; }
.hxc-header-sub:hover { color: #bbb; }
.hxc-btn-close { background: none; border: none; color: #444; font-size: 1.4em; cursor: pointer; padding: 2px 6px; line-height: 1; transition: color 0.15s; }
.hxc-btn-close:hover { color: #ccc; }
.hxc-body { flex: 1; display: grid; grid-template-columns: 160px 120px 1fr 120px 160px; overflow: hidden; position: relative; }
.hxc-col { display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.05); overflow: hidden; }
.hxc-col-b { border-right: none; border-left: 1px solid rgba(255,255,255,0.05); }
.hxc-col-title { font-size: 0.52em; letter-spacing: 2.5px; text-transform: uppercase; color: #888; padding: 6px 10px 4px; flex-shrink: 0; font-weight: 700; }
.hxc-slot { flex: 1; min-height: 0; display: flex; flex-direction: column; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; position: relative; overflow: hidden; }
.hxc-slot:last-child { border-bottom: none; }
.hxc-slot-inner { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; height: 100%; padding: 8px 10px; transition: background 0.15s; }
.hxc-slot:hover .hxc-slot-inner { background: rgba(255,255,255,0.025); }
.hxc-slot.activo .hxc-slot-inner { background: var(--slot-bg); }
.hxc-slot.activo { box-shadow: inset 3px 0 0 var(--slot-border); }
.hxc-slot.vacio .hxc-slot-inner { opacity: 0.45; }
.hxc-slot-avatar { width: 38px; height: 38px; border-radius: 7px; object-fit: cover; object-position: top; border: 2px solid var(--slot-border); background: #111; flex-shrink: 0; }
.hxc-slot-nombre { font-size: 0.65em; font-weight: 700; color: #fff; text-align: center; line-height: 1.2; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hxc-slot-hex { font-size: 0.57em; color: #666; font-family: 'Cinzel', serif; }
.hxc-slot-vex { font-size: 0.55em; color: #9060c0; font-family: 'Cinzel', serif; }
.hxc-slot-plus { font-size: 1.5em; color: rgba(255,255,255,0.55); transition: color 0.15s; }
.hxc-slot:hover .hxc-slot-plus { color: rgba(255,255,255,0.85); }
.hxc-slot-label { font-size: 0.55em; color: #888; margin-top: 2px; }
.hxc-slot-quit { position: absolute; top: 4px; right: 4px; background: none; border: none; color: #777; font-size: 0.75em; cursor: pointer; padding: 2px 4px; border-radius: 3px; opacity: 0; transition: opacity 0.15s, color 0.15s; }
.hxc-slot:hover .hxc-slot-quit { opacity: 1; }
.hxc-slot-quit:hover { color: #c44; }
.hxc-inv-panel { position: absolute; inset: 0; background: rgba(8,7,15,0.98); display: flex; flex-direction: column; z-index: 2; border: 1px solid var(--slot-border); border-radius: 4px; overflow: hidden; }
.hxc-inv-header { display: flex; align-items: center; gap: 5px; padding: 7px 9px 5px; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
.hxc-inv-nombre { font-size: 0.7em; font-weight: 700; color: #fff; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hxc-inv-close { background: none; border: none; color: #555; font-size: 1em; cursor: pointer; padding: 1px 5px; }
.hxc-inv-close:hover { color: #ccc; }
.hxc-inv-search { margin: 5px 7px 3px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 5px; color: #fff; font-size: 0.7em; padding: 5px 7px; outline: none; font-family: inherit; flex-shrink: 0; }
.hxc-inv-search::placeholder { color: #444; }
.hxc-inv-search:focus { border-color: var(--slot-border); }
.hxc-inv-list { flex: 1; overflow-y: auto; padding: 3px 5px 6px; scrollbar-width: thin; }
.hxc-inv-hz { display: flex; align-items: center; gap: 5px; padding: 6px 7px; border-radius: 5px; cursor: pointer; border: 1px solid transparent; margin-bottom: 3px; transition: background 0.12s; }
.hxc-inv-hz:hover { background: var(--slot-bg); border-color: var(--slot-border); }
.hxc-inv-hz-nombre { font-size: 0.7em; color: #eee; flex: 1; line-height: 1.2; }
.hxc-inv-hz-afin { font-size: 0.57em; color: #555; white-space: nowrap; }
.hxc-inv-hz-cost { font-size: 0.62em; color: #d4af37; font-family: 'Cinzel', serif; flex-shrink: 0; }
.hxc-inv-empty { font-size: 0.68em; color: #666; text-align: center; padding: 16px 6px; }
.hxc-center { display: flex; flex-direction: column; overflow: hidden; }
.hxc-center-top { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; padding: 7px 12px 6px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
.hxc-turno-label { font-size: 0.62em; color: #666; flex-shrink: 0; }
.hxc-turno-label strong { color: #bbb; }
.hxc-turno-nav { display: flex; align-items: center; gap: 5px; }
.hxc-turno-nav-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #888; font-size: 0.75em; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.12s; }
.hxc-turno-nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #fff; }
.hxc-turno-nav-btn:disabled { opacity: 0.28; cursor: default; }
.hxc-turno-select { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.13); color: #ccc; font-size: 0.63em; padding: 3px 7px; border-radius: 4px; font-family: inherit; cursor: pointer; outline: none; max-width: 150px; }
.hxc-turno-select option { background: #0d0c1a; }
.hxc-btn-confirmar { background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.4); color: #d4af37; font-size: 0.67em; font-family: 'Cinzel', serif; letter-spacing: 0.8px; padding: 5px 13px; border-radius: 5px; cursor: pointer; transition: background 0.15s; }
.hxc-btn-confirmar:hover { background: rgba(212,175,55,0.22); }
.hxc-btn-nuevo-turno { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #777; font-size: 0.62em; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-family: inherit; transition: background 0.12s; }
.hxc-btn-nuevo-turno:hover { background: rgba(255,255,255,0.09); color: #ccc; }
.hxc-btn-op { font-size: 0.61em; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-family: inherit; transition: all 0.12s; border: 1px solid; }
.hxc-btn-cobrar { background: rgba(212,175,55,0.08); border-color: rgba(212,175,55,0.35); color: #d4af37; }
.hxc-btn-cobrar:hover { background: rgba(212,175,55,0.2); }
.hxc-btn-devolver { background: rgba(62,207,110,0.07); border-color: rgba(62,207,110,0.3); color: #3ecf6e; }
.hxc-btn-devolver:hover { background: rgba(62,207,110,0.18); }
.hxc-btn-del-turno { background: rgba(200,60,60,0.07); border-color: rgba(200,60,60,0.3); color: #e06060; }
.hxc-btn-del-turno:hover { background: rgba(200,60,60,0.18); }
.hxc-badge-hist { font-size: 0.58em; color: #e8a030; background: rgba(232,160,48,0.1); border: 1px solid rgba(232,160,48,0.3); padding: 2px 7px; border-radius: 4px; }
.hxc-btn-guardar-hist { background: rgba(212,175,55,0.12); border: 1px solid rgba(212,175,55,0.5); color: #d4af37; font-size: 0.67em; font-family: 'Cinzel', serif; letter-spacing: 0.8px; padding: 5px 13px; border-radius: 5px; cursor: pointer; transition: background 0.15s; }
.hxc-btn-guardar-hist:hover { background: rgba(212,175,55,0.26); }
.hxc-stack { flex: 1; overflow-y: auto; padding: 8px 12px 10px; scrollbar-width: thin; }
.hxc-stack-empty { text-align: center; padding: 40px 16px; font-size: 0.72em; color: #666; line-height: 1.9; }
.hxc-item { border-radius: 7px; border: 1px solid var(--slot-border); background: var(--slot-bg); margin-bottom: 6px; overflow: hidden; transition: box-shadow 0.15s; }
.hxc-item.prioridad { box-shadow: 0 0 12px var(--slot-glow); }
.hxc-item.res-exito { border-color: rgba(62,207,110,0.5); }
.hxc-item.res-fallo { border-color: rgba(224,64,64,0.5); }
.hxc-item.res-infalible { border-color: rgba(212,175,55,0.55); }
.hxc-item.res-fallo_hex { border-color: rgba(232,160,48,0.55); }
.hxc-item-row { display: flex; align-items: center; gap: 7px; padding: 8px 10px; cursor: pointer; }
.hxc-item-color-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--slot-border); flex-shrink: 0; }
.hxc-item-pj { font-size: 0.65em; font-weight: 700; color: var(--slot-text); white-space: nowrap; max-width: 70px; overflow: hidden; text-overflow: ellipsis; }
.hxc-item-hz { font-size: 0.76em; color: #fff; flex: 1; line-height: 1.2; font-weight: 500; }
.hxc-item-mult { font-size: 0.6em; color: #e8a030; white-space: nowrap; font-family: 'Cinzel', serif; }
.hxc-prioridad-flag { font-size: 0.6em; color: #d4af37; }
.hxc-item-dado { width: 52px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.18); border-radius: 5px; color: #fff; font-size: 0.78em; text-align: center; padding: 4px 3px; font-family: 'Cinzel', serif; outline: none; transition: border-color 0.15s; -moz-appearance: textfield; }
.hxc-item-dado::-webkit-inner-spin-button, .hxc-item-dado::-webkit-outer-spin-button { -webkit-appearance: none; }
.hxc-item-dado:focus { border-color: var(--slot-border); background: rgba(0,0,0,0.7); }
.hxc-item-resultado { font-size: 0.7em; font-weight: 700; min-width: 58px; text-align: right; white-space: nowrap; font-family: 'Cinzel', serif; }
.hxc-res-exito { color: #3ecf6e; }
.hxc-res-fallo { color: #e85050; }
.hxc-res-infalible { color: #d4af37; }
.hxc-res-fallo_hex { color: #e8a030; }
.hxc-item-del { background: none; border: none; color: #666; font-size: 1em; cursor: pointer; padding: 2px 5px; border-radius: 3px; transition: color 0.15s; flex-shrink: 0; }
.hxc-item-del:hover { color: #e04040; }
.hxc-item-detail { border-top: 1px solid rgba(255,255,255,0.07); padding: 9px 12px 11px; background: rgba(0,0,0,0.28); }
.hxc-detail-opts { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 9px; }
.hxc-opt-btn { font-size: 0.63em; padding: 4px 11px; border-radius: 5px; cursor: pointer; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #aaa; transition: all 0.12s; font-family: inherit; }
.hxc-opt-btn:hover { background: rgba(255,255,255,0.11); color: #fff; }
.hxc-opt-btn.on { background: var(--slot-bg); border-color: var(--slot-border); color: var(--slot-text); }
.hxc-detail-stats { display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.66em; color: #888; margin-bottom: 7px; padding-bottom: 7px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.hxc-detail-stats span { color: #ddd; font-weight: 600; }
.hxc-nc-calc { font-size: 0.68em; color: #aaa; margin-bottom: 7px; padding: 4px 9px; background: rgba(0,0,0,0.3); border-radius: 4px; border-left: 2px solid var(--slot-border); }
.hxc-nc-calc strong { color: #fff; font-size: 1.1em; }
.hxc-hz-field { margin-bottom: 5px; }
.hxc-hz-field-label { font-size: 0.56em; letter-spacing: 1.2px; text-transform: uppercase; color: var(--slot-text); opacity: 0.75; margin-bottom: 2px; font-weight: 700; }
.hxc-hz-field-val { font-size: 0.68em; color: #ddd; line-height: 1.55; }
.hxc-gasto-row { font-size: 0.67em; color: #888; padding: 5px 9px; background: rgba(0,0,0,0.25); border-radius: 4px; margin-bottom: 7px; border-left: 2px solid rgba(255,255,255,0.08); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.hxc-cd-edit-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding: 5px 9px; background: rgba(232,160,48,0.06); border-radius: 4px; border-left: 2px solid rgba(232,160,48,0.3); }
.hxc-cd-edit-label { font-size: 0.6em; color: #e8a030; letter-spacing: 0.8px; text-transform: uppercase; white-space: nowrap; }
.hxc-cd-edit-input { width: 54px; background: rgba(0,0,0,0.5); border: 1px solid rgba(232,160,48,0.4); border-radius: 4px; color: #e8a030; font-size: 0.75em; text-align: center; padding: 3px 4px; font-family: 'Cinzel', serif; outline: none; -moz-appearance: textfield; }
.hxc-cd-edit-input::-webkit-inner-spin-button, .hxc-cd-edit-input::-webkit-outer-spin-button { -webkit-appearance: none; }
.hxc-cd-edit-input:focus { border-color: rgba(232,160,48,0.75); background: rgba(0,0,0,0.7); }
.hxc-cd-edit-btn { background: none; border: 1px solid rgba(232,160,48,0.3); border-radius: 3px; color: #e8a030; font-size: 0.72em; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: background 0.12s; line-height: 1; }
.hxc-cd-edit-btn:hover { background: rgba(232,160,48,0.18); }
.hxc-cd-edit-hint { font-size: 0.56em; color: #666; margin-left: 2px; }
.hxc-gasto-row.hxc-gasto-none { color: #333; border-left-color: rgba(255,255,255,0.04); }
.hxc-gasto-row.hxc-gasto-insuf { color: #e85050; border-left-color: rgba(232,80,80,0.4); background: rgba(232,80,80,0.05); }
.hxc-gasto-vex { color: #9060c0; font-weight: 600; font-family: 'Cinzel', serif; }
.hxc-gasto-hex { color: #d4af37; font-weight: 600; font-family: 'Cinzel', serif; }
.hxc-balance-panel { margin-top: 14px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; overflow: hidden; }
.hxc-balance-title { font-size: 0.54em; letter-spacing: 2px; text-transform: uppercase; color: #888; padding: 7px 12px 4px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.05); }
.hxc-bal-row { display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); border-left: 3px solid var(--slot-border); }
.hxc-bal-row:last-child { border-bottom: none; }
.hxc-bal-pj { font-size: 0.68em; font-weight: 700; color: var(--slot-text); flex: 1; }
.hxc-bal-vals { display: flex; gap: 8px; font-size: 0.66em; }
.hxc-opt-fallo.on { background: rgba(232,80,80,0.15); border-color: rgba(232,80,80,0.5); color: #e85050; }
.hxc-item-dado-hist { display: inline-block; width: 52px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; color: #888; font-size: 0.78em; text-align: center; padding: 4px 3px; font-family: 'Cinzel', serif; }
#hxc-view-sesiones { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.hxc-ses-wrap { max-width: 720px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; height: 100%; padding: 0 16px; box-sizing: border-box; }
.hxc-ses-top { display: flex; align-items: center; justify-content: space-between; padding: 18px 0 12px; flex-shrink: 0; }
.hxc-ses-title { font-family: 'Cinzel', serif; font-size: 0.88em; color: #d4af37; letter-spacing: 2px; text-transform: uppercase; }
.hxc-btn-nueva-ses { background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.35); color: #d4af37; font-size: 0.7em; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-family: 'Cinzel', serif; transition: background 0.15s; }
.hxc-btn-nueva-ses:hover { background: rgba(212,175,55,0.2); }
.hxc-ses-list { flex: 1; overflow-y: auto; padding-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 9px; align-content: start; }
.hxc-ses-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 9px; padding: 13px 15px; cursor: pointer; transition: background 0.13s, border-color 0.13s; display: flex; align-items: center; gap: 11px; }
.hxc-ses-card:hover { background: rgba(212,175,55,0.05); border-color: rgba(212,175,55,0.28); }
.hxc-ses-card-info { flex: 1; min-width: 0; }
.hxc-ses-card-nombre { font-size: 0.82em; font-weight: 600; color: #fff; margin-bottom: 3px; }
.hxc-ses-card-meta { font-size: 0.61em; color: #888; }
.hxc-ses-card-chevron { color: #888; font-size: 1em; flex-shrink: 0; }
.hxc-ses-empty { text-align: center; color: #666; font-size: 0.73em; padding: 36px 16px; line-height: 1.9; grid-column: 1/-1; }
.hxc-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 1300; display: flex; align-items: center; justify-content: center; }
.hxc-modal { background: #0d0c1a; border: 1px solid rgba(212,175,55,0.25); border-radius: 12px; padding: 22px 26px; width: 370px; box-shadow: 0 8px 40px rgba(0,0,0,0.8); }
.hxc-modal-title { font-family: 'Cinzel', serif; font-size: 0.85em; color: #d4af37; margin-bottom: 14px; letter-spacing: 1px; }
.hxc-modal label { font-size: 0.68em; color: #888; display: block; margin-bottom: 3px; margin-top: 11px; }
.hxc-modal input, .hxc-modal textarea { width: 100%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); border-radius: 6px; color: #fff; font-size: 0.78em; padding: 7px 10px; font-family: inherit; outline: none; box-sizing: border-box; }
.hxc-modal input::placeholder, .hxc-modal textarea::placeholder { color: #444; }
.hxc-modal input:focus, .hxc-modal textarea:focus { border-color: rgba(212,175,55,0.45); }
.hxc-modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.hxc-btn-cancel-modal { background: none; border: 1px solid rgba(255,255,255,0.12); color: #666; font-size: 0.68em; padding: 6px 13px; border-radius: 5px; cursor: pointer; font-family: inherit; }
.hxc-btn-cancel-modal:hover { color: #bbb; }
.hxc-btn-ok-modal { background: rgba(212,175,55,0.12); border: 1px solid rgba(212,175,55,0.4); color: #d4af37; font-size: 0.68em; padding: 6px 16px; border-radius: 5px; cursor: pointer; font-family: 'Cinzel', serif; transition: background 0.15s; }
.hxc-btn-ok-modal:hover { background: rgba(212,175,55,0.24); }
.hxc-pj-modal { background: #0d0c1a; border: 1px solid rgba(255,255,255,0.11); border-radius: 12px; padding: 15px 17px; width: 330px; max-height: 70vh; display: flex; flex-direction: column; box-shadow: 0 8px 40px rgba(0,0,0,0.8); }
.hxc-pj-modal-title { font-size: 0.7em; color: #888; margin-bottom: 9px; letter-spacing: 1px; text-transform: uppercase; }
.hxc-pj-modal-list { overflow-y: auto; flex: 1; }
.hxc-pj-row { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border-radius: 7px; cursor: pointer; transition: background 0.12s; }
.hxc-pj-row:hover { background: rgba(255,255,255,0.06); }
.hxc-pj-row img { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; object-position: top; border: 1px solid rgba(255,255,255,0.11); background: #111; }
.hxc-pj-row-info { flex: 1; min-width: 0; }
.hxc-pj-row-nombre { font-size: 0.76em; color: #fff; }
.hxc-pj-row-hex { font-size: 0.6em; color: #555; font-family: 'Cinzel', serif; }
.hxc-toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%); background: rgba(15,12,28,0.98); border: 1px solid rgba(212,175,55,0.35); color: #d4af37; font-size: 0.78em; padding: 9px 20px; border-radius: 8px; z-index: 2000; pointer-events: none; opacity: 0; transition: opacity 0.25s; white-space: nowrap; }
.hxc-toast.show { opacity: 1; }
/* ── Slot action buttons ── */
.hxc-slot-actions { display: flex; gap: 3px; margin-top: 5px; flex-wrap: wrap; justify-content: center; }
.hxc-slot-action-btn { font-size: 0.48em; padding: 2px 6px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: #aaa; cursor: pointer; letter-spacing: 0.5px; text-transform: uppercase; transition: all 0.12s; font-family: inherit; white-space: nowrap; }
.hxc-slot-action-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
.hxc-slot-action-btn.activo { background: var(--slot-bg); border-color: var(--slot-border); color: var(--slot-text); }
.hxc-slot-action-btn.btn-evento { border-color: rgba(140,90,220,0.4); color: #b080e0; }
.hxc-slot-action-btn.btn-evento:hover { background: rgba(140,90,220,0.15); color: #c8a0f0; }
.hxc-slot-action-btn.btn-evento.activo { background: rgba(140,90,220,0.18); border-color: rgba(140,90,220,0.6); color: #c8a0f0; }
/* ── Estado chips en slot ── */
.hxc-slot-estados { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; margin-top: 3px; max-width: 100%; }
.hxc-estado-chip { font-size: 0.44em; padding: 1px 5px; border-radius: 8px; background: rgba(80,200,140,0.15); border: 1px solid rgba(80,200,140,0.35); color: #50c88c; white-space: nowrap; max-width: 70px; overflow: hidden; text-overflow: ellipsis; cursor: default; }
/* ── Panel lateral flotante (inventario / estados / evento) ── */
#hxc-lateral-panel { position: absolute; top: 0; bottom: 0; width: 280px; background: rgba(8,7,15,0.99); border: 1px solid rgba(255,255,255,0.1); z-index: 10; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 30px rgba(0,0,0,0.7); }
#hxc-lateral-panel.lado-izq { left: 160px; border-left: none; border-radius: 0 8px 8px 0; }
#hxc-lateral-panel.lado-der { right: 160px; border-right: none; border-radius: 8px 0 0 8px; }
.hxc-lat-header { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
.hxc-lat-titulo { font-size: 0.68em; font-weight: 700; color: #fff; flex: 1; }
.hxc-lat-subtitulo { font-size: 0.58em; color: #888; }
.hxc-lat-close { background: none; border: none; color: #666; font-size: 1em; cursor: pointer; padding: 1px 5px; transition: color 0.15s; }
.hxc-lat-close:hover { color: #ccc; }
.hxc-lat-tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
.hxc-lat-tab { flex: 1; font-size: 0.58em; padding: 6px 4px; background: none; border: none; color: #666; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.13s; font-family: inherit; letter-spacing: 0.5px; text-transform: uppercase; }
.hxc-lat-tab:hover { color: #bbb; }
.hxc-lat-tab.activo { color: var(--lat-color, #d4af37); border-bottom-color: var(--lat-color, #d4af37); }
.hxc-lat-search { margin: 5px 8px 3px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 5px; color: #fff; font-size: 0.7em; padding: 5px 7px; outline: none; font-family: inherit; }
.hxc-lat-search::placeholder { color: #444; }
.hxc-lat-body { flex: 1; overflow-y: auto; padding: 4px 6px 8px; scrollbar-width: thin; }
/* items de inventario en panel lateral */
.hxc-lat-hz { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 5px; cursor: pointer; border: 1px solid transparent; margin-bottom: 3px; transition: background 0.12s; }
.hxc-lat-hz:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
.hxc-lat-hz.es-estado { border-left: 2px solid rgba(80,200,140,0.5); }
.hxc-lat-hz-nombre { font-size: 0.72em; color: #eee; flex: 1; line-height: 1.2; }
.hxc-lat-hz-afin { font-size: 0.58em; color: #666; }
.hxc-lat-hz-cost { font-size: 0.63em; color: #d4af37; font-family: 'Cinzel', serif; flex-shrink: 0; }
.hxc-lat-hz-badge { font-size: 0.48em; padding: 1px 4px; border-radius: 3px; background: rgba(80,200,140,0.15); color: #50c88c; border: 1px solid rgba(80,200,140,0.3); margin-left: 2px; }
.hxc-lat-empty { font-size: 0.68em; color: #555; text-align: center; padding: 20px 8px; line-height: 1.8; }
/* estados activos del PJ */
.hxc-estado-row { display: flex; align-items: center; gap: 7px; padding: 7px 9px; border-radius: 6px; border: 1px solid rgba(80,200,140,0.2); background: rgba(80,200,140,0.05); margin-bottom: 4px; }
.hxc-estado-row-nombre { font-size: 0.72em; color: #50c88c; flex: 1; font-weight: 600; }
.hxc-estado-row-afin { font-size: 0.58em; color: #555; }
.hxc-estado-quitar { background: none; border: none; color: #444; font-size: 0.85em; cursor: pointer; padding: 1px 5px; border-radius: 3px; transition: color 0.12s; }
.hxc-estado-quitar:hover { color: #e05050; }
/* Panel evento */
.hxc-evento-form { padding: 10px 8px; display: flex; flex-direction: column; gap: 8px; }
.hxc-evento-label { font-size: 0.58em; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
.hxc-evento-input { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 5px; color: #fff; font-size: 0.75em; padding: 6px 9px; font-family: inherit; outline: none; width: 100%; box-sizing: border-box; }
.hxc-evento-input::placeholder { color: #444; }
.hxc-evento-input:focus { border-color: rgba(140,90,220,0.5); }
.hxc-evento-textarea { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 5px; color: #ddd; font-size: 0.7em; padding: 6px 9px; font-family: inherit; outline: none; width: 100%; box-sizing: border-box; resize: vertical; min-height: 60px; }
.hxc-evento-textarea::placeholder { color: #444; }
.hxc-evento-btn { background: rgba(140,90,220,0.14); border: 1px solid rgba(140,90,220,0.4); color: #b080e0; font-size: 0.68em; padding: 6px 14px; border-radius: 5px; cursor: pointer; font-family: 'Cinzel', serif; transition: background 0.15s; align-self: flex-end; }
.hxc-evento-btn:hover { background: rgba(140,90,220,0.28); }
/* item EVENTO en stack */
.hxc-item-evento { border-radius: 7px; border: 1px solid rgba(140,90,220,0.35); background: rgba(140,90,220,0.07); margin-bottom: 6px; overflow: hidden; }
.hxc-item-evento-row { display: flex; align-items: center; gap: 7px; padding: 8px 10px; cursor: pointer; }
.hxc-item-evento-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(140,90,220,0.7); flex-shrink: 0; }
.hxc-item-evento-estado { font-size: 0.5em; padding: 1px 6px; border-radius: 3px; font-weight: 700; letter-spacing: 0.5px; white-space: nowrap; }
.hxc-item-evento-estado.aplicado { background: rgba(62,207,110,0.12); color: #3ecf6e; border: 1px solid rgba(62,207,110,0.3); }
.hxc-item-evento-estado.pendiente { background: rgba(140,90,220,0.1); color: #b080e0; border: 1px solid rgba(140,90,220,0.25); }
.hxc-item-evento-nombre { font-size: 0.76em; color: #ddd; flex: 1; font-weight: 500; }
.hxc-item-evento-desc { font-size: 0.63em; color: #999; padding: 6px 10px 9px; line-height: 1.65; border-top: 1px solid rgba(255,255,255,0.06); white-space: pre-line; }
.hxc-item-evento-pj { font-size: 0.6em; color: #9060d0; }
/* botones de eventos en barra */
.hxc-btn-aplicar-ev { background: rgba(62,207,110,0.07); border-color: rgba(62,207,110,0.35); color: #3ecf6e; }
.hxc-btn-aplicar-ev:hover { background: rgba(62,207,110,0.18); }
.hxc-btn-revertir-ev { background: rgba(232,160,48,0.07); border-color: rgba(232,160,48,0.35); color: #e8a030; }
.hxc-btn-revertir-ev:hover { background: rgba(232,160,48,0.18); }
/* ── Hechizo-estado: bordes cuadrados ── */
.hxc-item.es-estado { border-radius: 2px !important; }
.hxc-item.es-estado .hxc-item-row { border-radius: 0; }
.hxc-item-color-dot.es-estado { border-radius: 2px !important; }
/* ── Badges de meta-info en la fila del hechizo ── */
.hxc-hz-meta { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
.hxc-hz-badge { font-size: 0.5em; padding: 2px 5px; border-radius: 3px; border: 1px solid; white-space: nowrap; font-weight: 700; letter-spacing: 0.3px; }
.hxc-hz-badge-estado { background: rgba(80,200,140,0.12); color: #50c88c; border-color: rgba(80,200,140,0.35); }
.hxc-hz-badge-pri { background: rgba(212,175,55,0.14); color: #d4af37; border-color: rgba(212,175,55,0.4); }
/* Objetivos */
.hxc-hz-obj { display: flex; gap: 2px; }
.hxc-hz-obj-dot { width: 13px; height: 13px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.55em; font-weight: 700; border: 1px solid; flex-shrink: 0; }
.hxc-hz-obj-dot.hz { background: rgba(60,130,230,0.15); color: #5090e8; border-color: rgba(60,130,230,0.4); }
.hxc-hz-obj-dot.usr { background: rgba(140,90,220,0.15); color: #b080e0; border-color: rgba(140,90,220,0.4); }
.hxc-hz-obj-dot.obj { background: rgba(232,100,60,0.15); color: #e87040; border-color: rgba(232,100,60,0.4); }
/* Cast range chips */
.hxc-hz-cast { display: flex; gap: 2px; }
.hxc-hz-cast-chip { font-size: 0.58em; padding: 1px 5px; border-radius: 3px; font-weight: 800; font-family: 'Cinzel', serif; border: 1px solid; min-width: 18px; text-align: center; }
.hxc-hz-cast-chip.back { background: rgba(100,160,230,0.12); color: #70a8e8; border-color: rgba(100,160,230,0.35); }
.hxc-hz-cast-chip.next { background: rgba(230,100,60,0.12); color: #e87840; border-color: rgba(230,100,60,0.35); }
`;
  document.head.appendChild(st);
}

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

function _colorVars(c) { return `--slot-bg:${c.bg};--slot-border:${c.border};--slot-text:${c.text};--slot-glow:${c.glow};`; }
const _esAdmin = () => estadoUI?.esAdmin === true;

function _render() {
  const drawer = document.getElementById('hxc-drawer');
  if (!drawer) return;
  if (hxState.vistaActiva === 'sesiones') _renderSesiones(drawer);
  else _renderCast(drawer);
}
window._hxcRender = _render;
// Exponer funciones de drag para uso desde HTML inline
window.fxMouseDownSlot = fxMouseDownSlot;
window.fxMouseDownItem = fxMouseDownItem;
window._hxcReplaceStackItem = (idx, nuevoItem) => {
  if (idx >= 0 && idx < hxState.stack.length) {
    // Preserve _aplicado state if it was already applied
    nuevoItem._aplicado = hxState.stack[idx]._aplicado || false;
    hxState.stack[idx] = nuevoItem;
  }
};

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
      ${renderCanalSVG('izq')}
      ${_renderCenter()}
      ${renderCanalSVG('der')}
      ${_renderColGrupo('B')}
      ${_renderLateralPanel()}
    </div>`;
  // Montar overlay SVG y observar cambios del stack
  requestAnimationFrame(() => { montarOverlay(); observarStack(); });
}

function _renderColGrupo(grupo) {
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  return `<div class="hxc-col ${grupo==='B'?'hxc-col-b':''}">
    <div class="hxc-col-title">Grupo ${grupo}</div>
    ${slots.map((pj, idx) => _renderSlot(pj, grupo, idx)).join('')}
  </div>`;
}

function _renderSlot(pj, grupo, idx) {
  const color = SLOT_COLORS[grupo][idx];
  const vars  = _colorVars(color);
  const panel = hxState.panelSlot;
  const esteActivo = panel?.grupo === grupo && panel?.idx === idx;

  let inner = '', quit = '';
  if (!pj) {
    inner = `<div class="hxc-slot-inner"><span class="hxc-slot-plus">+</span><span class="hxc-slot-label">Asignar PJ</span></div>`;
  } else {
    const p   = personajes[pj.nombre];
    const hex = p?.hex ?? '?';
    const vex = p?.vex_actual ?? 0;
    const estados = hxState.estadosPorPj[pj.nombre] || [];
    quit = `<button class="hxc-slot-quit" onclick="event.stopPropagation();window._hxcQuitarPJ('${grupo}',${idx})">×</button>`;

    const estadosHtml = estados.length > 0
      ? `<div class="hxc-slot-estados">${estados.slice(0,4).map(e =>
          `<span class="hxc-estado-chip" title="${e.hechizo_nombre}">${e.hechizo_nombre.substring(0,9)}</span>`
        ).join('')}${estados.length>4?`<span class="hxc-estado-chip">+${estados.length-4}</span>`:''}</div>`
      : '';

    const btnHz  = `<button class="hxc-slot-action-btn ${esteActivo&&panel?.tipo==='hechizos'?'activo':''}" onclick="event.stopPropagation();window._hxcAbrirPanel('${grupo}',${idx},'hechizos')">Hz</button>`;
    const btnEst = `<button class="hxc-slot-action-btn ${esteActivo&&panel?.tipo==='estados'?'activo':''}" onclick="event.stopPropagation();window._hxcAbrirPanel('${grupo}',${idx},'estados')">Estado${estados.length>0?` (${estados.length})`:''}</button>`;
    const btnEv  = `<button class="hxc-slot-action-btn btn-evento" onclick="event.stopPropagation();window._hxcAbrirEvento('${grupo}',${idx},'${pj.nombre.replace(/'/g,"\\'")}')">Evento</button>`;

    inner = `<div class="hxc-slot-inner" onclick="event.stopPropagation()">
      <img class="hxc-slot-avatar" src="${imgPj(pj.nombre)}" onerror="this.src='${imgFallback()}'" title="${pj.nombre}">
      <span class="hxc-slot-nombre">${pj.nombre}</span>
      <span class="hxc-slot-hex">${(hex||0).toLocaleString()} HEX</span>
      ${vex > 0 ? `<span class="hxc-slot-vex">${vex.toLocaleString()} VEX</span>` : ''}
      ${estadosHtml}
      <div class="hxc-slot-actions">${btnHz}${btnEst}${btnEv}</div>
    </div>`;
  }

  const actCls = esteActivo && pj ? 'activo' : (pj ? '' : 'vacio');

  return `<div class="hxc-slot ${actCls}" style="${vars}"
    onmousedown="if(window.fxMouseDownSlot&&window.fxMouseDownSlot(event,'${grupo}',${idx}))event.preventDefault()"
    onclick="window._hxcClickSlot('${grupo}',${idx})">
    ${quit}${inner}
  </div>`;
}

function _renderLateralPanel() {
  const p = hxState.panelSlot;
  if (!p) return '';
  const slots = p.grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const pj = slots[p.idx];
  if (!pj) return '';

  const color = SLOT_COLORS[p.grupo][p.idx];
  const isGrupoB = p.grupo === 'B';
  const ladoCls = isGrupoB ? 'lado-der' : 'lado-izq';
  const latColor = color.text;

  let body = '';
  const tipo = p.tipo;

  if (tipo === 'hechizos') {
    const inv = hxState.inventarioPJ[pj.nombre] || [];
    const busq = hxState.busquedaHz.toLowerCase();
    const filtrado = busq ? inv.filter(h =>
      (h.nombre||'').toLowerCase().includes(busq) || (h.afinidad||'').toLowerCase().includes(busq)
    ) : inv;
    const rows = filtrado.length > 0
      ? filtrado.map(h => {
          const hzKey = _norm(h.hechizo_id || h.nombre);
          const esEstado = h.es_estado;
          return `<div class="hxc-lat-hz ${esEstado?'es-estado':''}" onclick="window._hxcAgregarHz('${p.grupo}',${p.idx},'${hzKey}')">
            <div style="flex:1;min-width:0;">
              <div class="hxc-lat-hz-nombre">${h.nombre}${esEstado?`<span class="hxc-lat-hz-badge">estado</span>`:''}</div>
              <div class="hxc-lat-hz-afin">${h.afinidad||'—'}</div>
            </div>
            <span class="hxc-lat-hz-cost">${h.hex_cost||0}</span>
          </div>`;
        }).join('')
      : `<div class="hxc-lat-empty">${busq ? 'Sin resultados' : 'Sin hechizos en inventario'}</div>`;
    body = `
      <input class="hxc-lat-search" placeholder="Buscar hechizo..." value="${hxState.busquedaHz}"
        oninput="window._hxcBuscarHz(this.value)" onclick="event.stopPropagation()">
      <div class="hxc-lat-body">${rows}</div>`;

  } else if (tipo === 'estados') {
    const estados = hxState.estadosPorPj[pj.nombre] || [];
    // Catálogo de hechizos estado para añadir
    const busq = hxState.busquedaHz.toLowerCase();
    const catalogoEstados = hxState.catalogoDB.filter(h => h.es_estado);
    const filtCatalogo = busq
      ? catalogoEstados.filter(h => (h.nombre||'').toLowerCase().includes(busq))
      : catalogoEstados;

    const estadosActivos = estados.length > 0
      ? estados.map(e => `<div class="hxc-estado-row">
          <div style="flex:1;min-width:0;">
            <div class="hxc-estado-row-nombre">${e.hechizo_nombre}</div>
            <div class="hxc-estado-row-afin">${e.afinidad||'—'}</div>
          </div>
          <button class="hxc-estado-quitar" title="Quitar estado" onclick="window._hxcQuitarEstado('${pj.nombre}',${e.id})">×</button>
        </div>`).join('')
      : `<div class="hxc-lat-empty">Sin hechizos estado activos</div>`;

    const catalogoRows = filtCatalogo.length > 0
      ? filtCatalogo.map(h => `<div class="hxc-lat-hz es-estado" onclick="window._hxcAgregarEstado('${pj.nombre}','${h.hechizo_id}','${h.nombre.replace(/'/g,"\\'")}','${h.afinidad||''}')">
          <div style="flex:1;min-width:0;">
            <div class="hxc-lat-hz-nombre">${h.nombre}</div>
            <div class="hxc-lat-hz-afin">${h.afinidad||'—'}</div>
          </div>
          <span class="hxc-lat-hz-cost">+</span>
        </div>`).join('')
      : `<div class="hxc-lat-empty">Sin hechizos estado en catálogo</div>`;

    body = `
      <div class="hxc-lat-body" style="padding-bottom:0;">
        <div style="font-size:0.55em;letter-spacing:1.5px;text-transform:uppercase;color:${latColor};padding:6px 4px 4px;font-weight:700;">Activos</div>
        ${estadosActivos}
        <div style="font-size:0.55em;letter-spacing:1.5px;text-transform:uppercase;color:#666;padding:10px 4px 4px;font-weight:700;border-top:1px solid rgba(255,255,255,0.06);margin-top:6px;">Agregar estado</div>
        <input class="hxc-lat-search" style="margin:3px 0 4px;" placeholder="Buscar estado..." value="${hxState.busquedaHz}"
          oninput="window._hxcBuscarHz(this.value)" onclick="event.stopPropagation()">
        ${catalogoRows}
      </div>`;

  } else if (tipo === 'evento') {
    body = '';
  }

  return `<div id="hxc-lateral-panel" class="${ladoCls}" style="--lat-color:${latColor};" onclick="event.stopPropagation()">
    <div class="hxc-lat-header">
      <span class="hxc-lat-titulo">${pj.nombre}</span>
      <span class="hxc-lat-subtitulo">${tipo === 'hechizos' ? 'Inventario' : 'Estados'}</span>
      <button class="hxc-lat-close" onclick="window._hxcCerrarPanel()">×</button>
    </div>
    ${body}
  </div>`;
}

function _renderCenter() {
  const turnos = hxState.turnos;
  const turnoActivo = hxState.turnoActivo;
  const turnoIdx  = turnoActivo ? turnos.findIndex(t => t.id === turnoActivo.id) : turnos.length - 1;
  const turnoNum  = turnoActivo?.numero ?? 1;
  const esHistorico = turnoIdx < turnos.length - 1;
  const esAdmin   = _esAdmin();

  const turnoOptions = turnos.map((t, i) =>
    `<option value="${i}" ${i===turnoIdx?'selected':''}>${'T'+t.numero+(t.nombre?' — '+t.nombre:'')}</option>`
  ).join('');

  const botonesOp = esAdmin ? `
    <button class="hxc-btn-op hxc-btn-cobrar" onclick="window._hxcCobrarHex()" title="Cobra VEX primero, luego HEX">⚡ Cobrar hechizos</button>
    <button class="hxc-btn-op hxc-btn-devolver" onclick="window._hxcDevolverHex()">↩ Devolver</button>
    <button class="hxc-btn-op hxc-btn-del-turno" onclick="window._hxcEliminarTurno()">🗑 Turno</button>
  ` : '';

  const btnGuardarHistorico = (esHistorico && esAdmin) ? `
    <button class="hxc-btn-guardar-hist" onclick="window._hxcGuardarHistorico()">💾 Guardar turno</button>
  ` : '';

  return `<div class="hxc-center">
    <div class="hxc-center-top">
      <span class="hxc-turno-label">Turno <strong>${turnoNum}</strong> · ${turnos.length}</span>
      ${esHistorico ? `<span class="hxc-badge-hist">Histórico</span>` : ''}
      <div class="hxc-turno-nav">
        <button class="hxc-turno-nav-btn" ${turnoIdx<=0?'disabled':''} onclick="window._hxcIrTurno(${turnoIdx-1})">‹</button>
        <select class="hxc-turno-select" onchange="window._hxcIrTurno(this.value)">${turnoOptions}</select>
        <button class="hxc-turno-nav-btn" ${turnoIdx>=turnos.length-1?'disabled':''} onclick="window._hxcIrTurno(${turnoIdx+1})">›</button>
      </div>
      <button class="hxc-btn-nuevo-turno" onclick="window._hxcNuevoTurno()">+ Turno</button>
      ${!esHistorico ? `<button class="hxc-btn-confirmar" onclick="window._hxcConfirmar()">Confirmar ›</button>` : ''}
      ${btnGuardarHistorico}
      ${botonesOp}
    </div>
    ${renderToolbarFlechas()}
    <div class="hxc-stack" id="hxc-stack-list">${_renderStack(esHistorico)}</div>
  </div>`;
}

function _calcGastoItem(item) {
  if (!item.cobrarHex) return null;
  if (item.resultado !== 'exito' && item.resultado !== 'infalible') return null;
  const costo = item.costoBase; // HEX = costoBase, CD no multiplica HEX
  if (costo <= 0) return null;
  const p = personajes[item.pjNombre];
  if (!p) return null;
  return { costo, pjNombre: item.pjNombre };
}

function _renderGastoHex(item, stackUpTo) {
  if (!item.cobrarHex) return '';
  const esFallo = item.resultado === 'fallo' || item.resultado === null || item.resultado === undefined;
  if (esFallo) return `<div class="hxc-gasto-row hxc-gasto-none">Gasto: ninguno (fallo)</div>`;

  const costo = item.costoBase; // HEX cobrado = costoBase (CD solo sube dificultad, no costo)
  if (costo <= 0) return '';

  const p = personajes[item.pjNombre];
  if (!p) return '';
  let vexDisp = p.vex_actual || 0;
  let hexDisp = p.hex || 0;
  for (const prev of stackUpTo) {
    if (prev.pjNombre !== item.pjNombre) continue;
    if (!prev.cobrarHex) continue;
    if (prev.resultado !== 'exito' && prev.resultado !== 'infalible') continue;
    const prevCosto = prev.costoBase;
    const vexG = Math.min(vexDisp, prevCosto);
    const hexG = prevCosto - vexG;
    vexDisp -= vexG;
    hexDisp -= hexG;
  }

  const vexGasto = Math.min(vexDisp, costo);
  const hexGasto = costo - vexGasto;
  const insuficiente = hexGasto > hexDisp;

  if (insuficiente) {
    return `<div class="hxc-gasto-row hxc-gasto-insuf">Gasto: insuficiente | Fallo</div>`;
  }

  const parts = [];
  if (vexGasto > 0) parts.push(`<span class="hxc-gasto-vex">-${vexGasto.toLocaleString()} VEX</span>`);
  if (hexGasto > 0) parts.push(`<span class="hxc-gasto-hex">-${hexGasto.toLocaleString()} HEX</span>`);
  return `<div class="hxc-gasto-row">Gasto: ${parts.join(' ')}</div>`;
}

function _renderBalance() {
  const pjNames = [...new Set(hxState.stack.map(i => i.pjNombre))];
  if (!pjNames.length) return '';
  const rows = pjNames.map(nombre => {
    const p = personajes[nombre];
    if (!p) return '';
    let vexDisp = p.vex_actual || 0;
    let hexDisp = p.hex || 0;
    let totalGasto = 0;
    let totalVex = 0;
    let totalHex = 0;
    for (const item of hxState.stack) {
      if (item.pjNombre !== nombre) continue;
      if (!item.cobrarHex) continue;
      if (item.resultado !== 'exito' && item.resultado !== 'infalible') continue;
      const costo = item.costoBase; // HEX = costoBase
      const vexG = Math.min(vexDisp, costo);
      const hexG = costo - vexG;
      vexDisp -= vexG;
      hexDisp -= hexG;
      totalVex += vexG;
      totalHex += hexG;
      totalGasto += costo;
    }
    const color = hxState.stack.find(i => i.pjNombre === nombre)?.color;
    const vars = color ? _colorVars(color) : '';
    return `<div class="hxc-bal-row" style="${vars}">
      <span class="hxc-bal-pj">${nombre}</span>
      <span class="hxc-bal-vals">
        ${totalVex > 0 ? `<span class="hxc-gasto-vex">-${totalVex.toLocaleString()} VEX</span>` : ''}
        ${totalHex > 0 ? `<span class="hxc-gasto-hex">-${totalHex.toLocaleString()} HEX</span>` : ''}
        ${totalGasto === 0 ? `<span style="color:#444;">sin gasto</span>` : ''}
      </span>
    </div>`;
  }).join('');
  return `<div class="hxc-balance-panel"><div class="hxc-balance-title">Balance del turno</div>${rows}</div>`;
}

function _renderStack(esHistorico) {
  if (!hxState.stack.length) {
    if (esHistorico) return `<div class="hxc-stack-empty" style="color:#555;">Turno histórico.<br><span style="font-size:0.85em;">Navega al último turno para lanzar hechizos.</span></div>`;
    return `<div class="hxc-stack-empty">Selecciona un personaje → Hz, Estado o Evento<br>para agregar al turno.</div>`;
  }

  const esAdmin = _esAdmin();
  const puedeEditar = !esHistorico || esAdmin;

  const items = hxState.stack.map((item, i) => {
    // ── Item tipo EVENTO ──────────────────────────────────────
    if (item.tipoItem === 'evento') {
      const delBtn = puedeEditar
        ? `<button class="hxc-item-del" onclick="event.stopPropagation();window._hxcRemover(${i})" style="color:#666;">×</button>`
        : '';
      const editBtn = puedeEditar
        ? `<button class="hxc-item-del" onclick="event.stopPropagation();window._hxcEditarEvento(${i})" title="Editar evento" style="color:#9060c0;">✎</button>`
        : '';
      const tipoLabel = { evento:'Evento', casteo:'Casteo GM', stat:'Stat', hechizo_add:'+ Hechizo', hechizo_rem:'− Hechizo', objeto:'Objeto' }[item.eventoTipo] || 'Evento';
      return `<div class="hxc-item-evento" data-hxc-idx="${i}">
        <div class="hxc-item-evento-row" onclick="window._hxcToggleItem(${i})">
          <div class="hxc-item-evento-dot"></div>
          <span class="hxc-item-evento-tipo">${tipoLabel}</span>
          <span class="hxc-item-evento-nombre">${item.eventoNombre || '—'}</span>
          <span class="hxc-item-evento-pj">${item.pjNombre}</span>
          ${editBtn}
          ${delBtn}
        </div>
        ${item.abierto && item.eventoDesc ? `<div class="hxc-item-evento-desc">${item.eventoDesc}</div>` : ''}
      </div>`;
    }

    // ── Item tipo HECHIZO (normal) ────────────────────────────
    const vars    = _colorVars(item.color);
    const hz      = item.hechizo;
    const esEstado = !!(hz.es_estado);
    const priCls  = item.esPrioridad ? 'prioridad' : '';
    const estadoCls = esEstado ? 'es-estado' : '';
    const resCls  = item.resultado ? `res-${item.resultado}` : '';
    const multStr = item.mult > 1 ? `×${Math.round(item.mult * 100)}% CD` : '';

    // Meta badges: estado, prioridad
    const badgeEstado = esEstado
      ? `<span class="hxc-hz-badge hxc-hz-badge-estado">Estado</span>` : '';
    const badgePri = hz.es_prioridad
      ? `<span class="hxc-hz-badge hxc-hz-badge-pri">↑ Pri</span>` : '';

    // Objetivos
    const objHtml = (hz.afecta_hechizos || hz.afecta_usuario || hz.afecta_objetivo)
      ? `<div class="hxc-hz-obj">
          ${hz.afecta_hechizos ? `<div class="hxc-hz-obj-dot hz" title="Afecta hechizos">Hz</div>` : ''}
          ${hz.afecta_usuario  ? `<div class="hxc-hz-obj-dot usr" title="Afecta al usuario">U</div>` : ''}
          ${hz.afecta_objetivo ? `<div class="hxc-hz-obj-dot obj" title="Afecta otros objetivos">O</div>` : ''}
        </div>` : '';

    // Backcast / Nextcast
    const castHtml = (hz.backcast > 0 || hz.nextcast > 0)
      ? `<div class="hxc-hz-cast">
          ${hz.backcast > 0 ? `<span class="hxc-hz-cast-chip back" title="Backcast: afecta ${hz.backcast} hechizo(s) anteriores">←${hz.backcast}</span>` : ''}
          ${hz.nextcast > 0 ? `<span class="hxc-hz-cast-chip next" title="Nextcast: afecta ${hz.nextcast} hechizo(s) siguientes">${hz.nextcast}→</span>` : ''}
        </div>` : '';

    const metaHtml = (badgeEstado || badgePri || objHtml || castHtml)
      ? `<div class="hxc-hz-meta">${badgeEstado}${badgePri}${objHtml}${castHtml}</div>` : '';

    const vexBadge = hz.valor_vex > 0
      ? `<span class="hxc-hz-badge" style="background:rgba(150,80,220,0.12);color:#b060e8;border-color:rgba(150,80,220,0.35);">⬡ VEX ${hz.valor_vex}</span>` : '';
    const notaBadge = hz.nota
      ? `<span class="hxc-hz-badge" style="background:rgba(212,160,30,0.08);color:#d4a830;border-color:rgba(212,160,30,0.25);" title="${hz.nota}">📌 ${hz.nota}</span>` : '';
    const extraMeta = (vexBadge || notaBadge)
      ? `<div class="hxc-hz-meta" style="margin-top:2px;">${vexBadge}${notaBadge}</div>` : '';

    let resHtml;
    if      (item.resultado === 'exito')     resHtml = `<span class="hxc-item-resultado hxc-res-exito">¡Éxito!</span>`;
    else if (item.resultado === 'fallo')     resHtml = `<span class="hxc-item-resultado hxc-res-fallo">¡Fallo!</span>`;
    else if (item.resultado === 'infalible') resHtml = `<span class="hxc-item-resultado hxc-res-infalible">Infalible</span>`;
    else if (item.resultado === 'fallo_hex') resHtml = `<span class="hxc-item-resultado hxc-res-fallo_hex">Sin HEX</span>`;
    else resHtml = `<span class="hxc-item-resultado" style="color:#666;">${item.costoBase} HEX</span>`;

    const dadoInput = puedeEditar
      ? `<input class="hxc-item-dado" type="text" inputmode="numeric" placeholder="d100"
          value="${item.dado!==''?item.dado:''}" data-hxc-item="${i}"
          onclick="event.stopPropagation()"
          oninput="window._hxcSetDado(${i},this.value)"
          onkeydown="window._hxcDadoKeydown(event,${i})">`
      : (item.dado !== '' ? `<span class="hxc-item-dado-hist">${item.dado}</span>` : '');

    const delBtn = puedeEditar
      ? `<button class="hxc-item-del" onclick="event.stopPropagation();window._hxcRemover(${i})">×</button>`
      : '';

    let detail = '';
    if (item.abierto) {
      const nc  = item.ncCalc;
      const campos = [
        { label:'Resumen', val: hz.resumen },{ label:'Efecto', val: hz.efecto },
        { label:'Overcast', val: hz.overcast },{ label:'Undercast', val: hz.undercast },
        { label:'Especial', val: hz.especial },
      ].filter(c => c.val && c.val.trim() && c.val !== '0');

      const gastoHtml = _renderGastoHex(item, hxState.stack.slice(0, i));

      const optBtns = puedeEditar ? `<div class="hxc-detail-opts">
          <button class="hxc-opt-btn ${item.cobrarHex?'on':''}" onclick="event.stopPropagation();window._hxcToggleOpt(${i},'cobrarHex')">💰 Cobrar HEX</button>
          <button class="hxc-opt-btn ${item.infalible?'on':''}" onclick="event.stopPropagation();window._hxcToggleInfalible(${i})">⚡ Infalible</button>
          <button class="hxc-opt-btn ${item.forceFallo?'on hxc-opt-fallo':''}" onclick="event.stopPropagation();window._hxcToggleFallo(${i})">✕ Fallo</button>
          <button class="hxc-opt-btn ${item.esPrioridad?'on':''}" onclick="event.stopPropagation();window._hxcSetPrioridad(${i})">↑ Prioridad</button>
        </div>` : '';

      // CD editor (solo OP) — permite ajustar el CD del PJ para esta afinidad en tiempo real
      const afKeyItem = (item.hechizo?.afinidad || '').toLowerCase();
      const cdActual = hxState.cdPorPj[item.pjNombre]?.[afKeyItem] ?? (personajes[item.pjNombre]?.['cd_' + afKeyItem] ?? 0.5);
      const cdPct = Math.round(cdActual * 100);
      const cdEditorHtml = (puedeEditar && _esAdmin()) ? `<div class="hxc-cd-edit-row" onclick="event.stopPropagation()">
        <span class="hxc-cd-edit-label">CD ${item.hechizo?.afinidad || ''}:</span>
        <button class="hxc-cd-edit-btn" onclick="window._hxcCdStep(${i},-5)">▼</button>
        <input class="hxc-cd-edit-input" type="number" step="5" min="0" max="500"
          value="${cdPct}"
          onchange="window._hxcCdSet(${i},parseFloat(this.value))"
          oninput="window._hxcCdSet(${i},parseFloat(this.value))"
          onclick="event.stopPropagation()">
        <span style="font-size:0.72em;color:#e8a030;margin-left:-4px;">%</span>
        <button class="hxc-cd-edit-btn" onclick="window._hxcCdStep(${i},5)">▲</button>
        <span class="hxc-cd-edit-hint">Afecta todos los hechizos de esta afinidad</span>
      </div>` : '';

      const objetivosStr = [
        hz.afecta_hechizos ? 'Hechizos' : '',
        hz.afecta_usuario  ? 'Usuario' : '',
        hz.afecta_objetivo ? 'Objetivos' : '',
      ].filter(Boolean).join(', ');

      detail = `<div class="hxc-item-detail">
        ${optBtns}
        ${cdEditorHtml}
        <div class="hxc-detail-stats">
          <div>Afinidad: <span>${item.afinidadEfectiva}</span></div>
          <div>Costo HEX: <span>${item.costoBase}</span>${hz.valor_vex > 0 ? `<span style="color:#b060e8;margin-left:8px;">+ VEX: ${hz.valor_vex}</span>` : ''}</div>
          ${item.mult>1?`<div>Con CD: <span style="color:#e8a030;">NC mín. ${item.ncNecesario}</span></div>`:''}
          <div>Afinidad Hz: <span>${hz.afinidad||'—'}</span></div>
          ${hz.clase?`<div>Clase: <span>${hz.clase}</span></div>`:''}
          ${objetivosStr ? `<div>Afecta: <span>${objetivosStr}</span></div>` : ''}
          ${hz.backcast > 0 ? `<div>Backcast: <span style="color:#70a8e8;">←${hz.backcast}</span></div>` : ''}
          ${hz.nextcast > 0 ? `<div>Nextcast: <span style="color:#e87840;">${hz.nextcast}→</span></div>` : ''}
          ${hz.es_prioridad ? `<div>Prioridad: <span style="color:#d4af37;">↑ automática</span></div>` : ''}
          ${hz.nota ? `<div>Nota: <span style="color:#d4a830;">📌 ${hz.nota}</span></div>` : ''}
        </div>
        ${nc!==null?`<div class="hxc-nc-calc">NC: <strong>${nc}</strong> / necesario: ${item.ncNecesario} — ${nc>=item.ncNecesario?'<span style="color:#3ecf6e;">ÉXITO</span>':'<span style="color:#e85050;">FALLO</span>'}</div>`:''}
        ${gastoHtml}
        ${campos.map(c=>`<div class="hxc-hz-field"><div class="hxc-hz-field-label">${c.label}</div><div class="hxc-hz-field-val">${c.val}</div></div>`).join('')}
        ${!campos.length?`<div style="font-size:0.65em;color:#555;font-style:italic;">Sin descripción.</div>`:''}
      </div>`;
    }

    return `<div class="hxc-item ${priCls} ${estadoCls} ${resCls}" style="${vars}" data-hxc-idx="${i}">
      <div class="hxc-item-row"
        onmousedown="if(window.fxMouseDownItem&&window.fxMouseDownItem(event,${i}))event.preventDefault()"
        onclick="window._hxcToggleItem(${i})">
        <div class="hxc-item-color-dot ${esEstado ? 'es-estado' : ''}"></div>
        <span class="hxc-item-pj">${item.pjNombre}</span>
        <span class="hxc-item-hz">${hz.nombre}</span>
        ${item.esPrioridad?`<span class="hxc-prioridad-flag">↑</span>`:''}
        ${metaHtml}
        ${multStr?`<span class="hxc-item-mult">${multStr}</span>`:''}
        ${dadoInput}
        ${resHtml}
        ${delBtn}
      </div>
      ${detail}
    </div>`;
  }).join('');

  return items + _renderBalance();
}

// ── Montaje ───────────────────────────────────────────────────
function _montar() {
  if (document.getElementById('hxc-trigger')) return;
  _css();
  const btn = document.createElement('button');
  btn.id = 'hxc-trigger'; btn.textContent = '✦ HexCast'; btn.onclick = () => abrirHexCast();
  document.body.appendChild(btn);
  const overlay = document.createElement('div');
  overlay.id = 'hxc-overlay'; overlay.onclick = () => cerrarHexCast();
  document.body.appendChild(overlay);
  const drawer = document.createElement('div');
  drawer.id = 'hxc-drawer'; drawer.innerHTML = '<div class="hxc-handle"></div>';
  document.body.appendChild(drawer);
}

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
  hxState.vistaActiva = 'sesiones'; hxState.sesionActiva = null; hxState.turnoActivo = null;
  hxState.stack = []; hxState.turnos = []; hxState.grupoA = [null,null,null]; hxState.grupoB = [null,null,null];
  hxState.pjSeleccionado = null; _render();
};

window._hxcSelSesion = async (id) => {
  try {
    await seleccionarSesion(id);
    if (hxState.turnoActivo) {
      await cargarHistorialSesion(id, hxState.turnoActivo.numero);
    }
    hxState.estadosPorPj = {};
    await _cargarTodosEstadosTurno();
    resetFlechas();
    await cargarFlechasTurno(hxState.turnoActivo?.id, id);
    hxState.vistaActiva = 'cast'; _render();
  }
  catch(e) { _toast('Error cargando sesión', true); }
};

window._hxcModalNuevaSesion = () => {
  const backdrop = document.createElement('div');
  backdrop.className = 'hxc-modal-backdrop';
  backdrop.innerHTML = `<div class="hxc-modal" onclick="event.stopPropagation()">
    <div class="hxc-modal-title">Nueva Sesión</div>
    <label>Nombre</label><input id="hxc-ns-nombre" placeholder="Batalla del bosque...">
    <label>Descripción (opcional)</label><textarea id="hxc-ns-desc" rows="2" placeholder="Contexto..."></textarea>
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
  if (!nombre) { _toast('Nombre requerido', true); return; }
  const desc = document.getElementById('hxc-ns-desc')?.value.trim() || '';
  try { await crearSesion(nombre, desc); document.querySelector('.hxc-modal-backdrop')?.remove(); _render(); _toast('Sesión creada'); }
  catch(e) { _toast('Error al crear sesión', true); }
};

// Navegar a turno — reconstruye slots desde DB si es histórico
window._hxcIrTurno = async (idxRaw) => {
  const idx = parseInt(idxRaw);
  const turno = hxState.turnos[idx];
  if (!turno) return;
  hxState.turnoActivo = turno;
  const esUltimo = idx === hxState.turnos.length - 1;

  // Siempre recargar historial de sesión para el turno activo
  await cargarHistorialSesion(hxState.sesionActiva?.id, turno.numero);

  if (!esUltimo) {
    const { data } = await supabase.from('hexcast_lanzamientos').select('*').eq('turno_id', turno.id).order('orden');
    const rows = data || [];

    // Reconstruir slots desde lanzamientos
    const grupoA = [null,null,null], grupoB = [null,null,null];
    const vistos = { A:[], B:[] };
    rows.forEach(row => {
      const g = row.grupo === 'B' ? 'B' : 'A';
      const arr = vistos[g];
      if (!arr.includes(row.personaje_nombre) && arr.length < 3) {
        const si = arr.length;
        arr.push(row.personaje_nombre);
        (g==='A'?grupoA:grupoB)[si] = { nombre: row.personaje_nombre, color: SLOT_COLORS[g][si] };
      }
    });
    hxState.grupoA = grupoA; hxState.grupoB = grupoB;

    // Inicializar cdPorPj desde los personajes reconstruidos
    [...grupoA, ...grupoB].filter(Boolean).forEach(slot => {
      const p = personajes[slot.nombre];
      if (p && !hxState.cdPorPj[slot.nombre]) {
        hxState.cdPorPj[slot.nombre] = {
          fisica: p.cd_fisica ?? 0.5, energetica: p.cd_energetica ?? 0.5,
          espiritual: p.cd_espiritual ?? 0.5, mando: p.cd_mando ?? 0.5,
          psiquica: p.cd_psiquica ?? 0.5, oscura: p.cd_oscura ?? 0.5
        };
      }
    });

    hxState.stack = rows.map(row => {
      const g   = row.grupo === 'B' ? 'B' : 'A';
      const arr = vistos[g];
      const si  = arr.indexOf(row.personaje_nombre);
      const color = SLOT_COLORS[g][Math.max(0, si)] || SLOT_COLORS.A[0];
      // Enrich with catalog data if available
      const cat = hxState.catalogoDB.find(h =>
        _norm(h.hechizo_id) === _norm(row.hechizo_id) || _norm(h.nombre) === _norm(row.hechizo_nombre)
      );
      return {
        id: row.id, pjNombre: row.personaje_nombre, grupo: g, slotIdx: si, color,
        hechizo: {
          hechizo_id: row.hechizo_id, nombre: row.hechizo_nombre,
          afinidad: row.hechizo_afinidad, hex_cost: row.hechizo_hex_cost,
          resumen: cat?.resumen || '', efecto: cat?.efecto || '',
          overcast: cat?.overcast || '', undercast: cat?.undercast || '',
          especial: cat?.especial || '', clase: cat?.clase || ''
        },
        infalible: row.infalible, cobrarHex: row.cobrar_hex, esPrioridad: row.es_prioridad,
        forceFallo: false,
        dado: row.dado_d100??'', afinidadEfectiva: row.afinidad_efectiva,
        mult: row.multiplicador_cd,
        costoBase: row.hechizo_hex_cost,    // HEX real cobrado
        ncNecesario: row.costo_efectivo,    // NC umbral (guardado en costo_efectivo)
        abierto: false, resultado: row.resultado, ncCalc: row.nc, hexGastado: row.hex_gastado
      };
    });
  } else {
    hxState.stack = [];
  }

  // Cargar estados del turno (chips en slots)
  hxState.estadosPorPj = {};
  await _cargarTodosEstadosTurno();
  // Cargar flechas del turno
  await cargarFlechasTurno(turno.id, hxState.sesionActiva?.id);
  _render();
};

// Eliminar turno completo
window._hxcEliminarTurno = async () => {
  const turno = hxState.turnoActivo;
  if (!turno) return;
  if (hxState.turnos.length <= 1) { _toast('No puedes eliminar el único turno', true); return; }
  if (!confirm(`¿Eliminar Turno ${turno.numero} y todos sus lanzamientos?`)) return;
  const { error } = await supabase.from('hexcast_turnos').delete().eq('id', turno.id);
  if (error) { _toast('Error: ' + error.message, true); return; }
  hxState.turnos = hxState.turnos.filter(t => t.id !== turno.id);
  await window._hxcIrTurno(hxState.turnos.length - 1);
  _toast('Turno eliminado');
};

// ── COBRAR HEX (solo OP) — VEX primero, luego HEX ────────────
window._hxcCobrarHex = async () => {
  if (!_esAdmin()) { _toast('Solo el OP puede cobrar HEX', true); return; }
  const stack = hxState.stack;
  if (!stack.length) { _toast('Stack vacío', true); return; }

  // Balance actual por PJ
  const bal = {};
  [...new Set(stack.map(i => i.pjNombre))].forEach(n => {
    const p = personajes[n];
    if (p) bal[n] = { vex: p.vex_actual || 0, hex: p.hex || 0 };
  });

  let algoCobrado = false;
  for (let i = 0; i < stack.length; i++) {
    const item = stack[i];
    if (!item.cobrarHex) continue;
    if (item.resultado !== 'exito' && item.resultado !== 'infalible') continue;
    const costo = item.costoBase; if (costo <= 0) continue; // HEX cobrado = costoBase
    const b = bal[item.pjNombre]; if (!b) continue;

    const vexGasto = Math.min(b.vex, costo);
    const hexGasto = costo - vexGasto;

    if (hexGasto > b.hex) {
      // No hay HEX suficiente → fallo_hex
      item.resultado = 'fallo_hex';
      continue;
    }

    b.vex -= vexGasto; b.hex -= hexGasto;
    item.hexGastado = costo;
    algoCobrado = true;
  }

  if (!algoCobrado) { _toast('Nada que cobrar', true); return; }

  // Aplicar a estado local y DB
  const errores = [];
  for (const [nombre, b2] of Object.entries(bal)) {
    const p = personajes[nombre]; if (!p) continue;
    p.vex_actual = b2.vex; p.hex = b2.hex;
    const { error } = await supabase.from('personajes').update({ vex_actual: b2.vex, hex: b2.hex }).eq('nombre', nombre);
    if (error) errores.push(nombre);
  }
  // Persistir resultados y hex_gastado en DB
  for (const item of stack) {
    if (item.id && typeof item.id === 'number') {
      await supabase.from('hexcast_lanzamientos')
        .update({ resultado: item.resultado, hex_gastado: item.hexGastado || 0 })
        .eq('id', item.id);
    }
  }

  if (errores.length) _toast('Error guardando: ' + errores.join(', '), true);
  else _toast('✦ HEX cobrado');
  _render();
};

// ── DEVOLVER HEX (solo OP) ────────────────────────────────────
window._hxcDevolverHex = async () => {
  if (!_esAdmin()) { _toast('Solo el OP puede devolver HEX', true); return; }
  const stack = hxState.stack;
  const conGasto = stack.filter(i => (i.hexGastado || 0) > 0);
  if (!conGasto.length) { _toast('No hay HEX gastado que devolver', true); return; }
  if (!confirm('¿Devolver todo el HEX cobrado en este turno a cada personaje?')) return;

  const porPj = {};
  conGasto.forEach(item => {
    porPj[item.pjNombre] = (porPj[item.pjNombre] || 0) + item.hexGastado;
    item.hexGastado = 0;
  });

  const errores = [];
  for (const [nombre, devolver] of Object.entries(porPj)) {
    const p = personajes[nombre]; if (!p) continue;
    p.hex = (p.hex || 0) + devolver;
    const { error } = await supabase.from('personajes').update({ hex: p.hex }).eq('nombre', nombre);
    if (error) errores.push(nombre);
  }
  const ids = conGasto.filter(i => i.id && typeof i.id === 'number').map(i => i.id);
  if (ids.length) await supabase.from('hexcast_lanzamientos').update({ hex_gastado: 0 }).in('id', ids);

  if (errores.length) _toast('Error: ' + errores.join(', '), true);
  else _toast('✦ HEX devuelto');
  _render();
};

window._hxcClickSlot = async (grupo, idx) => {
  if (fxClickSlot(grupo, parseInt(idx))) return; // interceptado por modo flecha
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const pj = slots[idx];
  if (!pj) { _abrirSelectorPJ(grupo, idx); return; }
  const p = hxState.panelSlot;
  if (p?.grupo === grupo && p?.idx === idx) { hxState.panelSlot = null; }
  _render();
};

window._hxcAbrirEvento = async (grupo, idx, pjNombre) => {
  hxState.panelSlot = { grupo, idx: parseInt(idx), tipo: null };
  try {
    const { abrirEventoPanel } = await import('./panel-hexcast-evento.js');
    await abrirEventoPanel(pjNombre, grupo, parseInt(idx));
  } catch(e) {
    console.error('panel-hexcast-evento.js no disponible:', e);
    _toast('Módulo de eventos no disponible', true);
  }
};

window._hxcEditarEvento = async (stackIdx) => {
  const item = hxState.stack[stackIdx];
  if (!item || item.tipoItem !== 'evento') return;
  try {
    const { abrirEventoPanel } = await import('./panel-hexcast-evento.js');
    // Pasar el índice del stack para que al guardar se reemplace en lugar de agregar
    await abrirEventoPanel(item.pjNombre, item.grupo, item.slotIdx, {
      stackIdx,
      nombre: item.eventoNombre,
      cambios: item._payload ? [...item._payload] : [],
    });
  } catch(e) {
    console.error('panel-hexcast-evento.js no disponible:', e);
    _toast('Módulo de eventos no disponible', true);
  }
};

window._hxcAbrirPanel = async (grupo, idx, tipo) => {
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const pj = slots[idx]; if (!pj) return;
  const p = hxState.panelSlot;
  // Toggle: si ya está este panel abierto con este tipo, cerrarlo
  if (p?.grupo === grupo && p?.idx === idx && p?.tipo === tipo) {
    hxState.panelSlot = null;
    _render(); return;
  }
  hxState.panelSlot = { grupo, idx, tipo };
  hxState.busquedaHz = '';
  if (tipo === 'hechizos') await cargarInventarioPJ(pj.nombre);
  if (tipo === 'estados') await _cargarEstadosPJ(pj.nombre);
  _render();
};

window._hxcCerrarPanel = () => { hxState.panelSlot = null; _render(); };
window._hxcCerrarInv = () => { hxState.panelSlot = null; _render(); };
window._hxcBuscarHz  = (val) => { hxState.busquedaHz = val; _render(); };

window._hxcQuitarPJ = (grupo, idx) => {
  if (grupo === 'A') hxState.grupoA[idx] = null; else hxState.grupoB[idx] = null;
  if (hxState.panelSlot?.grupo === grupo && hxState.panelSlot?.idx === idx) hxState.panelSlot = null;
  _render();
};

function _abrirSelectorPJ(grupo, idx) {
  const asignados = new Set([...hxState.grupoA,...hxState.grupoB].filter(Boolean).map(p=>p.nombre));
  const disponibles = Object.entries(personajes).filter(([n])=>!asignados.has(n)).sort(([a],[b])=>a.localeCompare(b));
  const rows = disponibles.map(([nombre, p]) => `
    <div class="hxc-pj-row" onclick="window._hxcAsignarPJ('${grupo}',${idx},'${nombre.replace(/'/g,"\\'")}')">
      <img src="${imgPj(nombre)}" onerror="this.src='${imgFallback()}'">
      <div class="hxc-pj-row-info">
        <div class="hxc-pj-row-nombre">${nombre}</div>
        <div class="hxc-pj-row-hex">${(p.hex??0).toLocaleString()} HEX · ${(p.vex_actual??0).toLocaleString()} VEX</div>
      </div>
    </div>`).join('');
  const backdrop = document.createElement('div');
  backdrop.className = 'hxc-modal-backdrop';
  backdrop.innerHTML = `<div class="hxc-pj-modal" onclick="event.stopPropagation()">
    <div class="hxc-pj-modal-title">Asignar — Grupo ${grupo}</div>
    <div class="hxc-pj-modal-list">${rows||'<div style="color:#333;font-size:0.7em;padding:12px;">Sin disponibles</div>'}</div>
  </div>`;
  backdrop.onclick = () => backdrop.remove();
  document.body.appendChild(backdrop);
}

window._hxcAsignarPJ = (grupo, idx, nombre) => {
  document.querySelector('.hxc-modal-backdrop')?.remove();
  const color = SLOT_COLORS[grupo][idx];
  if (grupo === 'A') hxState.grupoA[idx] = { nombre, color }; else hxState.grupoB[idx] = { nombre, color };
  const p = personajes[nombre];
  if (p) hxState.cdPorPj[nombre] = { fisica:p.cd_fisica??0.5, energetica:p.cd_energetica??0.5, espiritual:p.cd_espiritual??0.5, mando:p.cd_mando??0.5, psiquica:p.cd_psiquica??0.5, oscura:p.cd_oscura??0.5 };
  _render();
};

window._hxcCerrarInv = () => { hxState.pjSeleccionado = null; _render(); };
window._hxcBuscarHz  = (val) => { hxState.busquedaHz = val; _render(); };

window._hxcAgregarHz = (grupo, idx, hzId) => {
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const pj = slots[idx]; if (!pj) return;
  const inv = hxState.inventarioPJ[pj.nombre] || [];
  const hz = hxState.catalogoDB.find(h=>_norm(h.hechizo_id)===hzId||_norm(h.nombre)===hzId)
          || inv.find(h=>_norm(h.hechizo_id||h.nombre)===hzId);
  if (!hz) return;
  agregarHechizo(pj.nombre, grupo, idx, hz);
  _render();
};

// ── Estados activos (por turno) ───────────────────────────────
// Carga los estados del PJ para el turno activo
async function _cargarEstadosPJ(nombre) {
  const turnoId = hxState.turnoActivo?.id;
  if (!turnoId) { hxState.estadosPorPj[nombre] = []; return; }
  const { data } = await supabase.from('pj_estados')
    .select('*')
    .eq('turno_id', turnoId)
    .eq('personaje_nombre', nombre)
    .order('creado_en');
  hxState.estadosPorPj[nombre] = data || [];
}

// Carga estados de TODOS los PJs visibles en el turno actual (para los chips del slot)
async function _cargarTodosEstadosTurno() {
  const turnoId = hxState.turnoActivo?.id;
  if (!turnoId) { hxState.estadosPorPj = {}; return; }
  const nombres = [
    ...hxState.grupoA.filter(Boolean).map(p => p.nombre),
    ...hxState.grupoB.filter(Boolean).map(p => p.nombre)
  ];
  if (!nombres.length) return;
  const { data } = await supabase.from('pj_estados')
    .select('*')
    .eq('turno_id', turnoId)
    .in('personaje_nombre', nombres);
  hxState.estadosPorPj = {};
  for (const row of (data || [])) {
    if (!hxState.estadosPorPj[row.personaje_nombre]) hxState.estadosPorPj[row.personaje_nombre] = [];
    hxState.estadosPorPj[row.personaje_nombre].push(row);
  }
}

window._hxcAgregarEstado = async (nombre, hechizo_id, hechizo_nombre, afinidad) => {
  const turnoId   = hxState.turnoActivo?.id;
  const sesionId  = hxState.sesionActiva?.id;
  if (!turnoId) { _toast('Sin turno activo', true); return; }
  const actuales = hxState.estadosPorPj[nombre] || [];
  if (actuales.find(e => e.hechizo_id === hechizo_id)) {
    _toast('Este estado ya está activo en este turno', true); return;
  }
  const { data, error } = await supabase.from('pj_estados')
    .insert({ turno_id: turnoId, sesion_id: sesionId, personaje_nombre: nombre, hechizo_id, hechizo_nombre, afinidad })
    .select().single();
  if (error) { _toast('Error: ' + error.message, true); return; }
  hxState.estadosPorPj[nombre] = [...actuales, data];
  _toast(`✦ ${hechizo_nombre} → ${nombre}`);
  _render();
};

window._hxcQuitarEstado = async (nombre, estadoId) => {
  const { error } = await supabase.from('pj_estados').delete().eq('id', estadoId);
  if (error) { _toast('Error: ' + error.message, true); return; }
  hxState.estadosPorPj[nombre] = (hxState.estadosPorPj[nombre] || []).filter(e => e.id !== estadoId);
  _toast('Estado quitado');
  _render();
};

// ── Evento ────────────────────────────────────────────────────
window._hxcConfirmarEvento = (grupo, idx) => {
  const slots = grupo === 'A' ? hxState.grupoA : hxState.grupoB;
  const pj = slots[idx]; if (!pj) return;
  const tipo   = document.getElementById('hxc-ev-tipo')?.value || 'evento';
  const nombre = document.getElementById('hxc-ev-nombre')?.value.trim() || '';
  const desc   = document.getElementById('hxc-ev-desc')?.value.trim() || '';
  if (!nombre) { _toast('El evento necesita un nombre', true); return; }

  const color = SLOT_COLORS[grupo][idx];
  hxState.stack.push({
    id: 'ev_' + Date.now(),
    tipoItem: 'evento',
    pjNombre: pj.nombre,
    grupo, slotIdx: idx, color,
    eventoTipo: tipo,
    eventoNombre: nombre,
    eventoDesc: desc,
    abierto: false
  });
  hxState.panelSlot = null;
  _render();
  _toast(`✦ Evento: ${nombre}`);
};

window._hxcToggleItem = (idx) => {
  if (fxClickItem(parseInt(idx))) return; // interceptado por modo flecha
  hxState.stack[idx].abierto = !hxState.stack[idx].abierto;
  _render();
};

window._hxcSetDado = (idx, val) => {
  const item = hxState.stack[idx]; if (!item) return;
  item.dado = val; evaluarItem(item);
  const el = document.querySelector(`[data-hxc-idx="${idx}"]`);
  if (el) _actualizarResEl(el, item);
  // If historico and admin, persist
  const turnoIdx = hxState.turnos.findIndex(t => t.id === hxState.turnoActivo?.id);
  const esHistorico = turnoIdx < hxState.turnos.length - 1;
  if (esHistorico && _esAdmin()) window._hxcGuardarItemDB(item);
};

window._hxcDadoKeydown = (e, idx) => {
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    const next = document.querySelector(`[data-hxc-item="${idx+1}"]`);
    if (next) { next.focus(); next.select?.(); }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = document.querySelector(`[data-hxc-item="${idx+1}"]`);
    if (next) { next.focus(); next.select?.(); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = document.querySelector(`[data-hxc-item="${idx-1}"]`);
    if (prev) { prev.focus(); prev.select?.(); }
  }
};

function _actualizarResEl(el, item) {
  const resEl = el.querySelector('.hxc-item-resultado'); if (!resEl) return;
  el.classList.remove('res-exito','res-fallo','res-infalible','res-fallo_hex');
  if      (item.resultado==='exito')     { resEl.innerHTML='¡Éxito!'; resEl.className='hxc-item-resultado hxc-res-exito'; el.classList.add('res-exito'); }
  else if (item.resultado==='fallo')     { resEl.innerHTML='¡Fallo!'; resEl.className='hxc-item-resultado hxc-res-fallo'; el.classList.add('res-fallo'); }
  else if (item.resultado==='infalible') { resEl.innerHTML='Infalible'; resEl.className='hxc-item-resultado hxc-res-infalible'; el.classList.add('res-infalible'); }
  else if (item.resultado==='fallo_hex') { resEl.innerHTML='Sin HEX'; resEl.className='hxc-item-resultado hxc-res-fallo_hex'; el.classList.add('res-fallo_hex'); }
  else { resEl.textContent=`${item.costoBase} HEX`; resEl.className='hxc-item-resultado'; resEl.style.color='#444'; }
  const ncEl = el.querySelector('.hxc-nc-calc');
  if (ncEl && item.ncCalc!==null) {
    const nc=item.ncCalc, req=item.ncNecesario;
    ncEl.innerHTML=`NC: <strong>${nc}</strong> / necesario: ${req} — ${nc>=req?'<span style="color:#3ecf6e;">ÉXITO</span>':'<span style="color:#e85050;">FALLO</span>'}`;
  }
}

window._hxcToggleOpt = (idx, campo) => { const item=hxState.stack[idx]; if(!item) return; item[campo]=!item[campo]; if(campo==='infalible') evaluarItem(item); _render(); };

window._hxcToggleInfalible = (idx) => {
  const item = hxState.stack[idx]; if (!item) return;
  item.infalible = !item.infalible;
  if (item.infalible) item.forceFallo = false;
  evaluarItem(item);
  const turnoIdx = hxState.turnos.findIndex(t => t.id === hxState.turnoActivo?.id);
  const esHistorico = turnoIdx < hxState.turnos.length - 1;
  if (esHistorico && _esAdmin()) window._hxcGuardarItemDB(item);
  _render();
};

window._hxcToggleFallo = (idx) => {
  const item = hxState.stack[idx]; if (!item) return;
  item.forceFallo = !item.forceFallo;
  if (item.forceFallo) { item.infalible = false; }
  evaluarItem(item);
  const turnoIdx = hxState.turnos.findIndex(t => t.id === hxState.turnoActivo?.id);
  const esHistorico = turnoIdx < hxState.turnos.length - 1;
  if (esHistorico && _esAdmin()) window._hxcGuardarItemDB(item);
  _render();
};
window._hxcSetPrioridad = (idx) => { moverAPrioridad(hxState.stack[idx].id); _render(); };

// ── CD editable por OP ────────────────────────────────────────
// Ajusta el CD del PJ para la afinidad del item y recalcula el stack
// nuevoCdPct: valor en porcentaje entero (ej. 40 = 0.40)
function _aplicarCdCambio(stackIdx, nuevoCdPct) {
  const item = hxState.stack[stackIdx]; if (!item) return;
  const afKey = (item.hechizo?.afinidad || '').toLowerCase();
  if (!hxState.cdPorPj[item.pjNombre]) hxState.cdPorPj[item.pjNombre] = {};
  const cdValido = Math.max(0, Math.round(nuevoCdPct)) / 100; // pct → decimal, sin float drift
  hxState.cdPorPj[item.pjNombre][afKey] = cdValido;
  // Recalcular todos los mults del stack con el nuevo CD
  const vistoStack = {};
  hxState.stack.forEach(it => {
    const af = (it.hechizo?.afinidad || '').toLowerCase();
    const k  = `${it.pjNombre}:${af}`;
    const previosStack = vistoStack[k] || 0;
    const lastMult = hxState.historialSesion[k] || 0;
    const cd = hxState.cdPorPj[it.pjNombre]?.[af] ?? 0.5;
    let mult;
    if (lastMult === 0 && previosStack === 0) { mult = 1.0; }
    else if (lastMult === 0) { mult = 1.0 + previosStack * cd; }
    else { mult = lastMult + (1 + previosStack) * cd; }
    it.mult = mult;
    it.ncNecesario = Math.round(it.costoBase * mult);
    vistoStack[k] = previosStack + 1;
  });
  _render();
}

window._hxcCdSet  = (stackIdx, pct) => { if (!isNaN(pct) && pct >= 0) _aplicarCdCambio(stackIdx, pct); };
window._hxcCdStep = (stackIdx, deltaPct) => {
  const item = hxState.stack[stackIdx]; if (!item) return;
  const afKey = (item.hechizo?.afinidad || '').toLowerCase();
  // Leer CD actual en porcentaje entero
  const cdDec = hxState.cdPorPj[item.pjNombre]?.[afKey]
    ?? (personajes[item.pjNombre]?.['cd_' + afKey] ?? 0.5);
  const actualPct = Math.round(cdDec * 100);
  const nuevoPct  = Math.max(0, actualPct + deltaPct);
  _aplicarCdCambio(stackIdx, nuevoPct);
  // Actualizar el input visualmente sin esperar re-render completo
  const el = document.querySelector(`[data-hxc-idx="${stackIdx}"] .hxc-cd-edit-input`);
  if (el) el.value = nuevoPct;
};

window._hxcRemover = async (idx) => {
  const item = hxState.stack[idx]; if (!item) return;
  // If historico item with real DB id, delete from DB
  if (item.id && typeof item.id === 'number') {
    await supabase.from('hexcast_lanzamientos').delete().eq('id', item.id);
  }
  removerHechizo(item.id);
  _render();
};

// Save a single historico item back to DB (OP edit)
window._hxcGuardarItemDB = async (item) => {
  if (!item.id || typeof item.id !== 'number') return;
  const dado = parseInt(item.dado) || null;
  await supabase.from('hexcast_lanzamientos').update({
    dado_d100: dado,
    infalible: item.infalible,
    resultado: item.resultado,
    nc: item.ncCalc,
    costo_efectivo: item.ncNecesario,  // NC umbral guardado en costo_efectivo
    hex_gastado: item.hexGastado || 0,
  }).eq('id', item.id);
};

// Guardar stack actual en un turno histórico (OP puede editar turnos pasados)
window._hxcGuardarHistorico = async () => {
  if (!_esAdmin()) { _toast('Solo el OP puede guardar turnos históricos', true); return; }
  const turno = hxState.turnoActivo;
  if (!turno) return;

  // Evaluar todos los items antes de guardar
  hxState.stack.forEach(item => evaluarItem(item));

  // Separar items con ID de DB (existentes) de items nuevos (sin ID numérico)
  const existentes = hxState.stack.filter(i => i.id && typeof i.id === 'number' && i.tipoItem !== 'evento');
  const nuevos     = hxState.stack.filter(i => (!i.id || typeof i.id !== 'number') && i.tipoItem !== 'evento');

  // Actualizar los existentes
  for (const item of existentes) {
    const dado = parseInt(item.dado) || null;
    const hexGastado = (item.resultado === 'exito' || item.resultado === 'infalible') && item.cobrarHex
      ? item.costoBase : 0;
    item.hexGastado = hexGastado;
    const { error } = await supabase.from('hexcast_lanzamientos').update({
      dado_d100:        dado,
      infalible:        item.infalible,
      cobrar_hex:       item.cobrarHex,
      es_prioridad:     item.esPrioridad,
      resultado:        item.resultado,
      nc:               item.ncCalc,
      costo_efectivo:   item.ncNecesario,
      multiplicador_cd: item.mult,
      hex_gastado:      hexGastado,
      orden:            hxState.stack.indexOf(item)
    }).eq('id', item.id);
    if (error) { _toast('Error actualizando: ' + error.message, true); return; }
  }

  // Insertar los nuevos
  if (nuevos.length > 0) {
    const rows = nuevos.map(item => {
      const dado = parseInt(item.dado) || null;
      const hexGastado = (item.resultado === 'exito' || item.resultado === 'infalible') && item.cobrarHex
        ? item.costoBase : 0;
      item.hexGastado = hexGastado;
      return {
        turno_id:           turno.id,
        sesion_id:          hxState.sesionActiva.id,
        personaje_nombre:   item.pjNombre,
        grupo:              item.grupo,
        hechizo_id:         item.hechizo.hechizo_id,
        hechizo_nombre:     item.hechizo.nombre,
        hechizo_afinidad:   item.hechizo.afinidad || '',
        hechizo_hex_cost:   item.costoBase,
        dado_d100:          dado,
        afinidad_efectiva:  item.afinidadEfectiva,
        infalible:          item.infalible,
        cobrar_hex:         item.cobrarHex,
        es_prioridad:       item.esPrioridad,
        nc:                 item.ncCalc,
        costo_efectivo:     item.ncNecesario,
        multiplicador_cd:   item.mult,
        resultado:          item.resultado,
        hex_gastado:        hexGastado,
        orden:              hxState.stack.indexOf(item)
      };
    });
    const { data: insertados, error } = await supabase
      .from('hexcast_lanzamientos').insert(rows).select();
    if (error) { _toast('Error guardando: ' + error.message, true); return; }
    // Asignar IDs reales a los items nuevos para futuras ediciones
    if (insertados) {
      insertados.forEach((row, i) => { nuevos[i].id = row.id; });
    }
  }

  _toast('✦ Turno guardado');
  _render();
};

window._hxcNuevoTurno = async () => {
  if (!hxState.sesionActiva) return;
  if (hxState.stack.length > 0 && !confirm('¿Empezar nuevo turno? El stack actual se vaciará.')) return;
  const turnoAnteriorId = hxState.turnoActivo?.id;
  const nuevoTurno = await crearTurno(hxState.sesionActiva.id, hxState.turnos.length + 1);
  hxState.turnoActivo = nuevoTurno;
  hxState.stack = [];
  // Carry-forward: copiar estados del turno anterior al nuevo
  await _carryForwardEstados(turnoAnteriorId, nuevoTurno.id, hxState.sesionActiva.id);
  await _cargarTodosEstadosTurno();
  _render();
};

window._hxcConfirmar = async () => {
  const hechizos = hxState.stack.filter(i => i.tipoItem !== 'evento');
  if (!hechizos.length) { _toast('Stack vacío (solo eventos, sin hechizos)', true); return; }
  const turnoAnteriorId = hxState.turnoActivo?.id;
  const res = await confirmarTurno();
  if (!res.ok) { _toast('Error: ' + res.msg, true); return; }
  // Carry-forward: copiar estados al nuevo turno creado por confirmarTurno
  const nuevoTurno = hxState.turnoActivo; // confirmarTurno ya actualizó turnoActivo
  await _carryForwardEstados(turnoAnteriorId, nuevoTurno.id, hxState.sesionActiva.id);
  await _cargarTodosEstadosTurno();
  _toast('✦ Turno ' + (nuevoTurno?.numero??'') + ' confirmado');
  _render();
};

// Copia los estados activos del turno anterior al turno nuevo (carry-forward)
async function _carryForwardEstados(turnoAnteriorId, nuevoTurnoId, sesionId) {
  if (!turnoAnteriorId || !nuevoTurnoId) return;
  const { data } = await supabase.from('pj_estados')
    .select('personaje_nombre, hechizo_id, hechizo_nombre, afinidad, notas')
    .eq('turno_id', turnoAnteriorId);
  if (!data || !data.length) return;
  const rows = data.map(e => ({
    turno_id:         nuevoTurnoId,
    sesion_id:        sesionId,
    personaje_nombre: e.personaje_nombre,
    hechizo_id:       e.hechizo_id,
    hechizo_nombre:   e.hechizo_nombre,
    afinidad:         e.afinidad || '',
    notas:            e.notas || ''
  }));
  await supabase.from('pj_estados').insert(rows);
}

_montar();
