// ============================================================
// panel-op-update.js — Panel de actualización masiva para OP
// Botón flotante al lado de HexCast, drawer modal al abrirse.
// Solo visible para esAdmin. Importar desde personajes-main.js
// ============================================================

import { supabase }             from '../hex-auth.js';
import { personajes, estadoUI } from './personajes-state.js';
import { calcularStats }        from './personajes-logic.js';
import { persistirCampos }      from './personajes-data.js';

// ── Estado local ─────────────────────────────────────────────
const opState = {
    seleccionados: new Set(),
    log: [],
    historial: [],
};

// ── CSS ───────────────────────────────────────────────────────
function _css() {
    if (document.getElementById('op-update-styles')) return;
    const st = document.createElement('style');
    st.id = 'op-update-styles';
    st.textContent = `
/* ── Botón disparador ── */
#op-trigger {
    position: fixed; bottom: 20px; left: calc(50% + 130px);
    background: rgba(10,6,24,0.96);
    border: 1px solid rgba(124,77,170,0.45);
    border-radius: 24px; color: #c8a0f0;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.72em; letter-spacing: 1.2px; padding: 10px 22px;
    cursor: pointer; z-index: 1100;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    transition: background 0.15s, box-shadow 0.15s;
    white-space: nowrap; user-select: none; font-weight: 600;
}
#op-trigger:hover {
    background: rgba(124,77,170,0.15);
    box-shadow: 0 4px 28px rgba(124,77,170,0.22);
}

/* ── Overlay ── */
#op-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    z-index: 1200; opacity: 0; pointer-events: none;
    transition: opacity 0.28s;
}
#op-overlay.open { opacity: 1; pointer-events: all; }

/* ── Drawer ── */
#op-drawer {
    position: fixed; left: 0; right: 0; bottom: 0;
    height: 56vh;
    background: #09081a;
    border-top: 1px solid rgba(124,77,170,0.3);
    border-radius: 14px 14px 0 0;
    z-index: 1201;
    display: flex; flex-direction: column;
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
    font-family: 'Inter', system-ui, sans-serif;
    box-shadow: 0 -8px 40px rgba(0,0,0,0.7);
}
#op-drawer.open { transform: translateY(0); }

.op-handle {
    width: 36px; height: 4px;
    background: rgba(255,255,255,0.1); border-radius: 2px;
    margin: 8px auto 0; flex-shrink: 0;
}

/* ── Header ── */
.op-header {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
}
.op-header-title {
    font-size: 0.7em; letter-spacing: 2px; text-transform: uppercase;
    color: rgba(124,77,170,0.9); font-weight: 700; flex: 1;
}
.op-btn-close {
    background: none; border: none; color: #444;
    font-size: 1.4em; cursor: pointer; padding: 2px 6px; line-height: 1;
    transition: color 0.15s;
}
.op-btn-close:hover { color: #ccc; }

/* ── Body 3 columnas ── */
.op-body {
    flex: 1; overflow: hidden;
    display: grid;
    grid-template-columns: 240px 1fr 300px;
    min-height: 0;
}
.op-col {
    padding: 10px 14px;
    border-right: 1px solid rgba(255,255,255,0.05);
    display: flex; flex-direction: column;
    overflow: hidden; min-height: 0;
}
.op-col:last-child { border-right: none; }
.op-col-title {
    font-size: 0.5em; letter-spacing: 2px; text-transform: uppercase;
    color: rgba(124,77,170,0.7); font-weight: 700; margin-bottom: 7px;
    flex-shrink: 0;
}

/* ── Chips PJs ── */
.op-pj-grid {
    display: flex; flex-wrap: wrap; gap: 5px;
    overflow-y: auto; flex: 1;
    scrollbar-width: thin;
    scrollbar-color: rgba(124,77,170,0.3) transparent;
    align-content: flex-start;
}
.op-pj-chip {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 8px; border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.03);
    cursor: pointer; transition: all 0.12s;
    font-size: 0.68em; color: #aaa; user-select: none;
}
.op-pj-chip:hover { border-color: rgba(124,77,170,0.4); color: #ccc; }
.op-pj-chip.sel {
    background: rgba(124,77,170,0.18);
    border-color: rgba(124,77,170,0.55);
    color: #c8a0f0;
}
.op-pj-chip img {
    width: 18px; height: 18px; border-radius: 50%;
    object-fit: cover; object-position: top; background: #222;
}
.op-sel-all {
    font-size: 0.55em; color: rgba(124,77,170,0.6);
    cursor: pointer; text-decoration: underline;
    margin-bottom: 5px; display: inline-block; flex-shrink: 0;
}
.op-sel-all:hover { color: #b080e0; }

/* ── Acciones ── */
.op-actions-scroll { flex: 1; overflow-y: auto; scrollbar-width: thin; }
.op-actions-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;
}
.op-action-label {
    font-size: 0.5em; letter-spacing: 1.5px; text-transform: uppercase;
    color: #555; font-weight: 700; margin-bottom: 4px;
}
.op-btns { display: flex; flex-wrap: wrap; gap: 3px; }
.op-btn {
    font-size: 0.62em; padding: 3px 7px; border-radius: 4px;
    cursor: pointer; font-weight: 700; border: 1px solid;
    transition: background 0.12s; font-family: inherit;
}
.op-btn-pos  { background: rgba(62,207,110,0.1);  border-color: rgba(62,207,110,0.35);  color: #3ecf6e; }
.op-btn-pos:hover  { background: rgba(62,207,110,0.22); }
.op-btn-neg  { background: rgba(220,80,80,0.1);   border-color: rgba(220,80,80,0.35);   color: #e06060; }
.op-btn-neg:hover  { background: rgba(220,80,80,0.22); }
.op-btn-hex  { background: rgba(212,175,55,0.1);  border-color: rgba(212,175,55,0.35);  color: #d4af37; }
.op-btn-hex:hover  { background: rgba(212,175,55,0.22); }
.op-btn-vex  { background: rgba(160,80,220,0.1);  border-color: rgba(160,80,220,0.35);  color: #b060e8; }
.op-btn-vex:hover  { background: rgba(160,80,220,0.22); }
.op-btn-gda  { background: rgba(212,175,55,0.08); border-color: rgba(212,175,55,0.25);  color: #c8953a; }
.op-btn-gda:hover  { background: rgba(212,175,55,0.18); }
.op-btn-push { background: rgba(124,77,170,0.12); border-color: rgba(124,77,170,0.4);   color: #c8a0f0; }
.op-btn-push:hover { background: rgba(124,77,170,0.24); }
.op-btn-undo { background: rgba(220,120,40,0.1);  border-color: rgba(220,120,40,0.35);  color: #e88040; }
.op-btn-undo:hover { background: rgba(220,120,40,0.22); }
.op-custom-row { display: flex; gap: 3px; margin-top: 4px; }
.op-custom-input {
    width: 60px; background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 4px;
    color: #ccc; font-size: 0.65em; padding: 3px 5px;
    text-align: center; outline: none; font-family: inherit;
}
.op-custom-input::placeholder { color: #444; }
.op-custom-input:focus { border-color: rgba(124,77,170,0.5); }

/* ── Log ── */
.op-log-wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.op-log-area {
    flex: 1; overflow-y: auto;
    background: rgba(0,0,0,0.3);
    border-radius: 5px; border: 1px solid rgba(255,255,255,0.06);
    padding: 6px 8px; font-size: 0.62em; color: #888;
    font-family: 'Inter', monospace; line-height: 1.7;
    scrollbar-width: thin; min-height: 0;
}
.op-log-entry {
    border-bottom: 1px solid rgba(255,255,255,0.04);
    padding: 3px 0;
}
.op-log-entry:last-child { border-bottom: none; }
.op-log-name { color: #c8a0f0; font-weight: 600; }
.op-log-stat { color: #d4af37; }
.op-log-vex  { color: #b060e8; }
.op-log-ts   { color: #333; margin-right: 4px; }
.op-log-actions { display: flex; gap: 5px; margin-top: 5px; flex-shrink: 0; }
.op-log-btn {
    font-size: 0.55em; padding: 2px 9px; border-radius: 4px;
    cursor: pointer; border: 1px solid; font-family: inherit; font-weight: 600;
}
`;
    document.head.appendChild(st);
}

