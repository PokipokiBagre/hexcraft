// ============================================================
// panel-pj.js — Panel lateral de personaje con 5 pestañas
// Reemplaza la lógica de renderDetalle() en personajes-ui.js
// Importar y llamar: abrirPanelPJ(nombre) / cerrarPanelPJ()
//
// Dependencias (ya en el proyecto):
//   personajes-state.js  → personajes, estadoUI
//   personajes-logic.js  → calcularStats, buildContext, evalExpr,
//                          calcularPushDisponibles, calcularValorPush,
//                          calcularCooldownPush, getMayorAfinidad
//   hex-auth.js          → currentConfig (storageUrl)
//   supabase             → vía hex-auth.js
// ============================================================

import { personajes, estadoUI, formulas } from './personajes-state.js';
import {
    calcularStats, buildContext, evalExpr,
    calcularPushDisponibles, calcularValorPush, calcularCooldownPush
} from './personajes-logic.js';
import { currentConfig, supabase } from '../hex-auth.js';
import { encolarCambio } from './personajes-state.js';

// ── Helpers ───────────────────────────────────────────────────
const _sb   = () => currentConfig.storageUrl;
const _norm = (s) => s ? s.toString().trim().toLowerCase()
    .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';

const _imgPj   = (icono) => `${_sb()}/imgpersonajes/${_norm(icono)}.png`;
const _imgIcon = (icono) => `${_sb()}/imgpersonajes/${_norm(icono)}icon.png`;
const _fallback = () => `${_sb()}/imginterfaz/no_encontrado.png`;

// Tab activo por personaje (persiste al volver)
const _tabActivo = {};