// ── Helpers ───────────────────────────────────────────────────
function _norm(s) {
    return s ? s.toString().trim().toLowerCase()
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
        .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u').replace(/[ñ]/g,'n')
        .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : '';
}
function _sb() { try { return window.currentConfig?.storageUrl || ''; } catch { return ''; } }
function _imgPj(p, nombre) {
    const icono = p?.iconoOverride || nombre;
    return `${_sb()}/imgpersonajes/${_norm(icono)}icon.png`;
}
function _ts() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

function _addLog(linea) {
    opState.log.unshift({ ts: _ts(), texto: linea });
    if (opState.log.length > 200) opState.log.pop();
    _renderLog();
}

function _pjsSeleccionados() {
    return [...opState.seleccionados].filter(n => personajes[n]);
}

// ── Render ────────────────────────────────────────────────────
function _renderChips() {
    const grid = document.getElementById('op-pj-grid');
    if (!grid) return;
    const jugadores = Object.entries(personajes)
        .filter(([, p]) => p.isActive)
        .sort(([a], [b]) => a.localeCompare(b));
    grid.innerHTML = jugadores.map(([nombre, p]) => {
        const sel = opState.seleccionados.has(nombre);
        return `<div class="op-pj-chip ${sel ? 'sel' : ''}" onclick="window._opTogglePJ('${nombre.replace(/'/g,"\\'")}')" >
            <img src="${_imgPj(p, nombre)}" onerror="this.style.display='none'">
            ${nombre}
        </div>`;
    }).join('');
}

function _renderLog() {
    const el = document.getElementById('op-log-area');
    if (!el) return;
    if (opState.log.length === 0) {
        el.innerHTML = '<span style="color:#333;font-style:italic;">Sin cambios aún…</span>';
        return;
    }
    el.innerHTML = opState.log.map(e =>
        `<div class="op-log-entry"><span class="op-log-ts">[${e.ts}]</span>${e.texto}</div>`
    ).join('');
}

// ── Acciones ─────────────────────────────────────────────────
async function _aplicarCambio(campo, delta, label, colorClass) {
    const pjs = _pjsSeleccionados();
    if (!pjs.length) { _toast('Selecciona al menos un personaje'); return; }

    const lote  = [];
    const snaps = [];

    for (const nombre of pjs) {
        const p  = personajes[nombre];
        const s  = calcularStats(p);
        const viejo = p[campo] ?? 0;
        const caps  = { vex_actual: s.vex_max, guarda_actual: s.guarda_max, vida_roja_actual: s.vida_roja_max };
        const max   = caps[campo] ?? Infinity;
        const nuevo = campo === 'vida_azul_actual'
            ? viejo + delta
            : Math.max(0, Math.min(max, viejo + delta));
        snaps.push({ nombre, campo, viejo, nuevo, max });
        p[campo] = nuevo;
        lote.push(persistirCampos(nombre, { [campo]: nuevo }));
    }

    await Promise.all(lote);
    opState.historial.push(snaps);

    // Una entrada de log separada por <br> por personaje
    const signo = delta >= 0 ? `+${delta}` : `${delta}`;
    const lineas = snaps.map(s => {
        const valorMostrado = isFinite(s.max) ? `${s.nuevo}/${s.max}` : `${s.nuevo}`;
        return `<span class="op-log-name">${s.nombre}</span> `
             + `<span class="${colorClass}">${label} ${signo}</span>`
             + ` → <span class="op-log-stat">${valorMostrado}</span>`;
    }).join('<br>');
    _addLog(lineas);

    window.renderCatalogo?.();
    window.refreshPanelPJ?.();
}

async function _darHexPush(tipo, monto) {
    const pjs = _pjsSeleccionados();
    if (!pjs.length) { _toast('Selecciona al menos un personaje'); return; }

    const lote  = [];
    const snaps = [];

    for (const nombre of pjs) {
        const p    = personajes[nombre];
        const viejo = p.hex ?? 0;
        const nuevo = viejo + monto;
        snaps.push({ nombre, campo: 'hex', viejo, nuevo });
        p.hex = nuevo;
        lote.push(
            persistirCampos(nombre, { hex: nuevo }),
            supabase.from('hex_push_log').insert({
                personaje: nombre, tipo, cantidad: monto,
                nota: '', otorgado_por: 'OP'
            })
        );
    }

    await Promise.all(lote.flat());
    opState.historial.push(snaps);

    const tipoLabel = tipo.replace('_', ' ');
    const lineas = snaps.map(s =>
        `<span class="op-log-name">${s.nombre}</span> `
      + `<span class="op-log-stat">HEX +${monto} (${tipoLabel})</span>`
      + ` → <span class="op-log-stat">${s.nuevo}</span>`
    ).join('<br>');
    _addLog(lineas);

    window.renderCatalogo?.();
    window.refreshPanelPJ?.();
}