// ─────────────────────────────────────────────────────────────
// INYECTAR ESTILOS (una sola vez)
// ─────────────────────────────────────────────────────────────
function _inyectarEstilos() {
    if (document.getElementById('panel-pj-styles')) return;
    const st = document.createElement('style');
    st.id = 'panel-pj-styles';
    st.textContent = `
/* ══ PANEL RAÍZ ══════════════════════════════════════════════ */
#panel-pj-root {
    position: fixed;
    top: 0; right: 0;
    width: 420px;
    height: 100vh;
    background: #08080f;
    border-left: 1px solid rgba(212,175,55,0.18);
    display: flex;
    flex-direction: column;
    z-index: 1200;
    transform: translateX(100%);
    transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
    font-family: 'Inter', system-ui, sans-serif;
    box-shadow: -8px 0 40px rgba(0,0,0,0.6);
}
#panel-pj-root.open { transform: translateX(0); }

#panel-pj-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 1199;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.28s;
}
#panel-pj-overlay.open { opacity: 1; pointer-events: all; }

/* ══ HEADER ══════════════════════════════════════════════════ */
.ppj-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    min-height: 68px;
}
.ppj-avatar {
    width: 44px; height: 44px;
    border-radius: 8px;
    object-fit: cover; object-position: top;
    border: 1px solid rgba(212,175,55,0.3);
    flex-shrink: 0;
    cursor: pointer;
    transition: border-color 0.2s;
}
.ppj-avatar:hover { border-color: rgba(212,175,55,0.8); }
.ppj-header-info { flex: 1; min-width: 0; }
.ppj-nombre {
    font-family: 'Cinzel', serif;
    font-size: 0.95em;
    color: #e8e8e8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.5px;
}
.ppj-tags { display: flex; gap: 5px; margin-top: 3px; flex-wrap: wrap; }
.ppj-tag {
    font-size: 0.63em;
    padding: 2px 7px;
    border-radius: 10px;
    letter-spacing: 0.5px;
    font-weight: 500;
    text-transform: uppercase;
}
.ppj-tag-jugador   { background: rgba(212,175,55,0.12); color: #d4af37; border: 1px solid rgba(212,175,55,0.25); }
.ppj-tag-npc       { background: rgba(90,90,120,0.2);   color: #aaa;    border: 1px solid rgba(90,90,120,0.3); }
.ppj-tag-activo    { background: rgba(62,207,110,0.1);  color: #3ecf6e; border: 1px solid rgba(62,207,110,0.2); }
.ppj-tag-inactivo  { background: rgba(200,60,60,0.1);   color: #c44;    border: 1px solid rgba(200,60,60,0.2); }
.ppj-header-btns   { display: flex; gap: 6px; align-items: center; }
.ppj-btn-icon {
    background: none; border: none;
    color: #5a5a78; font-size: 1.05em;
    cursor: pointer; padding: 4px 6px;
    border-radius: 5px;
    transition: color 0.15s, background 0.15s;
    line-height: 1;
}
.ppj-btn-icon:hover { color: #d4af37; background: rgba(212,175,55,0.08); }
.ppj-close { font-size: 1.3em; }

/* ══ TABS ════════════════════════════════════════════════════ */
.ppj-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    background: #0a0a14;
}
.ppj-tab {
    flex: 1;
    background: none;
    border: none;
    color: #4a4a68;
    font-size: 0.68em;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    padding: 10px 4px 9px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    font-family: 'Inter', system-ui, sans-serif;
}
.ppj-tab:hover  { color: #888; }
.ppj-tab.active { color: #d4af37; border-bottom-color: #d4af37; }

/* ══ BODY ════════════════════════════════════════════════════ */
.ppj-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 0 60px;
    scrollbar-width: thin;
    scrollbar-color: rgba(212,175,55,0.2) transparent;
}
.ppj-body::-webkit-scrollbar { width: 4px; }
.ppj-body::-webkit-scrollbar-track { background: transparent; }
.ppj-body::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 2px; }

.ppj-section {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
}
.ppj-section-title {
    font-size: 0.62em;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #3a3a58;
    font-weight: 600;
    margin-bottom: 10px;
}

/* ══ TAB HEX ════════════════════════════════════════════════ */
.ppj-hex-val {
    font-family: 'Cinzel', serif;
    font-size: 2.4em;
    color: #d4af37;
    text-align: center;
    padding: 18px 0 10px;
    letter-spacing: 2px;
}
.ppj-hex-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    margin-top: 6px;
}
.ppj-hex-btn {
    background: rgba(212,175,55,0.06);
    border: 1px solid rgba(212,175,55,0.15);
    border-radius: 6px;
    color: #d4af37;
    font-size: 0.75em;
    padding: 6px 2px;
    cursor: pointer;
    transition: background 0.15s;
    font-weight: 600;
}
.ppj-hex-btn:hover { background: rgba(212,175,55,0.15); }
.ppj-hex-btn.neg { color: #e06060; border-color: rgba(220,80,80,0.2); background: rgba(220,80,80,0.05); }
.ppj-hex-btn.neg:hover { background: rgba(220,80,80,0.12); }
.ppj-asistencia {
    text-align: center;
    color: #5a5a78;
    font-size: 0.78em;
    margin-top: 14px;
}
.ppj-asistencia strong { color: #9090b0; }

/* ══ TAB STATS ══════════════════════════════════════════════ */
.ppj-vida-block { margin-bottom: 12px; }
.ppj-vida-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
}
.ppj-vida-label { font-size: 0.78em; color: #888; font-weight: 500; }
.ppj-vida-ctrl {
    display: flex;
    align-items: center;
    gap: 6px;
}
.ppj-vida-xy {
    font-size: 0.88em;
    font-weight: 600;
    color: #ccc;
}
.ppj-vida-xy .actual { color: #e8e8e8; }
.ppj-vida-xy .sep    { color: #3a3a58; margin: 0 2px; }
.ppj-vida-xy .maximo { color: #5a5a78; }
.ppj-ctrl-btn {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 4px;
    color: #888;
    width: 22px; height: 22px;
    font-size: 0.85em;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, color 0.15s;
}
.ppj-ctrl-btn:hover { background: rgba(255,255,255,0.1); color: #ccc; }

/* Barras segmentadas */
.ppj-seg-bar {
    display: flex;
    gap: 2px;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
}
.ppj-seg { height: 100%; border-radius: 1px; transition: background 0.2s; }
.ppj-seg.on-vida   { background: #d4af37; }
.ppj-seg.off-vida  { background: rgba(212,175,55,0.12); }
.ppj-seg.on-azul   { background: #4ab3e8; }
.ppj-seg.off-azul  { background: rgba(74,179,232,0.1); }
.ppj-seg.on-guarda { background: #d4af37; opacity: 0.8; }
.ppj-seg.off-guarda{ background: rgba(212,175,55,0.08); }

/* VEX bar */
.ppj-vex-bar {
    height: 6px; border-radius: 3px;
    background: rgba(160,80,220,0.12);
    overflow: hidden; margin-top: 5px;
}
.ppj-vex-fill { height: 100%; background: #9a50dc; border-radius: 3px; transition: width 0.3s; }

.ppj-formula { font-size: 0.62em; color: #2e2e48; font-family: monospace; margin-top: 3px; }

/* Override máx */
.ppj-max-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0 8px;
    padding: 5px 8px;
    background: rgba(255,255,255,0.02);
    border-radius: 5px;
    border: 1px solid rgba(255,255,255,0.04);
}
.ppj-max-label { font-size: 0.68em; color: #3a3a58; flex: 1; }
.ppj-max-val   { font-size: 0.8em; color: #888; min-width: 28px; text-align: center; font-weight: 600; }
.ppj-max-val.formula { color: #4a4a68; }
.ppj-max-val.manual  { color: #d4af37; }
.ppj-hint { font-size: 0.6em; color: #3a3a58; }
.ppj-hint.manual { color: rgba(212,175,55,0.5); }

/* Afinidades */
.ppj-afin-block {
    background: rgba(255,255,255,0.02);
    border-radius: 7px;
    border: 1px solid rgba(255,255,255,0.04);
    padding: 10px 12px;
    margin-bottom: 7px;
}
.ppj-afin-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}
.ppj-afin-name  { font-size: 0.78em; color: #9090b0; font-weight: 500; }
.ppj-afin-total { font-size: 1em; color: #d4af37; font-weight: 700; }
.ppj-afin-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
}
.ppj-afin-src-lbl {
    font-size: 0.6em;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 1px 5px;
    border-radius: 3px;
    width: 28px; text-align: center;
}
.src-b   { background: rgba(100,150,255,0.12); color: #6496ff; }
.src-ext { background: rgba(212,175,55,0.1);  color: #d4af37; }
.src-alt { background: rgba(220,100,100,0.1); color: #e08080; }
.ppj-afin-val { font-size: 0.82em; color: #ccc; min-width: 24px; text-align: center; font-weight: 600; }

/* Push */
.ppj-push-block {
    background: rgba(255,255,255,0.02);
    border-radius: 7px;
    border: 1px solid rgba(255,255,255,0.04);
    padding: 10px 12px;
    margin-bottom: 8px;
}
.ppj-push-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 6px;
}
.ppj-push-label { font-size: 0.78em; color: #9090b0; font-weight: 600; }
.ppj-push-dots  { display: flex; gap: 4px; }
.ppj-dot { width: 8px; height: 8px; border-radius: 50%; }
.ppj-dot.used  { background: #d4af37; }
.ppj-dot.avail { background: rgba(212,175,55,0.2); border: 1px solid rgba(212,175,55,0.3); }
.ppj-push-info {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 6px;
}
.ppj-push-valor { font-size: 0.72em; color: #5a5a78; }
.ppj-push-cd { font-size: 0.7em; color: #e09040; margin-top: 4px; }
.btn-push-pj {
    background: rgba(212,175,55,0.1);
    border: 1px solid rgba(212,175,55,0.3);
    border-radius: 5px;
    color: #d4af37;
    font-size: 0.72em;
    font-weight: 600;
    padding: 5px 12px;
    cursor: pointer;
    transition: background 0.15s;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.5px;
}
.btn-push-pj:hover:not(:disabled) { background: rgba(212,175,55,0.2); }
.btn-push-pj:disabled { opacity: 0.4; cursor: default; }

/* ══ TAB HECHIZOS ═══════════════════════════════════════════ */
.ppj-hechizo-card {
    background: rgba(255,255,255,0.02);
    border-radius: 7px;
    border: 1px solid rgba(255,255,255,0.04);
    padding: 10px 12px;
    margin-bottom: 6px;
    cursor: default;
    transition: border-color 0.15s;
}
.ppj-hechizo-card:hover { border-color: rgba(255,255,255,0.08); }
.ppj-hechizo-header {
    display: flex; align-items: flex-start; gap: 8px;
}
.ppj-hechizo-af {
    font-size: 0.58em;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    margin-top: 1px;
    text-transform: uppercase;
}
.ppj-hechizo-nombre { font-size: 0.82em; font-weight: 600; color: #d0d0e0; flex: 1; }
.ppj-hechizo-clase  { font-size: 0.62em; color: #4a4a68; margin-left: auto; flex-shrink: 0; }
.ppj-hechizo-desc   { font-size: 0.72em; color: #5a5a78; margin-top: 5px; line-height: 1.5; }
.ppj-hechizo-hex    {
    font-size: 0.65em; color: #8a6a20;
    margin-top: 4px;
    font-family: 'Cinzel', serif;
}

.ppj-aprendibles-grupo {
    margin-bottom: 10px;
}
.ppj-aprendibles-req {
    font-size: 0.63em; color: #4a4a68;
    margin-bottom: 5px;
    letter-spacing: 0.3px;
    padding: 3px 8px;
    background: rgba(255,255,255,0.02);
    border-radius: 3px;
    border-left: 2px solid rgba(255,255,255,0.06);
}

/* ══ TAB OBJETOS ════════════════════════════════════════════ */
.ppj-obj-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.02);
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.04);
    margin-bottom: 5px;
}
.ppj-obj-cant {
    font-size: 0.75em;
    font-weight: 700;
    color: #d4af37;
    min-width: 28px;
    text-align: center;
}
.ppj-obj-info { flex: 1; min-width: 0; }
.ppj-obj-nombre { font-size: 0.8em; color: #ccc; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ppj-obj-det    { font-size: 0.65em; color: #5a5a78; margin-top: 2px; }
.ppj-obj-eqp    { font-size: 0.62em; padding: 2px 7px; border-radius: 10px; }
.ppj-obj-eqp.on  { background: rgba(212,175,55,0.1); color: #d4af37; border: 1px solid rgba(212,175,55,0.2); }
.ppj-obj-eqp.off { background: rgba(255,255,255,0.03); color: #3a3a58; border: 1px solid rgba(255,255,255,0.05); }

/* ══ TAB MISIONES ═══════════════════════════════════════════ */
.ppj-mision-card {
    background: rgba(255,255,255,0.02);
    border-radius: 7px;
    border: 1px solid rgba(255,255,255,0.04);
    padding: 11px 13px;
    margin-bottom: 7px;
}
.ppj-mis-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; margin-bottom: 5px; }
.ppj-mis-titulo { font-size: 0.82em; font-weight: 600; color: #c8c8d8; flex: 1; }
.ppj-mis-clase  { font-size: 0.62em; color: #4a4a68; flex-shrink: 0; }
.ppj-mis-badge  { font-size: 0.62em; padding: 2px 8px; border-radius: 10px; margin-bottom: 5px; display: inline-block; }
.ppj-mis-0 { background: rgba(100,100,100,0.1); color: #666; border: 1px solid rgba(100,100,100,0.2); }
.ppj-mis-1 { background: rgba(212,175,55,0.1);  color: #d4af37; border: 1px solid rgba(212,175,55,0.2); }
.ppj-mis-2 { background: rgba(74,179,232,0.1);  color: #4ab3e8; border: 1px solid rgba(74,179,232,0.2); }
.ppj-mis-3 { background: rgba(62,207,110,0.1);  color: #3ecf6e; border: 1px solid rgba(62,207,110,0.2); }
.ppj-mis-desc { font-size: 0.7em; color: #5a5a78; line-height: 1.5; margin-top: 4px; }

/* ══ UPLOAD IMAGEN ══════════════════════════════════════════ */
.ppj-img-preview {
    width: 100%; max-height: 180px;
    object-fit: cover; object-position: top;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.06);
    display: block;
    margin-bottom: 10px;
    cursor: pointer;
    transition: border-color 0.2s;
}
.ppj-img-preview:hover { border-color: rgba(212,175,55,0.3); }
.ppj-upload-zone {
    border: 1px dashed rgba(212,175,55,0.25);
    border-radius: 7px;
    padding: 14px;
    text-align: center;
    font-size: 0.75em;
    color: #4a4a68;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
}
.ppj-upload-zone:hover { border-color: rgba(212,175,55,0.5); background: rgba(212,175,55,0.04); color: #888; }

/* ══ EMPTY STATES ══════════════════════════════════════════ */
.ppj-empty {
    text-align: center;
    color: #2e2e48;
    font-size: 0.75em;
    padding: 24px 0;
}
.ppj-empty-icon { font-size: 1.6em; margin-bottom: 8px; opacity: 0.4; }

/* ══ BTN EDITAR FOOTER ════════════════════════════════════ */
.ppj-footer {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 10px 16px;
    background: linear-gradient(to top, #08080f 70%, transparent);
    display: flex; gap: 8px;
    flex-shrink: 0;
}
.ppj-btn-editar {
    flex: 1;
    background: rgba(212,175,55,0.08);
    border: 1px solid rgba(212,175,55,0.2);
    border-radius: 6px;
    color: #d4af37;
    font-size: 0.78em;
    font-weight: 600;
    padding: 9px;
    cursor: pointer;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.5px;
    transition: background 0.15s;
}
.ppj-btn-editar:hover { background: rgba(212,175,55,0.15); }

/* ══ LOADER INLINE ═════════════════════════════════════════ */
.ppj-loader {
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    color: #3a3a58;
    font-size: 0.75em;
    gap: 8px;
}
.ppj-loader::before {
    content: '';
    width: 14px; height: 14px;
    border: 2px solid rgba(212,175,55,0.2);
    border-top-color: #d4af37;
    border-radius: 50%;
    animation: ppj-spin 0.8s linear infinite;
}
@keyframes ppj-spin { to { transform: rotate(360deg); } }

/* ══ RESPONSIVE ═══════════════════════════════════════════ */
@media (max-width: 480px) {
    #panel-pj-root { width: 100vw; }
}
`;
    document.head.appendChild(st);
}