async function _darPushVexGuarda(recurso) {
    const pjs = _pjsSeleccionados();
    if (!pjs.length) { _toast('Selecciona al menos un personaje'); return; }

    const campo  = recurso === 'vex' ? 'vex_actual'      : 'guarda_actual';
    const tsKey  = recurso === 'vex' ? 'push_vex_ts'     : 'push_guarda_ts';
    const actKey = recurso === 'vex' ? 'push_vex_actual'  : 'push_guarda_actual';
    const label  = recurso === 'vex' ? 'VEX'             : 'Guarda';
    const lote   = [];
    const snaps  = [];

    for (const nombre of pjs) {
        const p = personajes[nombre];
        const s = calcularStats(p);
        const { calcularValorPush, calcularPushDisponibles } = await import('./personajes-logic.js');
        const valor = calcularValorPush(p, recurso);
        const disp  = calcularPushDisponibles(p, s, recurso);
        const usado = p[actKey] || 0;
        if (usado >= disp) continue;

        const max      = recurso === 'vex' ? s.vex_max : s.guarda_max;
        const viejo    = p[campo] ?? 0;
        const nuevo    = Math.min(max, viejo + valor);
        const nuevoAct = usado + 1;
        const ts       = new Date().toISOString();

        snaps.push({ nombre, campo, viejo, nuevo, max });
        p[campo]  = nuevo;
        p[actKey] = nuevoAct;
        p[tsKey]  = ts;

        lote.push(persistirCampos(nombre, {
            [campo]: nuevo,
            [actKey]: nuevoAct,
            [tsKey]: ts
        }));
    }

    if (!snaps.length) { _toast(`Sin pushes de ${label} disponibles`); return; }
    await Promise.all(lote);
    opState.historial.push(snaps);

    const lineas = snaps.map(s => {
        const ganado = s.nuevo - s.viejo;
        const signo  = ganado >= 0 ? `+${ganado}` : `${ganado}`;
        return `<span class="op-log-name">${s.nombre}</span> `
             + `Push ${label} ${signo}`
             + ` → <span class="op-log-stat">${s.nuevo}/${s.max}</span>`;
    }).join('<br>');
    _addLog(lineas);

    window.renderCatalogo?.();
    window.refreshPanelPJ?.();
}

async function _undo() {
    if (!opState.historial.length) { _toast('Nada que deshacer'); return; }
    const snaps = opState.historial.pop();
    const lote  = [];

    for (const s of snaps) {
        const p = personajes[s.nombre];
        if (!p) continue;
        p[s.campo] = s.viejo;
        lote.push(persistirCampos(s.nombre, { [s.campo]: s.viejo }));
    }

    await Promise.all(lote);
    const lineas = `<span style="color:#e88040;">↺ Deshecho:</span> `
        + snaps.map(s =>
            `<span class="op-log-name">${s.nombre}</span> `
          + `${s.campo} ${s.nuevo} → <span class="op-log-stat">${s.viejo}</span>`
          ).join('<br>');
    _addLog(lineas);

    window.renderCatalogo?.();
    window.refreshPanelPJ?.();
}

function _copiarLog() {
    const txt = opState.log.map(e =>
        `[${e.ts}] ${e.texto.replace(/<br>/g, '\n        ').replace(/<[^>]+>/g, '')}`
    ).join('\n');
    navigator.clipboard.writeText(txt).then(() => _toast('Log copiado'));
}

function _toast(msg) {
    let el = document.getElementById('op-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'op-toast';
        el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);'
            + 'background:#1a1a2a;border:1px solid rgba(124,77,170,0.5);color:#c8a0f0;'
            + 'font-size:0.75em;padding:7px 16px;border-radius:6px;z-index:9999;font-family:Inter,sans-serif;';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

// ── Abrir / cerrar ────────────────────────────────────────────
function _open() {
    document.getElementById('op-overlay')?.classList.add('open');
    document.getElementById('op-drawer')?.classList.add('open');
    _renderChips();
}
function _close() {
    document.getElementById('op-overlay')?.classList.remove('open');
    document.getElementById('op-drawer')?.classList.remove('open');
}

// ── Montaje ───────────────────────────────────────────────────
function _montar() {
    if (document.getElementById('op-trigger')) return;
    _css();

    // Botón disparador (al lado derecho del botón HexCast)
    const btn = document.createElement('button');
    btn.id = 'op-trigger';
    btn.textContent = '⚙ OP Panel';
    btn.onclick = _open;
    document.body.appendChild(btn);

    // Overlay semitransparente
    const overlay = document.createElement('div');
    overlay.id = 'op-overlay';
    overlay.onclick = _close;
    document.body.appendChild(overlay);

    // Drawer
    const drawer = document.createElement('div');
    drawer.id = 'op-drawer';
    drawer.innerHTML = `
        <div class="op-handle"></div>
        <div class="op-header">
            <span class="op-header-title">⚙ OP Panel</span>
            <button class="op-btn-close" onclick="window._opClose()">✕</button>
        </div>
        <div class="op-body">

            <!-- COL 1: Selección PJs -->
            <div class="op-col">
                <div class="op-col-title">Personajes</div>
                <span class="op-sel-all" onclick="window._opSelAll()">
                    Seleccionar todos · <span id="op-sel-count">0</span>
                </span>
                <div class="op-pj-grid" id="op-pj-grid"></div>
            </div>

            <!-- COL 2: Acciones -->
            <div class="op-col">
                <div class="op-col-title">Actualizar</div>
                <div class="op-actions-scroll">
                    <div class="op-actions-grid">

                        <!-- HEX -->
                        <div class="op-action-block">
                            <div class="op-action-label">HEX</div>
                            <div class="op-btns">
                                <button class="op-btn op-btn-pos" onclick="window._opHex(100)">+100</button>
                                <button class="op-btn op-btn-pos" onclick="window._opHex(300)">+300</button>
                                <button class="op-btn op-btn-pos" onclick="window._opHex(500)">+500</button>
                                <button class="op-btn op-btn-pos" onclick="window._opHex(1000)">+1k</button>
                                <button class="op-btn op-btn-neg" onclick="window._opHex(-100)">−100</button>
                                <button class="op-btn op-btn-neg" onclick="window._opHex(-500)">−500</button>
                            </div>
                            <div class="op-custom-row">
                                <input class="op-custom-input" id="op-hex-custom" type="number" placeholder="±HEX">
                                <button class="op-btn op-btn-hex" onclick="window._opHexCustom()">ok</button>
                            </div>
                            <div class="op-btns" style="margin-top:6px;">
                                <button class="op-btn op-btn-push" style="font-size:0.55em;" onclick="window._opHexPush('turno_extra',500)">Turno +500</button>
                                <button class="op-btn op-btn-push" style="font-size:0.55em;" onclick="window._opHexPushCustom()">Contenido</button>
                            </div>
                            <div class="op-custom-row">
                                <input class="op-custom-input" id="op-contenido-custom" type="number" placeholder="100-1000" value="500">
                            </div>
                        </div>

                        <!-- VEX -->
                        <div class="op-action-block">
                            <div class="op-action-label">VEX</div>
                            <div class="op-btns">
                                <button class="op-btn op-btn-pos" onclick="window._opVex(50)">+50</button>
                                <button class="op-btn op-btn-pos" onclick="window._opVex(100)">+100</button>
                                <button class="op-btn op-btn-pos" onclick="window._opVex(200)">+200</button>
                                <button class="op-btn op-btn-neg" onclick="window._opVex(-50)">−50</button>
                                <button class="op-btn op-btn-neg" onclick="window._opVex(-100)">−100</button>
                            </div>
                            <div class="op-custom-row">
                                <input class="op-custom-input" id="op-vex-custom" type="number" placeholder="±VEX">
                                <button class="op-btn op-btn-vex" onclick="window._opVexCustom()">ok</button>
                            </div>
                            <div class="op-btns" style="margin-top:6px;">
                                <button class="op-btn op-btn-push" style="font-size:0.55em;" onclick="window._opPushVex()">⚡ Push VEX</button>
                            </div>
                        </div>

                        <!-- GUARDA -->
                        <div class="op-action-block">
                            <div class="op-action-label">Guarda dorada</div>
                            <div class="op-btns">
                                <button class="op-btn op-btn-pos" onclick="window._opGuarda(1)">+1</button>
                                <button class="op-btn op-btn-pos" onclick="window._opGuarda(3)">+3</button>
                                <button class="op-btn op-btn-pos" onclick="window._opGuarda(5)">+5</button>
                                <button class="op-btn op-btn-neg" onclick="window._opGuarda(-1)">−1</button>
                                <button class="op-btn op-btn-neg" onclick="window._opGuarda(-3)">−3</button>
                                <button class="op-btn op-btn-neg" onclick="window._opGuarda(-5)">−5</button>
                            </div>
                            <div class="op-custom-row">
                                <input class="op-custom-input" id="op-gda-custom" type="number" placeholder="±Gda">
                                <button class="op-btn op-btn-gda" onclick="window._opGuardaCustom()">ok</button>
                            </div>
                            <div class="op-btns" style="margin-top:6px;">
                                <button class="op-btn op-btn-push" style="font-size:0.55em;" onclick="window._opPushGuarda()">🛡 Push Guarda</button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <!-- COL 3: Log -->
            <div class="op-col">
                <div class="op-col-title" style="display:flex;justify-content:space-between;align-items:center;">
                    Log de cambios
                    <button class="op-btn op-btn-undo" onclick="window._opUndo()" style="font-size:0.55em;padding:2px 8px;">↺ Deshacer</button>
                </div>
                <div class="op-log-wrap">
                    <div class="op-log-area" id="op-log-area">
                        <span style="color:#333;font-style:italic;">Sin cambios aún…</span>
                    </div>
                    <div class="op-log-actions">
                        <button class="op-log-btn op-btn" style="background:rgba(212,175,55,0.08);border-color:rgba(212,175,55,0.25);color:#d4af37;" onclick="window._opCopiarLog()">📋 Copiar log</button>
                        <button class="op-log-btn op-btn" style="background:rgba(220,80,80,0.08);border-color:rgba(220,80,80,0.25);color:#e06060;" onclick="window._opLimpiarLog()">🗑 Limpiar</button>
                    </div>
                </div>
            </div>

        </div>
    `;
    document.body.appendChild(drawer);
}

// ── Handlers globales ─────────────────────────────────────────
window._opClose      = _close;
window._opOpen       = _open;

window._opTogglePJ = (nombre) => {
    if (opState.seleccionados.has(nombre)) opState.seleccionados.delete(nombre);
    else opState.seleccionados.add(nombre);
    document.getElementById('op-sel-count').textContent = opState.seleccionados.size;
    _renderChips();
};

window._opSelAll = () => {
    const pjs = Object.keys(personajes).filter(n => personajes[n].isActive);
    if (opState.seleccionados.size === pjs.length) opState.seleccionados.clear();
    else pjs.forEach(n => opState.seleccionados.add(n));
    document.getElementById('op-sel-count').textContent = opState.seleccionados.size;
    _renderChips();
};

window._opHex    = (d) => _aplicarCambio('hex',         d, 'HEX',    'op-log-stat');
window._opVex    = (d) => _aplicarCambio('vex_actual',  d, 'VEX',    'op-log-vex');
window._opGuarda = (d) => _aplicarCambio('guarda_actual', d, 'Guarda', 'op-log-stat');

window._opHexCustom = () => {
    const v = parseInt(document.getElementById('op-hex-custom')?.value);
    if (!v || isNaN(v)) return;
    _aplicarCambio('hex', v, 'HEX', 'op-log-stat');
    document.getElementById('op-hex-custom').value = '';
};
window._opVexCustom = () => {
    const v = parseInt(document.getElementById('op-vex-custom')?.value);
    if (!v || isNaN(v)) return;
    _aplicarCambio('vex_actual', v, 'VEX', 'op-log-vex');
    document.getElementById('op-vex-custom').value = '';
};
window._opGuardaCustom = () => {
    const v = parseInt(document.getElementById('op-gda-custom')?.value);
    if (!v || isNaN(v)) return;
    _aplicarCambio('guarda_actual', v, 'Guarda', 'op-log-stat');
    document.getElementById('op-gda-custom').value = '';
};

window._opHexPush       = (tipo, monto) => _darHexPush(tipo, monto);
window._opHexPushCustom = () => {
    const v = parseInt(document.getElementById('op-contenido-custom')?.value) || 500;
    _darHexPush('contenido', Math.max(100, Math.min(1000, v)));
};

window._opPushVex    = () => _darPushVexGuarda('vex');
window._opPushGuarda = () => _darPushVexGuarda('guarda');
window._opUndo       = () => _undo();
window._opCopiarLog  = () => _copiarLog();
window._opLimpiarLog = () => { opState.log = []; _renderLog(); };

// ── Exportar ──────────────────────────────────────────────────
export function montarOpPanel() {
    if (!estadoUI.esAdmin) return;
    _montar();
}

export function refrescarOpPanel() {
    if (document.getElementById('op-pj-grid')) _renderChips();
}