// ─────────────────────────────────────────────────────────────
// CREAR ESTRUCTURA DEL PANEL (una sola vez)
// ─────────────────────────────────────────────────────────────
function _crearEstructura() {
    if (document.getElementById('panel-pj-root')) return;
    _inyectarEstilos();

    const overlay = document.createElement('div');
    overlay.id = 'panel-pj-overlay';
    overlay.onclick = cerrarPanelPJ;
    document.body.appendChild(overlay);

    const root = document.createElement('div');
    root.id = 'panel-pj-root';
    root.innerHTML = `
        <div class="ppj-header" id="ppj-header"></div>
        <div class="ppj-tabs"  id="ppj-tabs"></div>
        <div class="ppj-body"  id="ppj-body"></div>
        <div class="ppj-footer" id="ppj-footer"></div>
    `;
    document.body.appendChild(root);
}

// ─────────────────────────────────────────────────────────────
// ABRIR / CERRAR
// ─────────────────────────────────────────────────────────────
export function abrirPanelPJ(nombre) {
    _crearEstructura();
    estadoUI.pjSeleccionado = nombre;
    estadoUI.panelAbierto   = true;

    const root    = document.getElementById('panel-pj-root');
    const overlay = document.getElementById('panel-pj-overlay');
    root.classList.add('open');
    overlay.classList.add('open');

    _renderHeader(nombre);
    _renderTabs(nombre);
    _renderTab(nombre, _tabActivo[nombre] || 'hex');
}

export function cerrarPanelPJ() {
    estadoUI.panelAbierto = false;
    document.getElementById('panel-pj-root')?.classList.remove('open');
    document.getElementById('panel-pj-overlay')?.classList.remove('open');
}

// ─────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────
function _renderHeader(nombre) {
    const p   = personajes[nombre]; if (!p) return;
    const icono = p.iconoOverride || nombre;
    const safe  = nombre.replace(/'/g, "\\'");

    const tags = [
        p.isPlayer ? `<span class="ppj-tag ppj-tag-jugador">Jugador</span>` : `<span class="ppj-tag ppj-tag-npc">NPC</span>`,
        p.isActive ? `<span class="ppj-tag ppj-tag-activo">Activo</span>`  : `<span class="ppj-tag ppj-tag-inactivo">Inactivo</span>`
    ].join('');

    const puedeEditar = estadoUI.esAdmin || !p.isPlayer;

    document.getElementById('ppj-header').innerHTML = `
        <img class="ppj-avatar" src="${_imgIcon(icono)}"
             onerror="this.src='${_fallback()}'"
             onclick="window._ppjAbrirImgGrande('${safe}')"
             title="Ver imagen">
        <div class="ppj-header-info">
            <div class="ppj-nombre">${nombre}</div>
            <div class="ppj-tags">${tags}</div>
        </div>
        <div class="ppj-header-btns">
            ${puedeEditar ? `<button class="ppj-btn-icon" title="Editar" onclick="window.editarPersonaje('${safe}')">✏️</button>` : ''}
            <button class="ppj-btn-icon ppj-close" onclick="window.cerrarPanelPJ()">×</button>
        </div>
    `;

    // Footer
    document.getElementById('ppj-footer').innerHTML = puedeEditar
        ? `<button class="ppj-btn-editar" onclick="window.editarPersonaje('${safe}')">Editar personaje</button>`
        : '';
}

// ─────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────
function _renderTabs(nombre) {
    const p = personajes[nombre]; if (!p) return;
    const tabs = [
        { id: 'hex',      label: 'HEX' },
        { id: 'stats',    label: 'Stats' },
        { id: 'hechizos', label: 'Hechizos' },
        { id: 'objetos',  label: 'Objetos' },
        ...( p.isPlayer ? [{ id: 'misiones', label: 'Misiones' }] : [] )
    ];

    document.getElementById('ppj-tabs').innerHTML = tabs.map(t => `
        <button class="ppj-tab ${(_tabActivo[nombre] || 'hex') === t.id ? 'active' : ''}"
                onclick="window._ppjCambiarTab('${nombre.replace(/'/g,"\\'")}','${t.id}')">
            ${t.label}
        </button>
    `).join('');
}

// ─────────────────────────────────────────────────────────────
// ROUTING DE TABS
// ─────────────────────────────────────────────────────────────
function _renderTab(nombre, tab) {
    _tabActivo[nombre] = tab;
    const body = document.getElementById('ppj-body');
    body.innerHTML = `<div class="ppj-loader">Cargando...</div>`;

    // Actualizar estado activo de los botones
    document.querySelectorAll('.ppj-tab').forEach(b => b.classList.remove('active'));
    const btnActivo = [...document.querySelectorAll('.ppj-tab')].find(b =>
        b.textContent.trim().toLowerCase() === tab || b.getAttribute('onclick')?.includes(`'${tab}'`)
    );
    if (btnActivo) btnActivo.classList.add('active');

    // Despachar la pestaña correcta
    switch (tab) {
        case 'hex':      body.innerHTML = _tabHex(nombre);      break;
        case 'stats':    body.innerHTML = _tabStats(nombre);     break;
        case 'hechizos': _tabHechizos(nombre, body);             break;
        case 'objetos':  _tabObjetos(nombre, body);              break;
        case 'misiones': _tabMisiones(nombre, body);             break;
    }
}

// ─────────────────────────────────────────────────────────────
// TAB: HEX
// ─────────────────────────────────────────────────────────────
function _tabHex(nombre) {
    const p   = personajes[nombre]; if (!p) return '<div class="ppj-empty">Sin datos</div>';
    const safe = nombre.replace(/'/g, "\\'");
    const canEdit = estadoUI.esAdmin || !p.isPlayer;

    const deltas = [1000, 500, 300, 100, 50, 10, 5, 1];

    const btnsNeg = deltas.map(d =>
        canEdit ? `<button class="ppj-hex-btn neg" onclick="window.modStat('${safe}','hex',${-d})">−${d}</button>` : ''
    ).join('');
    const btnsPos = deltas.map(d =>
        canEdit ? `<button class="ppj-hex-btn" onclick="window.modStat('${safe}','hex',${d})">+${d}</button>` : ''
    ).join('');

    // Subir imagen
    const imgSec = (estadoUI.esAdmin || !p.isPlayer) ? `
    <div class="ppj-section">
        <div class="ppj-section-title">Imagen del personaje</div>
        <img class="ppj-img-preview"
             src="${_imgPj(p.iconoOverride || nombre)}"
             onerror="this.src='${_fallback()}'"
             onclick="window.abrirSubirImagen('${safe}')"
             title="Clic para cambiar imagen">
        <div class="ppj-upload-zone" onclick="window.abrirSubirImagen('${safe}')">
            📷 Clic para subir nueva imagen
        </div>
    </div>` : `
    <div class="ppj-section">
        <div class="ppj-section-title">Imagen</div>
        <img class="ppj-img-preview"
             src="${_imgPj(p.iconoOverride || nombre)}"
             onerror="this.src='${_fallback()}'"
             onclick="window._ppjAbrirImgGrande('${safe}')">
    </div>`;

    return `
    <div class="ppj-section">
        <div class="ppj-section-title">Saldo HEX</div>
        <div class="ppj-hex-val">${(p.hex || 0).toLocaleString()}</div>
        ${canEdit ? `
        <div class="ppj-hex-grid">${btnsNeg}</div>
        <div class="ppj-hex-grid" style="margin-top:5px;">${btnsPos}</div>
        ` : ''}
        <div class="ppj-asistencia" style="margin-top:14px;">
            Asistencia: <strong>${p.asistencia || 1}</strong>
        </div>
    </div>
    ${imgSec}`;
}

// ─────────────────────────────────────────────────────────────
// BARRAS SEGMENTADAS (helper)
// ─────────────────────────────────────────────────────────────
function _barraSegs(actual, max, tipo, maxCells = 26) {
    if (!max || max <= 0) return '';
    const n = Math.min(maxCells, max);
    const hpPorCelda = max / n;
    let segs = '';
    for (let i = 0; i < n; i++) {
        const filled = actual > hpPorCelda * i;
        segs += `<span class="ppj-seg ${filled ? 'on' : 'off'}-${tipo}"></span>`;
    }
    return `<div class="ppj-seg-bar">${segs}</div>`;
}

// ─────────────────────────────────────────────────────────────
// TAB: STATS
// ─────────────────────────────────────────────────────────────
function _tabStats(nombre) {
    const p = personajes[nombre]; if (!p) return '';
    const s = calcularStats(p);
    const esJugador = p.isPlayer || p.npc_tipo === 'jugador';
    const canEdit   = estadoUI.esAdmin || !p.isPlayer;
    const safe = nombre.replace(/'/g, "\\'");

    const _vida = (label, campo, actual, max, tipo, color, nSeg) => {
        const barra  = _barraSegs(actual, max, tipo, nSeg);
        const esOver = actual > max;
        return `<div class="ppj-vida-block">
            <div class="ppj-vida-header">
                <span class="ppj-vida-label" style="color:${color};">${label}</span>
                <div class="ppj-vida-ctrl">
                    ${canEdit ? `<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','${campo}',-1)">−</button>` : ''}
                    <span class="ppj-vida-xy">
                        <span class="actual ${esOver ? 'val-over' : ''}" style="color:${color};">${actual}</span>
                        <span class="sep">/</span>
                        <span class="maximo">${max}</span>
                    </span>
                    ${canEdit ? `<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','${campo}',1)">+</button>` : ''}
                </div>
            </div>
            ${barra}
        </div>`;
    };

    const _maxOverride = (label, campo, override, formula) => {
        if (!estadoUI.esAdmin) return '';
        const usandoFormula = override === 0;
        return `<div class="ppj-max-row">
            <span class="ppj-max-label">Máx ${label}</span>
            <button class="ppj-ctrl-btn" onclick="window.modStatMax('${safe}','${campo}',-1)">−</button>
            <span class="ppj-max-val ${usandoFormula ? 'formula' : 'manual'}">${formula}</span>
            <button class="ppj-ctrl-btn" onclick="window.modStatMax('${safe}','${campo}',1)">+</button>
            ${!usandoFormula ? `<button class="ppj-ctrl-btn" onclick="window.resetStatMax('${safe}','${campo}')" title="Volver a fórmula">↺</button>` : ''}
            <span class="ppj-hint ${usandoFormula ? '' : 'manual'}">${usandoFormula ? 'fórmula' : 'manual'}</span>
        </div>`;
    };

    // Push
    const _push = (recurso, label, emoji) => {
        const hasMax = recurso === 'vex' ? s.vex_max > 0 : s.guarda_max > 0;
        if (!hasMax) return '';
        const disponibles = calcularPushDisponibles(p, s, recurso);
        const usados = recurso === 'vex' ? (p.push_vex_actual || 0) : (p.push_guarda_actual || 0);
        const restantes = Math.max(0, disponibles - usados);
        const valorPush = calcularValorPush(p, recurso);
        const cd = calcularCooldownPush(p, recurso);
        const canPush = restantes > 0 && cd.disponible;

        const dots = Array.from({ length: Math.max(disponibles, 1) }, (_, i) =>
            `<span class="ppj-dot ${i < usados ? 'used' : 'avail'}"></span>`
        ).join('');

        const cdText = !cd.disponible
            ? `<div class="ppj-push-cd">⏳ ${Math.floor(cd.restaSeg/60)}m ${String(cd.restaSeg%60).padStart(2,'0')}s</div>`
            : '';

        return `<div class="ppj-push-block">
            <div class="ppj-push-header">
                <span class="ppj-push-label">${emoji} ${label}</span>
                <div class="ppj-push-dots">${dots}</div>
                <span style="font-size:0.68em;color:#4a4a68;">${usados}/${disponibles}</span>
            </div>
            ${cdText}
            <div class="ppj-push-info">
                <span class="ppj-push-valor">+${valorPush} por push</span>
                <button class="btn-push-pj" ${canPush ? '' : 'disabled'}
                    onclick="window.ejecutarPush('${safe}','${recurso}')">
                    ${!cd.disponible ? 'Cooldown' : (restantes > 0 ? `Push ${label}` : 'Sin pushes')}
                </button>
            </div>
            ${estadoUI.esAdmin ? `<div style="display:flex;gap:6px;align-items:center;margin-top:6px;">
                <span style="font-size:0.62em;color:#3a3a58;">Extra OP</span>
                <button class="ppj-ctrl-btn" onclick="window.modPushExtra('${safe}','${recurso}',-1)">−</button>
                <span style="font-size:0.75em;color:#888;">${recurso==='vex'?(p.push_vex_limit||0):(p.push_guarda_limit||0)}</span>
                <button class="ppj-ctrl-btn" onclick="window.modPushExtra('${safe}','${recurso}',1)">+</button>
                <button class="ppj-ctrl-btn" onclick="window.resetPushes('${safe}','${recurso}')" style="margin-left:4px;">↺</button>
            </div>` : ''}
        </div>`;
    };

    // Afinidades
    const AFINIDADES = [
        { key:'fisica',     label:'Física' },
        { key:'energetica', label:'Energética' },
        { key:'espiritual', label:'Espiritual' },
        { key:'mando',      label:'Mando' },
        { key:'psiquica',   label:'Psíquica' },
        { key:'oscura',     label:'Oscura' }
    ];

    const afinRows = AFINIDADES.map(a => {
        const base  = p.afin_base?.[a.key]  || 0;
        const extra = p.afin_extra?.[a.key] || 0;
        const alter = p.afin_alter?.[a.key] || 0;
        const total = base + extra + alter;
        return `<div class="ppj-afin-block">
            <div class="ppj-afin-header">
                <span class="ppj-afin-name">${a.label}</span>
                <span class="ppj-afin-total">${total}</span>
            </div>
            <div class="ppj-afin-row">
                <span class="ppj-afin-src-lbl src-b">B</span>
                ${estadoUI.esAdmin ? `<button class="ppj-ctrl-btn" onclick="window.modAfin('${safe}','${a.key}',-1)">−</button>` : ''}
                <span class="ppj-afin-val">${base}</span>
                ${estadoUI.esAdmin ? `<button class="ppj-ctrl-btn" onclick="window.modAfin('${safe}','${a.key}',1)">+</button>` : ''}
            </div>
            <div class="ppj-afin-row">
                <span class="ppj-afin-src-lbl src-ext">Ext</span>
                ${estadoUI.esAdmin ? `<button class="ppj-ctrl-btn" onclick="window.modAfinExtra('${safe}','${a.key}',-1)">−</button>` : ''}
                <span class="ppj-afin-val">${extra >= 0 ? '+' : ''}${extra}</span>
                ${estadoUI.esAdmin ? `<button class="ppj-ctrl-btn" onclick="window.modAfinExtra('${safe}','${a.key}',1)">+</button>` : ''}
            </div>
            <div class="ppj-afin-row">
                <span class="ppj-afin-src-lbl src-alt">Alt</span>
                ${canEdit ? `<button class="ppj-ctrl-btn" onclick="window.modAfinAlter('${safe}','${a.key}',-1)">−</button>` : ''}
                <span class="ppj-afin-val">${alter >= 0 ? '+' : ''}${alter}</span>
                ${canEdit ? `<button class="ppj-ctrl-btn" onclick="window.modAfinAlter('${safe}','${a.key}',1)">+</button>` : ''}
            </div>
        </div>`;
    }).join('');

    const pctVex = s.vex_max > 0 ? Math.min(100, Math.round((p.vex_actual || 0) / s.vex_max * 100)) : 0;

    return `
    <div class="ppj-section">
        <div class="ppj-section-title">Recursos vitales</div>

        ${_vida('Vida Roja', 'vida_roja_actual', p.vida_roja_actual || 0, s.vida_roja_max, 'vida', '#d4af37', 26)}
        ${_maxOverride('Vida Roja', 'vida_roja_max_op', p.vida_roja_max_op || 0, s.vida_roja_max)}
        <div class="ppj-formula">${formulas.vida_roja_max?.expr || ''}</div>

        ${s.vida_azul_max > 0 ? `
        ${_vida('Vida Azul', 'vida_azul_actual', s.vida_azul_actual, s.vida_azul_max, 'azul', '#4ab3e8', 26)}
        <div class="ppj-formula">${formulas.vida_azul_max?.expr || ''}</div>
        ` : ''}

        ${s.guarda_max > 0 ? `
        ${_vida('Guarda Dorada', 'guarda_actual', p.guarda_actual || 0, s.guarda_max, 'guarda', '#d4af37', 20)}
        ${_maxOverride('Guarda', 'guarda_max_op', p.guarda_max_op || 0, s.guarda_max)}
        <div class="ppj-formula">${formulas.guarda_max?.expr || ''}</div>
        ` : ''}

        ${s.vex_max > 0 ? `
        <div class="ppj-vida-block">
            <div class="ppj-vida-header">
                <span class="ppj-vida-label" style="color:#9a50dc;">VEX</span>
                <div class="ppj-vida-ctrl">
                    ${canEdit ? `<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','vex_actual',-50)">−50</button>` : ''}
                    <span class="ppj-vida-xy">
                        <span class="actual" style="color:#9a50dc;">${Math.floor(p.vex_actual || 0)}</span>
                        <span class="sep">/</span>
                        <span class="maximo">${s.vex_max}</span>
                    </span>
                    ${canEdit ? `<button class="ppj-ctrl-btn" onclick="window.modStat('${safe}','vex_actual',50)">+50</button>` : ''}
                </div>
            </div>
            <div class="ppj-vex-bar"><div class="ppj-vex-fill" style="width:${pctVex}%"></div></div>
        </div>
        <div class="ppj-formula">${esJugador ? (formulas.vex_max?.expr || '') : 'Fijo (NPC sistema)'}</div>
        ` : ''}
    </div>

    <div class="ppj-section">
        <div class="ppj-section-title">Pushes</div>
        ${_push('vex', 'VEX', '⚡')}
        ${_push('guarda', 'Guarda', '🛡')}
        ${!s.vex_max && !s.guarda_max ? '<div class="ppj-empty" style="padding:10px 0"><div class="ppj-empty-icon">💤</div>Sin pushes disponibles</div>' : ''}
    </div>

    <div class="ppj-section">
        <div class="ppj-section-title">Afinidades</div>
        ${afinRows}
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// TAB: HECHIZOS (async — carga desde Supabase)
// ─────────────────────────────────────────────────────────────
async function _tabHechizos(nombre, body) {
    body.innerHTML = '<div class="ppj-loader">Cargando hechizos…</div>';

    // Cargar inventario de hechizos del personaje
    const { data: invHz, error } = await supabase
        .from('hechizos_inventario')
        .select('hechizo_nombre, hechizo_afinidad, hechizo_hex, tipo, origen')
        .eq('personaje_nombre', nombre)
        .order('hechizo_afinidad');

    if (error) {
        body.innerHTML = '<div class="ppj-empty"><div class="ppj-empty-icon">⚠️</div>Error cargando hechizos</div>';
        return;
    }

    const lista = invHz || [];

    // Color por afinidad (paleta del sistema)
    const _colorAf = (af) => {
        const map = {
            'Física':     '#e2a673', 'Energética': '#f3e57a',
            'Espiritual': '#7df0a7', 'Mando':      '#a4d3f2',
            'Psíquica':   '#dcb1f0', 'Oscura':     '#ff526f',
            'HEX':        '#d4af37', 'Desconocida':'#888'
        };
        return map[af] || '#888';
    };

    // Agrupar por afinidad
    const grupos = {};
    lista.forEach(h => {
        const af = h.hechizo_afinidad || 'Sin afinidad';
        if (!grupos[af]) grupos[af] = [];
        grupos[af].push(h);
    });

    let html = '';

    if (lista.length === 0) {
        html = `<div class="ppj-empty"><div class="ppj-empty-icon">📖</div>Sin hechizos en el inventario</div>`;
    } else {
        Object.entries(grupos).forEach(([af, hechizos]) => {
            const color = _colorAf(af);
            html += `<div class="ppj-section">
                <div class="ppj-section-title" style="color:${color}33; border-left:2px solid ${color}55; padding-left:8px; color:${color};">${af}</div>
                ${hechizos.map(h => `
                    <div class="ppj-hechizo-card">
                        <div class="ppj-hechizo-header">
                            <div class="ppj-hechizo-nombre">${h.hechizo_nombre}</div>
                            ${h.tipo && h.tipo !== 'Normal' ? `<span class="ppj-hechizo-clase">${h.tipo}</span>` : ''}
                        </div>
                        ${h.hechizo_hex > 0 ? `<div class="ppj-hechizo-hex">⬡ ${h.hechizo_hex} HEX</div>` : ''}
                    </div>
                `).join('')}
            </div>`;
        });
    }

    // Sección "aprendibles" — solo si hay árbol de hechizos disponible
    html += `
    <div class="ppj-section" id="ppj-aprendibles-sec">
        <div class="ppj-section-title">Puede aprender</div>
        <div class="ppj-loader" id="ppj-aprendibles-loader">Calculando árbol…</div>
    </div>`;

    body.innerHTML = html;

    // Cargar aprendibles en segundo plano (no bloquea el render del inventario)
    _cargarAprendibles(nombre, body);
}

async function _cargarAprendibles(nombre, body) {
    try {
        // Necesitamos los nodos del árbol para calcular aprendibles
        const { data: nodos } = await supabase
            .from('hechizos_nodos')
            .select('hechizo_id, nombre, afinidad, clase, es_conocido')
            .eq('es_conocido', true);

        const { data: strings } = await supabase
            .from('hechizos_strings')
            .select('source, target');

        const { data: invHz } = await supabase
            .from('hechizos_inventario')
            .select('hechizo_nombre')
            .eq('personaje_nombre', nombre);

        const sec = document.getElementById('ppj-aprendibles-loader');
        if (!sec) return;

        const invSet = new Set((invHz || []).map(h => h.hechizo_nombre?.toLowerCase().trim()));
        const reqs = {};
        (strings || []).forEach(r => {
            if (!r.target) return;
            if (!reqs[r.target]) reqs[r.target] = [];
            reqs[r.target].push(r.source);
        });

        const aprendibles = [];
        (nodos || []).forEach(n => {
            const nombre_nodo = n.nombre?.toLowerCase().trim();
            if (invSet.has(nombre_nodo)) return; // ya lo tiene
            const requisitos = reqs[n.hechizo_id] || [];
            const cumple = requisitos.length > 0 && requisitos.some(req => {
                // buscar si el nombre del nodo con ese ID está en inventario
                const nodoReq = (nodos || []).find(nn => nn.hechizo_id === req);
                return nodoReq && invSet.has(nodoReq.nombre?.toLowerCase().trim());
            });
            if (cumple) aprendibles.push(n);
        });

        if (aprendibles.length === 0) {
            sec.outerHTML = '<div class="ppj-empty" style="padding:10px 0;"><div class="ppj-empty-icon">🔒</div>Sin nuevos hechizos disponibles</div>';
            return;
        }

        const _colorAf = (af) => {
            const map = { 'Física':'#e2a673','Energética':'#f3e57a','Espiritual':'#7df0a7','Mando':'#a4d3f2','Psíquica':'#dcb1f0','Oscura':'#ff526f' };
            return map[af] || '#888';
        };

        sec.outerHTML = aprendibles.map(n => `
            <div class="ppj-hechizo-card">
                <div class="ppj-hechizo-header">
                    <span class="ppj-hechizo-af" style="background:${_colorAf(n.afinidad)}22;color:${_colorAf(n.afinidad)};">${n.afinidad || '?'}</span>
                    <div class="ppj-hechizo-nombre">${n.nombre}</div>
                    <span class="ppj-hechizo-clase">${n.clase || ''}</span>
                </div>
            </div>
        `).join('');
    } catch(e) {
        const sec = document.getElementById('ppj-aprendibles-loader');
        if (sec) sec.outerHTML = '';
    }
}

// ─────────────────────────────────────────────────────────────
// TAB: OBJETOS (async)
// ─────────────────────────────────────────────────────────────
async function _tabObjetos(nombre, body) {
    body.innerHTML = '<div class="ppj-loader">Cargando objetos…</div>';

    const { data: items, error } = await supabase
        .from('inventario_objetos')
        .select('objeto_nombre, cantidad, equipado')
        .eq('personaje_nombre', nombre)
        .gt('cantidad', 0)
        .order('objeto_nombre');

    if (error) {
        body.innerHTML = '<div class="ppj-empty"><div class="ppj-empty-icon">⚠️</div>Error cargando objetos</div>';
        return;
    }

    const lista = items || [];

    if (lista.length === 0) {
        body.innerHTML = `<div class="ppj-section"><div class="ppj-empty"><div class="ppj-empty-icon">🎒</div>Inventario vacío</div></div>`;
        return;
    }

    // Cargar definiciones de objetos para mostrar tipo/efecto
    const nombres = lista.map(i => i.objeto_nombre);
    const { data: objDefs } = await supabase
        .from('objetos')
        .select('nombre, tipo, rareza, material, efecto')
        .in('nombre', nombres);

    const defMap = {};
    (objDefs || []).forEach(o => { defMap[o.nombre] = o; });

    const _rarColor = (rar) => ({
        'Legendario': '#d4af37',
        'Raro':       '#9a50dc',
        'Común':      '#5a5a78'
    })[rar] || '#4a4a68';

    const html = `<div class="ppj-section">
        <div class="ppj-section-title">${lista.length} objeto${lista.length !== 1 ? 's' : ''}</div>
        ${lista.map(item => {
            const def = defMap[item.objeto_nombre] || {};
            return `<div class="ppj-obj-card">
                <div class="ppj-obj-cant">×${item.cantidad}</div>
                <div class="ppj-obj-info">
                    <div class="ppj-obj-nombre">${item.objeto_nombre}</div>
                    <div class="ppj-obj-det">
                        ${def.tipo || ''} ${def.rareza ? `· <span style="color:${_rarColor(def.rareza)}">${def.rareza}</span>` : ''}
                        ${def.efecto ? `<br>${def.efecto}` : ''}
                    </div>
                </div>
                <span class="ppj-obj-eqp ${item.equipado ? 'on' : 'off'}">${item.equipado ? 'Eqp.' : 'Inv.'}</span>
            </div>`;
        }).join('')}
    </div>`;

    body.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// TAB: MISIONES (async — solo jugadores)
// ─────────────────────────────────────────────────────────────
async function _tabMisiones(nombre, body) {
    body.innerHTML = '<div class="ppj-loader">Cargando misiones…</div>';

    const { data: misiones, error } = await supabase
        .from('misiones')
        .select('titulo, tipo, clase, estado, descripcion, cupos, jugadores')
        .order('orden');

    if (error) {
        body.innerHTML = '<div class="ppj-empty"><div class="ppj-empty-icon">⚠️</div>Error cargando misiones</div>';
        return;
    }

    // Filtrar misiones donde participa el personaje
    const misPersonaje = (misiones || []).filter(m => {
        const jugs = Array.isArray(m.jugadores) ? m.jugadores : [];
        return jugs.includes(nombre);
    });

    // También incluir misiones disponibles (inactivas con cupo)
    const misDisponibles = (misiones || []).filter(m => {
        const jugs = Array.isArray(m.jugadores) ? m.jugadores : [];
        return m.estado < 3 && !jugs.includes(nombre);
    });

    const _estadoBadge = (e) => {
        const labels = ['Inactiva','Pendiente','En Proceso','Finalizada'];
        return `<span class="ppj-mis-badge ppj-mis-${e}">${labels[e] || '?'}</span>`;
    };

    let html = '';

    if (misPersonaje.length === 0 && misDisponibles.length === 0) {
        html = `<div class="ppj-section"><div class="ppj-empty"><div class="ppj-empty-icon">📋</div>Sin misiones</div></div>`;
    } else {
        if (misPersonaje.length > 0) {
            html += `<div class="ppj-section">
                <div class="ppj-section-title">Participando (${misPersonaje.length})</div>
                ${misPersonaje.map(m => `
                    <div class="ppj-mision-card">
                        <div class="ppj-mis-header">
                            <span class="ppj-mis-titulo">${m.titulo}</span>
                            <span class="ppj-mis-clase">C-${m.clase}</span>
                        </div>
                        ${_estadoBadge(m.estado)}
                        ${m.descripcion ? `<div class="ppj-mis-desc">${m.descripcion.slice(0, 120)}${m.descripcion.length > 120 ? '…' : ''}</div>` : ''}
                    </div>
                `).join('')}
            </div>`;
        }

        if (misDisponibles.length > 0) {
            html += `<div class="ppj-section">
                <div class="ppj-section-title">Disponibles (${misDisponibles.length})</div>
                ${misDisponibles.map(m => `
                    <div class="ppj-mision-card">
                        <div class="ppj-mis-header">
                            <span class="ppj-mis-titulo">${m.titulo}</span>
                            <span class="ppj-mis-clase">C-${m.clase}</span>
                        </div>
                        ${_estadoBadge(m.estado)}
                        ${m.descripcion ? `<div class="ppj-mis-desc">${m.descripcion.slice(0, 100)}${m.descripcion.length > 100 ? '…' : ''}</div>` : ''}
                    </div>
                `).join('')}
            </div>`;
        }
    }

    body.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// EXPONER AL SCOPE GLOBAL (llamados desde HTML inline)
// ─────────────────────────────────────────────────────────────
window.cerrarPanelPJ = cerrarPanelPJ;

window._ppjCambiarTab = (nombre, tab) => {
    // Actualizar clases de botones
    document.querySelectorAll('.ppj-tab').forEach(b => b.classList.remove('active'));
    // El botón que dispara el onclick es el correcto
    event?.target?.classList.add('active');
    _renderTab(nombre, tab);
};

window._ppjAbrirImgGrande = (nombre) => {
    const p = personajes[nombre]; if (!p) return;
    const url = _imgPj(p.iconoOverride || nombre);
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    modal.onclick = () => modal.remove();
    modal.innerHTML = `<img src="${url}" onerror="this.src='${_fallback()}'"
        style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:10px;">`;
    document.body.appendChild(modal);
};

// ─────────────────────────────────────────────────────────────
// REFRESH desde fuera (p.ej. después de modStat)
// ─────────────────────────────────────────────────────────────
export function refreshPanelPJ() {
    const nombre = estadoUI.pjSeleccionado;
    if (!nombre || !estadoUI.panelAbierto) return;
    _renderHeader(nombre);
    const tab = _tabActivo[nombre] || 'hex';
    // Solo refrescar stats y hex en caliente (los async se recargan solos)
    if (tab === 'hex' || tab === 'stats') {
        _renderTab(nombre, tab);
    }
}
